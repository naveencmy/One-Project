package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"workspace-backend/db"
)

const roleTeamLead = "Team Lead"

// ── In-Memory Session Token Store ────────────────────────────────────────────

type sessionEntry struct {
	token     string
	profileID string
	role      string
	name      string
	expiresAt time.Time
}

var (
	sessionStore = make(map[string]sessionEntry)
)

func GenerateSessionToken() (string, error) {
	u, err := uuid.NewRandom()
	if err != nil {
		return "", err
	}
	return u.String(), nil
}

func StoreSessionToken(token, profileID, role, name string) {
	sessionMu.Lock()
	defer sessionMu.Unlock()
	now := time.Now()
	for k, v := range sessionStore {
		if v.expiresAt.Before(now) {
			delete(sessionStore, k)
		}
	}
	sessionStore[token] = sessionEntry{
		token:     token,
		profileID: profileID,
		role:      role,
		name:      name,
		expiresAt: now.Add(24 * time.Hour),
	}
}

func ValidateSessionToken(token string) bool {
	if token == "" {
		return false
	}
	sessionMu.Lock()
	defer sessionMu.Unlock()
	entry, ok := sessionStore[token]
	if !ok {
		return false
	}
	if entry.expiresAt.Before(time.Now()) {
		delete(sessionStore, token)
		return false
	}
	return true
}

func GetSessionUser(token string) *UserSession {
	if token == "" {
		return nil
	}
	sessionMu.Lock()
	defer sessionMu.Unlock()
	entry, ok := sessionStore[token]
	if !ok {
		return nil
	}
	if entry.expiresAt.Before(time.Now()) {
		delete(sessionStore, token)
		return nil
	}
	return &UserSession{
		ProfileID: entry.profileID,
		Role:      entry.role,
		Name:      entry.name,
	}
}

// ── Items (Tracking Nodes) Store ──────────────────────────────────────────────

func GetAllItems() ([]Item, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if db.Pool == nil {
		return []Item{}, fmt.Errorf("database pool is not initialized")
	}

	query := `
		SELECT id, title, domain, status, metrics, tags, created_at
		FROM tracking_nodes
		ORDER BY created_at DESC
	`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return []Item{}, fmt.Errorf("failed to query tracking_nodes: %w", err)
	}
	defer rows.Close()

	var items []Item
	for rows.Next() {
		var id string
		var title, domain, status string
		var metricsBytes []byte
		var tags []string
		var createdAt time.Time

		if err := rows.Scan(&id, &title, &domain, &status, &metricsBytes, &tags, &createdAt); err != nil {
			log.Printf("Error scanning tracking_node row: %v", err)
			continue
		}

		var item Item
		if len(metricsBytes) > 0 {
			_ = json.Unmarshal(metricsBytes, &item)
		}

		item.ID = id
		item.Title = title
		item.Domain = domain
		item.Status = status
		if tags == nil {
			item.Tags = []string{}
		} else {
			item.Tags = tags
		}
		item.CreatedAt = createdAt.Format(time.RFC3339)
		if item.Activity == nil {
			item.Activity = []ActivityLog{}
		}

		items = append(items, item)
	}

	if items == nil {
		items = []Item{}
	}
	return items, nil
}

func SaveItem(item Item) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}

	if item.ID == "" {
		item.ID = uuid.New().String()
	}

	itemUUID, err := uuid.Parse(item.ID)
	if err != nil {
		itemUUID = uuid.New()
		item.ID = itemUUID.String()
	}

	if item.CreatedAt == "" {
		item.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	}
	item.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	metricsBytes, err := json.Marshal(item)
	if err != nil {
		return fmt.Errorf("failed to marshal item metrics: %w", err)
	}

	query := `
		INSERT INTO tracking_nodes (id, title, domain, status, metrics, tags, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (id) DO UPDATE SET
			title = EXCLUDED.title,
			domain = EXCLUDED.domain,
			status = EXCLUDED.status,
			metrics = EXCLUDED.metrics,
			tags = EXCLUDED.tags
	`

	createdTime, parseErr := time.Parse(time.RFC3339, item.CreatedAt)
	if parseErr != nil {
		createdTime = time.Now().UTC()
	}

	tags := item.Tags
	if tags == nil {
		tags = []string{}
	}

	_, err = db.Pool.Exec(ctx, query, itemUUID, item.Title, item.Domain, item.Status, metricsBytes, tags, createdTime)
	return err
}

