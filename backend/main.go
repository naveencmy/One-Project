package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

const ExcelFilePath = "workspace_data.xlsx"

// ── Rate Limiter ──────────────────────────────────────────────────────────────

type RateLimiter struct {
	mu       sync.Mutex
	attempts map[string][]time.Time
}

var pinLimiter = &RateLimiter{attempts: make(map[string][]time.Time)}

func (rl *RateLimiter) Allow(ip string, maxAttempts int, window time.Duration) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-window)

	var valid []time.Time
	for _, t := range rl.attempts[ip] {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}

	if len(valid) >= maxAttempts {
		rl.attempts[ip] = valid
		return false
	}

	rl.attempts[ip] = append(valid, now)
	return true
}

// ── CORS & Security Headers ───────────────────────────────────────────────────

func enableCORS(w http.ResponseWriter, r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		allowedOrigin := os.Getenv("ALLOWED_ORIGIN")
		if allowedOrigin != "" {
			origin = allowedOrigin
		} else {
			origin = "*"
		}
	}

	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
	w.Header().Set("Access-Control-Allow-Credentials", "true")

	// Security HTTP Headers
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("X-XSS-Protection", "1; mode=block")
	w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return true
	}
	return false
}

// getClientIP extracts the real IP from the request.
func getClientIP(r *http.Request) string {
	ip := r.RemoteAddr
	if idx := strings.LastIndex(ip, ":"); idx != -1 {
		ip = ip[:idx]
	}
	return ip
}

func loadPortFromEnv() string {
	if p := os.Getenv("PORT"); p != "" {
		return strings.TrimSpace(p)
	}
	if data, err := os.ReadFile(".env"); err == nil {
		for _, line := range strings.Split(string(data), "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "PORT=") {
				return strings.TrimSpace(strings.TrimPrefix(line, "PORT="))
			}
		}
	}
	return "8085"
}

func main() {
	if err := InitExcelStore(ExcelFilePath); err != nil {
		log.Fatalf("Fatal error initializing Excel store: %v", err)
	}

	// Auth routes
	http.HandleFunc("/api/auth/status",   handleAuthStatus)
	http.HandleFunc("/api/auth/verify",   handleAuthVerify)
	http.HandleFunc("/api/auth/setup",    handleAuthSetup)
	http.HandleFunc("/api/auth/validate", handleAuthValidate)

	// Data routes
	http.HandleFunc("/api/items",         handleItems)
	http.HandleFunc("/api/items/comment", handleComment)
	http.HandleFunc("/api/excel/export",  handleExcelExport)
	http.HandleFunc("/api/excel/import",  handleExcelImport)
	http.HandleFunc("/api/excel/sheets",  handleExcelSheets)
	http.HandleFunc("/api/profile",       handleProfile)
	http.HandleFunc("/api/profile/pin",   handlePinHash)
	http.HandleFunc("/api/assignees",     handleAssignees)

	port := loadPortFromEnv()

	fmt.Printf("\n⚡ Nexus Go Backend  →  http://localhost:%s\n", port)
	fmt.Printf("📊 Excel Engine: %s (6-sheet schema)\n", ExcelFilePath)
	fmt.Printf("🔐 PIN Configured: %t\n", IsConfigured(ExcelFilePath))
	fmt.Printf("🛡️  CORS Origin: %s\n\n", os.Getenv("ALLOWED_ORIGIN"))

	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server stopped: %v", err)
	}
}

// ── Auth Handlers ─────────────────────────────────────────────────────────────

// GET /api/auth/status
// Returns { "configured": bool, "sessionValid": bool }
// Also validates an optional Bearer token in the Authorization header.
func handleAuthStatus(w http.ResponseWriter, r *http.Request) {
	if enableCORS(w, r) {
		return
	}
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	configured := IsConfigured(ExcelFilePath)

	// Check token if provided
	sessionValid := false
	if authHeader := r.Header.Get("Authorization"); strings.HasPrefix(authHeader, "Bearer ") {
		token := strings.TrimPrefix(authHeader, "Bearer ")
		sessionValid = ValidateSessionToken(token)
	}

	json.NewEncoder(w).Encode(AuthStatus{
		Configured:   configured,
		SessionValid: sessionValid,
	})
}

