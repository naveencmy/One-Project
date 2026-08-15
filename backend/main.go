package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"workspace-backend/db"
)

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
	return "8080"
}

// ── Auth Middleware Helper ────────────────────────────────────────────────────

func extractSessionUser(r *http.Request) *UserSession {
	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return nil
	}
	token := strings.TrimPrefix(authHeader, "Bearer ")
	return GetSessionUser(token)
}

func requireAuth(w http.ResponseWriter, r *http.Request) *UserSession {
	user := extractSessionUser(r)
	if user == nil {
		http.Error(w, `{"error":"unauthorized: valid session token required"}`, http.StatusUnauthorized)
	}
	return user
}

func requireTeamLead(w http.ResponseWriter, r *http.Request) *UserSession {
	user := requireAuth(w, r)
	if user == nil {
		return nil
	}
	if user.Role != roleTeamLead {
		http.Error(w, `{"error":"forbidden: Team Lead access required"}`, http.StatusForbidden)
		return nil
	}
	return user
}

var sessionMu sync.Mutex

func main() {
	if _, err := db.InitDB(); err != nil {
		log.Printf("Warning initializing database connection: %v", err)
	}

	// ── Health check routes ───────────────────────────────────────────────────
	http.HandleFunc("/healthz", handleHealth)
	http.HandleFunc("/api/health", handleHealth)

	// ── Auth routes ──────────────────────────────────────────────────────────
	http.HandleFunc("/api/auth/status", handleAuthStatus)
	http.HandleFunc("/api/auth/verify", handleAuthVerify)
	http.HandleFunc("/api/auth/setup", handleAuthSetup)
	http.HandleFunc("/api/auth/validate", handleAuthValidate)

	// ── Multi-Profile routes ─────────────────────────────────────────────────
	http.HandleFunc("/api/profiles/list", handleProfileList)   // GET  — public
	http.HandleFunc("/api/profiles/create", handleProfileCreate) // POST — Team Lead only
	http.HandleFunc("/api/profiles/", handleProfileByID)       // GET/PUT/DELETE /{id}
	http.HandleFunc("/api/profiles/pin", handleProfilePin)     // PUT  — own profile only

	// ── Legacy single-profile compat ─────────────────────────────────────────
	http.HandleFunc("/api/profile", handleProfile)
	http.HandleFunc("/api/profile/pin", handlePinHash)

	// ── Data routes ──────────────────────────────────────────────────────────
	http.HandleFunc("/api/items", handleItems)
	http.HandleFunc("/api/items/comment", handleComment)
	http.HandleFunc("/api/excel/export", handleExcelExport)
	http.HandleFunc("/api/excel/import", handleExcelImport)
	http.HandleFunc("/api/excel/sheets", handleExcelSheets)
	http.HandleFunc("/api/assignees", handleAssignees)

	port := loadPortFromEnv()

	fmt.Printf("\n⚡ Nexus Go Backend  →  http://localhost:%s\n", port)
	fmt.Printf("🗄️ Database Engine: Supabase PostgreSQL\n")
	fmt.Printf("🔐 PIN Configured: %t\n", IsConfigured())
	fmt.Printf("🛡️  CORS Origin: %s\n\n", os.Getenv("ALLOWED_ORIGIN"))

	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server stopped: %v", err)
	}
}

// ── Health Check Handler ──────────────────────────────────────────────────────

func handleHealth(w http.ResponseWriter, r *http.Request) {
	if enableCORS(w, r) {
		return
	}
	w.Header().Set("Content-Type", "application/json")

	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	if err := db.Ping(ctx); err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":   "error",
			"database": "disconnected",
			"error":    err.Error(),
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   "ok",
		"database": "connected",
		"time":     time.Now().UTC().Format(time.RFC3339),
	})
}

// ── Auth Handlers ─────────────────────────────────────────────────────────────