func SaveAllItems(items []Item) error {
	for _, item := range items {
		if err := SaveItem(item); err != nil {
			return err
		}
	}
	return nil
}

func DeleteItem(id string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}

	itemUUID, err := uuid.Parse(id)
	if err != nil {
		_, err = db.Pool.Exec(ctx, `DELETE FROM tracking_nodes WHERE metrics->>'id' = $1`, id)
		return err
	}

	_, err = db.Pool.Exec(ctx, `DELETE FROM tracking_nodes WHERE id = $1`, itemUUID)
	return err
}

// ── Profile Data Store ────────────────────────────────────────────────────────

func GetAllProfiles() ([]ProfileData, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if db.Pool == nil {
		return []ProfileData{}, fmt.Errorf("database pool is not initialized")
	}

	query := `
		SELECT profile_id, name, email, role, department, accent_color, pin_hash, updated_at, avatar
		FROM profile_data
		ORDER BY profile_id
	`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return []ProfileData{}, fmt.Errorf("failed to query profile_data: %w", err)
	}
	defer rows.Close()

	var profiles []ProfileData
	for rows.Next() {
		var p ProfileData
		var updatedAt time.Time
		var avatar []string

		if err := rows.Scan(&p.ProfileID, &p.Name, &p.Email, &p.Role, &p.Department, &p.AccentColor, &p.PinHash, &updatedAt, &avatar); err != nil {
			log.Printf("Error scanning profile_data row: %v", err)
			continue
		}

		p.UpdatedAt = updatedAt.Format(time.RFC3339)
		if len(avatar) > 0 {
			p.Avatar = avatar[0]
		}

		profiles = append(profiles, p)
	}

	if profiles == nil {
		profiles = []ProfileData{}
	}
	return profiles, nil
}

func GetProfileList() ([]ProfileListItem, error) {
	profiles, err := GetAllProfiles()
	if err != nil {
		return []ProfileListItem{}, err
	}

	var list []ProfileListItem
	for _, p := range profiles {
		list = append(list, ProfileListItem{
			ProfileID:   p.ProfileID,
			Name:        p.Name,
			Role:        p.Role,
			Avatar:      p.Avatar,
			Department:  p.Department,
			AccentColor: p.AccentColor,
			HasPin:      p.PinHash != "",
		})
	}
	return list, nil
}

func GetProfileByID(profileID string) (*ProfileData, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}

	query := `
		SELECT profile_id, name, email, role, department, accent_color, pin_hash, updated_at, avatar
		FROM profile_data
		WHERE profile_id = $1
	`

	var p ProfileData
	var updatedAt time.Time
	var avatar []string

	err := db.Pool.QueryRow(ctx, query, profileID).Scan(&p.ProfileID, &p.Name, &p.Email, &p.Role, &p.Department, &p.AccentColor, &p.PinHash, &updatedAt, &avatar)
	if err != nil {
		return nil, fmt.Errorf("profile not found: %s (%w)", profileID, err)
	}

	p.UpdatedAt = updatedAt.Format(time.RFC3339)
	if len(avatar) > 0 {
		p.Avatar = avatar[0]
	}

	return &p, nil
}

func SaveProfileByID(profileID string, data map[string]string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}

	cur, err := GetProfileByID(profileID)
	if err != nil {
		return err
	}

	mergeStr := func(key, current string) string {
		if v, ok := data[key]; ok && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
		return current
	}

	name := mergeStr("name", cur.Name)
	role := mergeStr("role", cur.Role)
	email := mergeStr("email", cur.Email)
	dept := mergeStr("department", cur.Department)
	avatarStr := mergeStr("avatar", cur.Avatar)
	accent := mergeStr("accentColor", cur.AccentColor)
	if accent == "" {
		accent = "#5E6AD2"
	}

	avatarArray := []string{}
	if avatarStr != "" {
		avatarArray = []string{avatarStr}
	}

	query := `
		UPDATE profile_data
		SET name = $1, role = $2, email = $3, department = $4, accent_color = $5, avatar = $6, updated_at = NOW()
		WHERE profile_id = $7
	`

	_, err = db.Pool.Exec(ctx, query, name, role, email, dept, accent, avatarArray, profileID)
	return err
}