func cleanHash(s string) string {
	s = strings.TrimSpace(s)
	s = strings.Trim(s, "\"\r\n\t ")
	return strings.ToLower(s)
}

func handleAuthVerify(w http.ResponseWriter, r *http.Request) {
	if enableCORS(w, r) {
		return
	}
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ip := getClientIP(r)
	if !pinLimiter.Allow(ip, 100, 15*time.Minute) {
		http.Error(w, `{"error":"Too many attempts. Please wait 15 minutes."}`, http.StatusTooManyRequests)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

	var req struct {
		PinHash  string `json:"pin_hash"`
		AltHash  string `json:"pinHash"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON request"}`, http.StatusBadRequest)
		return
	}

	hashInput := cleanHash(req.PinHash)
	if hashInput == "" {
		hashInput = cleanHash(req.AltHash)
	}

	if hashInput == "" {
		http.Error(w, `{"error":"invalid request: pin_hash required"}`, http.StatusBadRequest)
		return
	}

	rawStored, err := GetPinHash(ExcelFilePath)
	stored := cleanHash(rawStored)
	if err != nil || stored == "" {
		http.Error(w, `{"error":"workspace not configured — set up PIN first"}`, http.StatusUnauthorized)
		return
	}

	if !strings.EqualFold(hashInput, stored) {
		fmt.Printf("[Auth] Verification failed for IP %s (input len %d: %q, stored len %d: %q)\n", ip, len(hashInput), hashInput, len(stored), stored)
		http.Error(w, `{"error":"incorrect PIN"}`, http.StatusUnauthorized)
		return
	}

	token, err := GenerateSessionToken()
	if err != nil {
		http.Error(w, `{"error":"failed to generate session token"}`, http.StatusInternalServerError)
		return
	}
	StoreSessionToken(token)

	fmt.Printf("[Auth] PIN verified — session token issued for %s\n", ip)
	json.NewEncoder(w).Encode(AuthToken{Token: token, ExpiresIn: 86400})
}

