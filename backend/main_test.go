package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"workspace-backend/db"
)

func TestHealthEndpoint(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rr := httptest.NewRecorder()

	handleHealth(rr, req)

	// Since DB pool may not be connected in isolated test without DATABASE_URL,
	// status code will be 200 (if pool reachable) or 503 (service unavailable with JSON error body).
	if rr.Code != http.StatusOK && rr.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status 200 or 503, got %d", rr.Code)
	}

	contentType := rr.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("expected Content-Type application/json, got %s", contentType)
	}
}

func TestAuthStatusEndpoint(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/auth/status", nil)
	rr := httptest.NewRecorder()

	handleAuthStatus(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected status 200 OK, got %d", rr.Code)
	}
}

func TestProfileListEndpoint(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/profiles/list", nil)
	rr := httptest.NewRecorder()

	handleProfileByID(rr, req)

	if rr.Code != http.StatusOK && rr.Code != http.StatusInternalServerError {
		t.Errorf("expected status 200 or 500 for /api/profiles/list, got %d", rr.Code)
	}
}

func TestInspectSchema(t *testing.T) {
	pool, err := db.InitDB()
	if err != nil {
		t.Skipf("DB connection skipped: %v", err)
	}

	rows, err := pool.Query(t.Context(), "SELECT column_name FROM information_schema.columns WHERE table_name = 'profile_data'")
	if err != nil {
		t.Fatalf("Failed to query information_schema: %v", err)
	}
	defer rows.Close()

	var cols []string
	for rows.Next() {
		var col string
		if err := rows.Scan(&col); err == nil {
			cols = append(cols, col)
		}
	}
	t.Logf("Columns in profile_data: %v", cols)

	profiles, err := GetAllProfiles()
	if err != nil {
		t.Fatalf("GetAllProfiles failed: %v", err)
	}
	t.Logf("Retrieved %d profiles from Supabase: %+v", len(profiles), profiles)
}