func handleAuthStatus(w http.ResponseWriter, r *http.Request) {
	if enableCORS(w, r) {
		return
	}
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	configured := IsConfigured()

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
		ProfileID string `json:"profile_id"`
		PinHash   string `json:"pin_hash"`
		AltHash   string `json:"pinHash"`
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

	profileID := strings.TrimSpace(req.ProfileID)
	if profileID == "" {
		profileID = "PROF-001"
	}

	profile, err := GetProfileByID(profileID)
	if err != nil {
		http.Error(w, `{"error":"profile not found"}`, http.StatusUnauthorized)
		return
	}

	storedHash := cleanHash(profile.PinHash)
	if storedHash == "" {
		http.Error(w, `{"error":"PIN not configured for this profile"}`, http.StatusUnauthorized)
		return
	}

	if !strings.EqualFold(hashInput, storedHash) {
		http.Error(w, `{"error":"incorrect PIN"}`, http.StatusUnauthorized)
		return
	}

	token, err := GenerateSessionToken()
	if err != nil {
		http.Error(w, `{"error":"failed to generate session token"}`, http.StatusInternalServerError)
		return
	}
	StoreSessionToken(token, profile.ProfileID, profile.Role, profile.Name)

	json.NewEncoder(w).Encode(AuthToken{
		Token:     token,
		ExpiresIn: 86400,
		ProfileID: profile.ProfileID,
		Role:      profile.Role,
		Name:      profile.Name,
	})
}

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

	if err := SetupPin(req.PinHash); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusConflict)
		return
	}

	profile, _ := GetProfileByID("PROF-001")
	name := ""
	role := roleTeamLead
	if profile != nil {
		name = profile.Name
		role = profile.Role
	}

	token, err := GenerateSessionToken()
	if err != nil {
		http.Error(w, `{"error":"PIN saved but failed to generate session token"}`, http.StatusInternalServerError)
		return
	}
	StoreSessionToken(token, "PROF-001", role, name)

	json.NewEncoder(w).Encode(AuthToken{
		Token:     token,
		ExpiresIn: 86400,
		ProfileID: "PROF-001",
		Role:      role,
		Name:      name,
	})
}

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

	if valid {
		user := GetSessionUser(token)
		if user != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"valid":      true,
				"profile_id": user.ProfileID,
				"role":       user.Role,
				"name":       user.Name,
			})
			return
		}
	}

	json.NewEncoder(w).Encode(map[string]bool{"valid": false})
}

// ── Multi-Profile Handlers ────────────────────────────────────────────────────

func handleProfileList(w http.ResponseWriter, r *http.Request) {
	if enableCORS(w, r) {
		return
	}
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	list, err := GetProfileList()
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
		return
	}
	if list == nil {
		list = []ProfileListItem{}
	}
	json.NewEncoder(w).Encode(list)
}

func handleProfileCreate(w http.ResponseWriter, r *http.Request) {
	if enableCORS(w, r) {
		return
	}
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	user := requireTeamLead(w, r)
	if user == nil {
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	var data map[string]string
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, `{"error":"invalid JSON body"}`, http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(data["name"]) == "" {
		http.Error(w, `{"error":"name is required"}`, http.StatusBadRequest)
		return
	}

	newID, err := AddNewProfile(data)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
		return
	}

	profile, _ := GetProfileByID(newID)
	if profile != nil {
		json.NewEncoder(w).Encode(ProfileListItem{
			ProfileID:   profile.ProfileID,
			Name:        profile.Name,
			Role:        profile.Role,
			Avatar:      profile.Avatar,
			Department:  profile.Department,
			AccentColor: profile.AccentColor,
			HasPin:      profile.PinHash != "",
		})
	} else {
		json.NewEncoder(w).Encode(map[string]string{"status": "created", "profile_id": newID})
	}
}

func handleProfileByID(w http.ResponseWriter, r *http.Request) {
	if enableCORS(w, r) {
		return
	}
	w.Header().Set("Content-Type", "application/json")

	path := strings.TrimPrefix(r.URL.Path, "/api/profiles/")
	switch path {
	case "list":
		handleProfileList(w, r)
		return
	case "create":
		handleProfileCreate(w, r)
		return
	case "pin":
		handleProfilePin(w, r)
		return
	case "":
		http.Error(w, `{"error":"profile_id required in path"}`, http.StatusBadRequest)
		return
	}
	profileID := strings.Split(path, "/")[0]
	if profileID == "" {
		http.Error(w, `{"error":"profile_id required in path"}`, http.StatusBadRequest)
		return
	}

	user := requireAuth(w, r)
	if user == nil {
		return
	}

	switch r.Method {
	case http.MethodGet:
		if user.ProfileID != profileID && user.Role != roleTeamLead {
			http.Error(w, `{"error":"forbidden: you can only view your own profile"}`, http.StatusForbidden)
			return
		}
		profile, err := GetProfileByID(profileID)
		if err != nil {
			http.Error(w, `{"error":"profile not found"}`, http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(map[string]string{
			"profile_id":  profile.ProfileID,
			"name":        profile.Name,
			"role":        profile.Role,
			"email":       profile.Email,
			"department":  profile.Department,
			"avatar":      profile.Avatar,
			"accentColor": profile.AccentColor,
			"updated_at":  profile.UpdatedAt,
		})

	case http.MethodPut:
		if user.ProfileID != profileID && user.Role != roleTeamLead {
			http.Error(w, `{"error":"forbidden: you can only edit your own profile"}`, http.StatusForbidden)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		var data map[string]string
		if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
			http.Error(w, `{"error":"invalid JSON body"}`, http.StatusBadRequest)
			return
		}
		delete(data, "pin_hash")
		delete(data, "pinHash")

		if user.Role != roleTeamLead {
			delete(data, "role")
		}

		if err := SaveProfileByID(profileID, data); err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"status": "saved"})

	case http.MethodDelete:
		if user.Role != roleTeamLead {
			http.Error(w, `{"error":"forbidden: Team Lead access required"}`, http.StatusForbidden)
			return
		}
		if err := DeleteProfileByID(profileID); err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusBadRequest)
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"status": "deleted", "profile_id": profileID})

	default:
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
	}
}