func SavePinHashByID(profileID, hash string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}

	clean := cleanHash(hash)
	query := `
		UPDATE profile_data
		SET pin_hash = $1, updated_at = NOW()
		WHERE profile_id = $2
	`

	_, err := db.Pool.Exec(ctx, query, clean, profileID)
	if err == nil && profileID == "PROF-001" {
		_ = savePinToEnv(hash)
	}
	return err
}

func AddNewProfile(data map[string]string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if db.Pool == nil {
		return "", fmt.Errorf("database pool is not initialized")
	}

	profiles, _ := GetAllProfiles()
	newID := fmt.Sprintf("PROF-%03d", len(profiles)+1)
	existing := make(map[string]bool)
	for _, p := range profiles {
		existing[p.ProfileID] = true
	}
	counter := len(profiles) + 1
	for existing[newID] {
		counter++
		newID = fmt.Sprintf("PROF-%03d", counter)
	}

	name := strings.TrimSpace(data["name"])
	role := strings.TrimSpace(data["role"])
	email := strings.TrimSpace(data["email"])
	dept := strings.TrimSpace(data["department"])
	avatarStr := strings.TrimSpace(data["avatar"])
	accent := strings.TrimSpace(data["accentColor"])
	if accent == "" {
		accent = "#5E6AD2"
	}
	pinHash := cleanHash(data["pin_hash"])

	avatarArray := []string{}
	if avatarStr != "" {
		avatarArray = []string{avatarStr}
	}

	query := `
		INSERT INTO profile_data (profile_id, name, role, email, department, accent_color, pin_hash, updated_at, avatar)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
	`

	_, err := db.Pool.Exec(ctx, query, newID, name, role, email, dept, accent, pinHash, avatarArray)
	return newID, err
}

func DeleteProfileByID(profileID string) error {
	if profileID == "PROF-001" {
		return fmt.Errorf("cannot delete the Team Lead profile")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}

	_, err := db.Pool.Exec(ctx, `DELETE FROM profile_data WHERE profile_id = $1`, profileID)
	return err
}

// ── Team Roster Store ─────────────────────────────────────────────────────────

func GetAssignees() ([]Assignee, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if db.Pool == nil {
		return []Assignee{}, nil
	}

	query := `SELECT member_name, email, role FROM team_roster ORDER BY created_at`
	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return []Assignee{}, nil
	}
	defer rows.Close()

	var assignees []Assignee
	for rows.Next() {
		var a Assignee
		if err := rows.Scan(&a.Name, &a.Email, &a.Role); err == nil {
			assignees = append(assignees, a)
		}
	}
	if assignees == nil {
		assignees = []Assignee{}
	}
	return assignees, nil
}