// POST /api/auth/setup
// Sets initial PIN — returns 409 Conflict if PIN already configured.
// Body: { "pin_hash": "sha256hex" }
func handleAuthSetup(w http.ResponseWriter, r *http.Request) {
	if enableCORS(w, r) {
		return
	}
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ip := getClientIP(r)
	if !pinLimiter.Allow(ip, 5, 15*time.Minute) {
		http.Error(w, `{"error":"Too many attempts. Please wait 15 minutes."}`, http.StatusTooManyRequests)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

	var req struct {
		PinHash string `json:"pin_hash"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.PinHash == "" {
		http.Error(w, `{"error":"invalid request: pin_hash required"}`, http.StatusBadRequest)
		return
	}

	if err := SetupPin(ExcelFilePath, req.PinHash); err != nil {
		// Already configured
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusConflict)
		return
	}

	// Auto-issue token on first setup
	token, err := GenerateSessionToken()
	if err != nil {
		http.Error(w, `{"error":"PIN saved but failed to generate session token"}`, http.StatusInternalServerError)
		return
	}
	StoreSessionToken(token)

	fmt.Printf("[Auth] Initial PIN setup complete from %s\n", ip)
	json.NewEncoder(w).Encode(AuthToken{Token: token, ExpiresIn: 86400})
}

// GET /api/auth/validate
// Validates a Bearer token. Returns { "valid": bool }.
func handleAuthValidate(w http.ResponseWriter, r *http.Request) {
	if enableCORS(w, r) {
		return
	}
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	authHeader := r.Header.Get("Authorization")
	token := strings.TrimPrefix(authHeader, "Bearer ")
	valid := ValidateSessionToken(token)

	json.NewEncoder(w).Encode(map[string]bool{"valid": valid})
}

// ── Excel Sheets Handler ──────────────────────────────────────────────────────

func handleExcelSheets(w http.ResponseWriter, r *http.Request) {
	if enableCORS(w, r) {
		return
	}
	w.Header().Set("Content-Type", "application/json")

	sheets, err := GetSheetsInfo(ExcelFilePath)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(sheets)
}

// ── Items CRUD Handler ────────────────────────────────────────────────────────

func handleItems(w http.ResponseWriter, r *http.Request) {
	if enableCORS(w, r) {
		return
	}
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case http.MethodGet:
		items, err := GetAllItems(ExcelFilePath)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(items)

	case http.MethodPost:
		var newItem Item
		if err := json.NewDecoder(r.Body).Decode(&newItem); err != nil {
			http.Error(w, `{"error":"invalid JSON body"}`, http.StatusBadRequest)
			return
		}

		if newItem.ID == "" {
			prefix := "NEX"
			prefixMap := map[string]string{
				"projects": "PRJ", "academic": "ACA",
				"events": "EVT", "teams": "TEM", "other": "OTH",
			}
			if val, ok := prefixMap[newItem.Domain]; ok {
				prefix = val
			}
			newItem.ID = fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano()%1000+100)
		}
		now := time.Now().UTC().Format(time.RFC3339)
		if newItem.CreatedAt == "" {
			newItem.CreatedAt = now
		}
		newItem.UpdatedAt = now

		items, err := GetAllItems(ExcelFilePath)
		if err != nil {
			items = []Item{}
		}
		items = append([]Item{newItem}, items...)
		if err := SaveAllItems(ExcelFilePath, items); err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"failed to write Excel: %v"}`, err), http.StatusInternalServerError)
			return
		}

		fmt.Printf("[ExcelStore] Added item %s (%s)\n", newItem.ID, newItem.Domain)
		json.NewEncoder(w).Encode(newItem)

	case http.MethodPut:
		var updatedItem Item
		if err := json.NewDecoder(r.Body).Decode(&updatedItem); err != nil {
			http.Error(w, `{"error":"invalid JSON body"}`, http.StatusBadRequest)
			return
		}
		updatedItem.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

		items, err := GetAllItems(ExcelFilePath)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
			return
		}

		found := false
		for i, item := range items {
			if item.ID == updatedItem.ID {
				items[i] = updatedItem
				found = true
				break
			}
		}
		if !found {
			items = append([]Item{updatedItem}, items...)
		}

		if err := SaveAllItems(ExcelFilePath, items); err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"failed to update Excel: %v"}`, err), http.StatusInternalServerError)
			return
		}

		fmt.Printf("[ExcelStore] Updated item %s\n", updatedItem.ID)
		json.NewEncoder(w).Encode(updatedItem)

	case http.MethodDelete:
		id := r.URL.Query().Get("id")
		if id == "" {
			http.Error(w, `{"error":"missing id query parameter"}`, http.StatusBadRequest)
			return
		}

		items, err := GetAllItems(ExcelFilePath)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
			return
		}

		var filtered []Item
		for _, item := range items {
			if item.ID != id {
				filtered = append(filtered, item)
			}
		}

		if err := SaveAllItems(ExcelFilePath, filtered); err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"failed to delete from Excel: %v"}`, err), http.StatusInternalServerError)
			return
		}

		fmt.Printf("[ExcelStore] Deleted item %s\n", id)
		json.NewEncoder(w).Encode(map[string]string{"status": "deleted", "id": id})

	default:
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
	}
}

// ── Comment Handler ───────────────────────────────────────────────────────────