func handleProfilePin(w http.ResponseWriter, r *http.Request) {
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
		ProfileID string `json:"profile_id"`
		PinHash   string `json:"pin_hash"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON body"}`, http.StatusBadRequest)
		return
	}

	if req.PinHash == "" {
		http.Error(w, `{"error":"pin_hash required"}`, http.StatusBadRequest)
		return
	}

	targetProfileID := strings.TrimSpace(req.ProfileID)

	user := extractSessionUser(r)
	if user == nil {
		if targetProfileID == "" {
			targetProfileID = "PROF-001"
		}
		if err := SetupPinForProfile(targetProfileID, req.PinHash); err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusConflict)
			return
		}
		profile, _ := GetProfileByID(targetProfileID)
		name := ""
		role := ""
		if profile != nil {
			name = profile.Name
			role = profile.Role
		}
		token, _ := GenerateSessionToken()
		StoreSessionToken(token, targetProfileID, role, name)
		json.NewEncoder(w).Encode(AuthToken{Token: token, ExpiresIn: 86400, ProfileID: targetProfileID, Role: role, Name: name})
		return
	}

	if targetProfileID == "" {
		targetProfileID = user.ProfileID
	}
	if user.ProfileID != targetProfileID && user.Role != roleTeamLead {
		http.Error(w, `{"error":"forbidden: you can only change your own PIN"}`, http.StatusForbidden)
		return
	}

	if err := SavePinHashByID(targetProfileID, req.PinHash); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "pin_updated", "profile_id": targetProfileID})
}

// ── Sheets Handler ──────────────────────────────────────────────────────────

func handleExcelSheets(w http.ResponseWriter, r *http.Request) {
	if enableCORS(w, r) {
		return
	}
	w.Header().Set("Content-Type", "application/json")

	sheets, err := GetSheetsInfo()
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
		items, err := GetAllItems()
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

		if err := SaveItem(newItem); err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"failed to save item: %v"}`, err), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(newItem)

	case http.MethodPut:
		var updatedItem Item
		if err := json.NewDecoder(r.Body).Decode(&updatedItem); err != nil {
			http.Error(w, `{"error":"invalid JSON body"}`, http.StatusBadRequest)
			return
		}

		if err := SaveItem(updatedItem); err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"failed to update item: %v"}`, err), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(updatedItem)

	case http.MethodDelete:
		id := r.URL.Query().Get("id")
		if id == "" {
			http.Error(w, `{"error":"missing id query parameter"}`, http.StatusBadRequest)
			return
		}

		if err := DeleteItem(id); err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"failed to delete item: %v"}`, err), http.StatusInternalServerError)
			return
		}

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

	items, err := GetAllItems()
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

	if err := SaveItem(updatedItem); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(updatedItem)
}

// ── Import / Export Handlers ──────────────────────────────────────────────────

func handleExcelExport(w http.ResponseWriter, r *http.Request) {
	if enableCORS(w, r) {
		return
	}
	w.Header().Set("Content-Disposition", `attachment; filename="workspace_export.json"`)
	w.Header().Set("Content-Type", "application/json")

	items, err := GetAllItems()
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to export items: %v"}`, err), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(items)
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

	content, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, `{"error":"failed to read file content"}`, http.StatusBadRequest)
		return
	}

	var items []Item
	if err := json.Unmarshal(content, &items); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"invalid JSON items format: %v"}`, err), http.StatusBadRequest)
		return
	}

	if err := SaveAllItems(items); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to save imported items: %v"}`, err), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "imported",
		"count":  len(items),
		"items":  items,
	})
}

// ── Legacy Profile Handler ────────────────────────────────────────────────────

func handleProfile(w http.ResponseWriter, r *http.Request) {
	if enableCORS(w, r) {
		return
	}
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case http.MethodGet:
		profile, err := GetProfile()
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
			return
		}
		delete(profile, "pin_hash")
		json.NewEncoder(w).Encode(profile)

	case http.MethodPut:
		var incoming map[string]string
		if err := json.NewDecoder(r.Body).Decode(&incoming); err != nil {
			http.Error(w, `{"error":"invalid JSON body"}`, http.StatusBadRequest)
			return
		}
		delete(incoming, "pin_hash")

		if err := SaveProfile(incoming); err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"status": "saved"})

	default:
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
	}
}

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

	if err := SavePinHash(req.PinHash); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
		return
	}

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
		assignees, err := GetAssignees()
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
		if err := SaveAssignees(assignees); err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(assignees)

	default:
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
	}
}