func SaveAssignees(assignees []Assignee) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `DELETE FROM team_roster`)
	if err != nil {
		return err
	}

	for _, a := range assignees {
		_, err := tx.Exec(ctx, `INSERT INTO team_roster (member_name, email, role) VALUES ($1, $2, $3)`, a.Name, a.Email, a.Role)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// ── Legacy Helpers & Compatibility ───────────────────────────────────────────

func IsConfigured() bool {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if db.Pool == nil {
		return strings.TrimSpace(loadPinFromEnv()) != ""
	}

	var count int
	err := db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM profile_data WHERE pin_hash IS NOT NULL AND pin_hash != ''").Scan(&count)
	if err == nil && count > 0 {
		return true
	}
	return strings.TrimSpace(loadPinFromEnv()) != ""
}

func GetProfile() (map[string]string, error) {
	p, err := GetProfileByID("PROF-001")
	if err != nil {
		return map[string]string{
			"profile_id":  "PROF-001",
			"name":        "",
			"role":        roleTeamLead,
			"email":       "",
			"department":  "",
			"avatar":      "",
			"accentColor": "#5E6AD2",
			"pin_hash":    loadPinFromEnv(),
		}, nil
	}
	return map[string]string{
		"profile_id":  p.ProfileID,
		"name":        p.Name,
		"role":        p.Role,
		"email":       p.Email,
		"department":  p.Department,
		"avatar":      p.Avatar,
		"accentColor": p.AccentColor,
		"pin_hash":    p.PinHash,
		"updated_at":  p.UpdatedAt,
	}, nil
}

func SaveProfile(data map[string]string) error {
	return SaveProfileByID("PROF-001", data)
}

func GetPinHash() (string, error) {
	p, err := GetProfileByID("PROF-001")
	if err != nil {
		return loadPinFromEnv(), nil
	}
	if p.PinHash != "" {
		return p.PinHash, nil
	}
	return loadPinFromEnv(), nil
}

func SavePinHash(hash string) error {
	return SavePinHashByID("PROF-001", hash)
}

func SetupPin(hash string) error {
	existing, _ := GetPinHash()
	if strings.TrimSpace(existing) != "" {
		return fmt.Errorf("PIN already configured: use verify endpoint to authenticate")
	}
	return SavePinHashByID("PROF-001", hash)
}

func SetupPinForProfile(profileID, hash string) error {
	p, err := GetProfileByID(profileID)
	if err != nil {
		return err
	}
	if strings.TrimSpace(p.PinHash) != "" {
		return fmt.Errorf("PIN already configured for this profile")
	}
	return SavePinHashByID(profileID, hash)
}

func loadPinFromEnv() string {
	clean := func(s string) string {
		s = strings.TrimSpace(s)
		return strings.ToLower(strings.Trim(s, "\"\r\n\t "))
	}

	if envHash := clean(os.Getenv("PIN_HASH")); envHash != "" && envHash != "true" && envHash != "false" {
		return envHash
	}

	for _, path := range []string{".env", "../.env"} {
		if data, err := os.ReadFile(path); err == nil {
			for _, line := range strings.Split(string(data), "\n") {
				line = strings.TrimSpace(line)
				if strings.HasPrefix(line, "PIN_HASH=") {
					val := clean(strings.TrimPrefix(line, "PIN_HASH="))
					if val != "" && val != "true" && val != "false" {
						return val
					}
				}
			}
		}
	}
	return ""
}

func savePinToEnv(hash string) error {
	clean := strings.ToLower(strings.Trim(strings.TrimSpace(hash), "\"\r\n\t "))
	if clean == "" || clean == "true" || clean == "false" {
		return nil
	}
	os.Setenv("PIN_HASH", clean)
	envPath := ".env"
	var newLines []string
	if data, err := os.ReadFile(envPath); err == nil {
		found := false
		for _, line := range strings.Split(string(data), "\n") {
			if strings.HasPrefix(strings.TrimSpace(line), "PIN_HASH=") {
				newLines = append(newLines, fmt.Sprintf("PIN_HASH=%s", clean))
				found = true
			} else {
				newLines = append(newLines, line)
			}
		}
		if !found {
			newLines = append(newLines, fmt.Sprintf("PIN_HASH=%s", clean))
		}
	} else {
		newLines = []string{fmt.Sprintf("PIN_HASH=%s", clean)}
	}
	return os.WriteFile(envPath, []byte(strings.Join(newLines, "\n")), 0644)
}

func GetSheetsInfo() ([]SheetInfo, error) {
	return []SheetInfo{
		{Name: "tracking_nodes", RowCount: 0, ColumnCount: 7, Purpose: "Master index of tracking nodes"},
		{Name: "profile_data", RowCount: 0, ColumnCount: 9, Purpose: "User profile configuration & authentication"},
		{Name: "team_roster", RowCount: 0, ColumnCount: 5, Purpose: "Team member roster & assignees"},
	}, nil
}