func handleComment(w http.ResponseWriter, r *http.Request) {
	if enableCORS(w, r) {
		return
	}
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ItemID string `json:"itemId"`
		User   string `json:"user"`
		Text   string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ItemID == "" || req.Text == "" {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	if req.User == "" {
		req.User = "User"
	}

	items, err := GetAllItems(ExcelFilePath)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
		return
	}

	var updatedItem Item
	found := false
	for i, item := range items {
		if item.ID == req.ItemID {
			newLog := ActivityLog{
				ID:   fmt.Sprintf("act-%d", time.Now().UnixNano()),
				User: req.User,
				Time: "Just now",
				Text: req.Text,
			}
			items[i].Activity = append([]ActivityLog{newLog}, items[i].Activity...)
			items[i].UpdatedAt = time.Now().UTC().Format(time.RFC3339)
			updatedItem = items[i]
			found = true
			break
		}
	}
	if !found {
		http.Error(w, `{"error":"item not found"}`, http.StatusNotFound)
		return
	}

	if err := SaveAllItems(ExcelFilePath, items); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(updatedItem)
}

// ── Excel Export / Import ─────────────────────────────────────────────────────

func handleExcelExport(w http.ResponseWriter, r *http.Request) {
	if enableCORS(w, r) {
		return
	}
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, ExcelFilePath))
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	http.ServeFile(w, r, ExcelFilePath)
}

func handleExcelImport(w http.ResponseWriter, r *http.Request) {
	if enableCORS(w, r) {
		return
	}
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, `{"error":"missing file field"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	out, err := os.Create(ExcelFilePath)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to create target file: %v"}`, err), http.StatusInternalServerError)
		return
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to save imported file: %v"}`, err), http.StatusInternalServerError)
		return
	}

	items, err := GetAllItems(ExcelFilePath)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to parse imported excel: %v"}`, err), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "imported",
		"count":  len(items),
		"items":  items,
	})
}

// ── Profile Handler ───────────────────────────────────────────────────────────

func handleProfile(w http.ResponseWriter, r *http.Request) {
	if enableCORS(w, r) {
		return
	}
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case http.MethodGet:
		profile, err := GetProfile(ExcelFilePath)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(profile)

	case http.MethodPut:
		var incoming map[string]string
		if err := json.NewDecoder(r.Body).Decode(&incoming); err != nil {
			http.Error(w, `{"error":"invalid JSON body"}`, http.StatusBadRequest)
			return
		}
		// Do NOT update pin_hash through this endpoint — use /api/profile/pin or /api/auth/setup
		delete(incoming, "pin_hash")

		if err := SaveProfile(ExcelFilePath, incoming); err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
			return
		}
		fmt.Printf("[Profile] Profile updated\n")
		json.NewEncoder(w).Encode(map[string]string{"status": "saved"})

	default:
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
	}
}

// ── PIN Hash Handler (legacy update — requires auth) ─────────────────────────

func handlePinHash(w http.ResponseWriter, r *http.Request) {
	if enableCORS(w, r) {
		return
	}
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ip := getClientIP(r)
	if !pinLimiter.Allow(ip, 10, 15*time.Minute) {
		http.Error(w, `{"error":"Too many PIN attempts. Please wait 15 minutes."}`, http.StatusTooManyRequests)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

	var req struct {
		PinHash string `json:"pinHash"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON body"}`, http.StatusBadRequest)
		return
	}

	if err := SavePinHash(ExcelFilePath, req.PinHash); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
		return
	}

	fmt.Printf("[Profile] PIN hash updated\n")
	json.NewEncoder(w).Encode(map[string]string{"status": "pin_updated"})
}

// ── Assignees Handler ─────────────────────────────────────────────────────────

func handleAssignees(w http.ResponseWriter, r *http.Request) {
	if enableCORS(w, r) {
		return
	}
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case http.MethodGet:
		assignees, err := GetAssignees(ExcelFilePath)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(assignees)

	case http.MethodPut, http.MethodPost:
		var assignees []Assignee
		if err := json.NewDecoder(r.Body).Decode(&assignees); err != nil {
			http.Error(w, `{"error":"invalid JSON body"}`, http.StatusBadRequest)
			return
		}
		if err := SaveAssignees(ExcelFilePath, assignees); err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
			return
		}
		fmt.Printf("[ExcelStore] Saved %d assignees\n", len(assignees))
		json.NewEncoder(w).Encode(assignees)

	default:
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
	}
}
