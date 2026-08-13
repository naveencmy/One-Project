package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/xuri/excelize/v2"
)

// ── Mutex & File Path Constants ───────────────────────────────────────────────

var fileMutex sync.Mutex

// workspace_data.xlsx now contains ALL sheets (consolidated)
const SheetCentralNodes = "CentralNodes"
const SheetAcademic     = "AcademicWork"
const SheetEvents        = "EventManagement"
const SheetProductDev    = "ProductDev"
const SheetProfile       = "ProfileData"
const SheetAssignees     = "TeamRoster"

// Legacy sheet name — migrated to CentralNodes on boot
const SheetLegacy = "TrackingNodes"

// profile_data.xlsx is kept for backward compatibility, but ProfileData is
// now the authoritative sheet inside workspace_data.xlsx.
const ProfileExcelFilePath = "profile_data.xlsx"

// roleTeamLead is the canonical role string for the team lead / admin.
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
	sessionMu    sync.Mutex
	sessionStore = make(map[string]sessionEntry) // token → entry
)

// GenerateSessionToken creates a cryptographically secure 32-byte hex token.
func GenerateSessionToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// StoreSessionToken records a token with a 24-hour TTL and associated profile identity.
func StoreSessionToken(token, profileID, role, name string) {
	sessionMu.Lock()
	defer sessionMu.Unlock()
	// Purge expired tokens while we're at it
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

// ValidateSessionToken checks that the token exists and has not expired.
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

// GetSessionUser retrieves the UserSession for a given token (nil if invalid).
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

// ── Bootstrap / Init ──────────────────────────────────────────────────────────

func InitExcelStore(filePath string) error {
	fileMutex.Lock()
	defer fileMutex.Unlock()

	var f *excelize.File

	if _, err := os.Stat(filePath); err != nil {
		// File does not exist — create fresh
		f = excelize.NewFile()
		_ = f.DeleteSheet("Sheet1")
	} else {
		// File exists — open and migrate if necessary
		var openErr error
		f, openErr = excelize.OpenFile(filePath)
		if openErr != nil {
			return fmt.Errorf("failed to open existing workspace: %w", openErr)
		}
		// Migrate legacy TrackingNodes → CentralNodes
		if idx, err := f.GetSheetIndex(SheetLegacy); err == nil && idx >= 0 {
			if cidx, cerr := f.GetSheetIndex(SheetCentralNodes); cerr != nil || cidx < 0 {
				if renameErr := f.SetSheetName(SheetLegacy, SheetCentralNodes); renameErr != nil {
					_ = renameErr
				}
			}
		}
	}
	defer func() { _ = f.Close() }()

	// ── 1. Work Data Excel Workbook (workspace_data.xlsx) ────────────────
	ensureSheet(f, SheetCentralNodes, []string{
		"NodeID", "Domain", "Title", "Status", "Priority",
		"Assignee_JSON", "DueDate", "CreatedAt", "UpdatedAt", "Tags_CSV", "Description",
		"ProjectMetrics_JSON", "AcademicMetrics_JSON", "EventMetrics_JSON",
		"TeamMetrics_JSON", "OtherMetrics_JSON", "Activity_JSON",
	})
	ensureSheet(f, SheetAcademic, []string{
		"NodeID", "CourseName", "Professor", "SubmissionDeadline", "GradeWeight", "Status",
	})
	ensureSheet(f, SheetEvents, []string{
		"NodeID", "EventName", "Venue", "Budget", "Role", "EventDate",
	})
	ensureSheet(f, SheetProductDev, []string{
		"NodeID", "RepositoryURL", "TechStack", "SprintCycle", "DeploymentURL",
	})
	ensureSheet(f, SheetAssignees, []string{
		"Name", "Email", "Role", "Avatar",
	})

	// Apply bold header style to CentralNodes row 1
	style, err := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "#FFFFFF"},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#151516"}, Pattern: 1},
	})
	if err == nil {
		_ = f.SetRowStyle(SheetCentralNodes, 1, 1, style)
	}

	if err := f.SaveAs(filePath); err != nil {
		return fmt.Errorf("failed to save work workspace: %w", err)
	}

	// ── 2. Profile & Authentication Excel Workbook (profile_data.xlsx) ───
	if err := initProfileExcel(); err != nil {
		_ = err
	}

	return nil
}

// initProfileExcel ensures profile_data.xlsx exists with correct headers and
// at least one Team Lead row. It migrates the legacy single-row format to the
// new multi-row format if needed.
func initProfileExcel() error {
	profilePath := getProfilePath()
	var pf *excelize.File

	if _, err := os.Stat(profilePath); err != nil {
		pf = excelize.NewFile()
		_ = pf.DeleteSheet("Sheet1")
	} else {
		var openErr error
		pf, openErr = excelize.OpenFile(profilePath)
		if openErr != nil {
			pf = excelize.NewFile()
			_ = pf.DeleteSheet("Sheet1")
		}
	}
	defer func() { _ = pf.Close() }()

	// Ensure ProfileData sheet exists with correct headers
	profHeaders := []string{"ProfileID", "Name", "Role", "Email", "Department", "Avatar", "AccentColor", "PinHash", "UpdatedAt"}
	pidx, _ := pf.GetSheetIndex(SheetProfile)
	if pidx < 0 {
		newPidx, _ := pf.NewSheet(SheetProfile)
		pf.SetActiveSheet(newPidx)
	}
	// Always write headers to ensure correct column order
	for colIdx, h := range profHeaders {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		pf.SetCellValue(SheetProfile, cell, h)
	}

	// Check if row 2 exists (Team Lead)
	existingID, _ := pf.GetCellValue(SheetProfile, "A2")
	if strings.TrimSpace(existingID) == "" {
		// No Team Lead row — create one with legacy PIN migration
		seedPin := loadPinFromEnv()
		pf.SetCellValue(SheetProfile, "A2", "PROF-001")
		pf.SetCellValue(SheetProfile, "C2", roleTeamLead)
		pf.SetCellValue(SheetProfile, "G2", "#5E6AD2")
		if seedPin != "" {
			pf.SetCellValue(SheetProfile, "H2", seedPin)
		}
		pf.SetCellValue(SheetProfile, "I2", time.Now().UTC().Format(time.RFC3339))
	} else {
		// Row 2 exists — migrate legacy schema if needed (detect by checking A1)
		a1, _ := pf.GetCellValue(SheetProfile, "A1")
		if strings.EqualFold(strings.TrimSpace(a1), "Name") {
			// Legacy 7-column schema — migrate to 9-column
			name, _ := pf.GetCellValue(SheetProfile, "A2")
			role, _ := pf.GetCellValue(SheetProfile, "B2")
			email, _ := pf.GetCellValue(SheetProfile, "C2")
			dept, _ := pf.GetCellValue(SheetProfile, "D2")
			avatar, _ := pf.GetCellValue(SheetProfile, "E2")
			accent, _ := pf.GetCellValue(SheetProfile, "F2")
			pin, _ := pf.GetCellValue(SheetProfile, "G2")

			// Write headers
			for colIdx, h := range profHeaders {
				cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
				pf.SetCellValue(SheetProfile, cell, h)
			}
			// Rewrite row 2 in new format
			pf.SetCellValue(SheetProfile, "A2", "PROF-001")
			pf.SetCellValue(SheetProfile, "B2", strings.TrimSpace(name))
			pf.SetCellValue(SheetProfile, "C2", strings.TrimSpace(role))
			pf.SetCellValue(SheetProfile, "D2", strings.TrimSpace(email))
			pf.SetCellValue(SheetProfile, "E2", strings.TrimSpace(dept))
			pf.SetCellValue(SheetProfile, "F2", strings.TrimSpace(avatar))
			pf.SetCellValue(SheetProfile, "G2", strings.TrimSpace(accent))
			pinClean := cleanHash(pin)
			if pinClean == "" || pinClean == "true" || pinClean == "false" {
				pinClean = loadPinFromEnv()
			}
			if pinClean != "" {
				pf.SetCellValue(SheetProfile, "H2", pinClean)
			}
			pf.SetCellValue(SheetProfile, "I2", time.Now().UTC().Format(time.RFC3339))
		} else {
			// Ensure PROF-001 ID is set if missing
			if strings.TrimSpace(existingID) == "" || existingID == "PROF-001" {
				pf.SetCellValue(SheetProfile, "A2", "PROF-001")
			}
			// Seed pin from env if pin cell is empty
			pinCell, _ := pf.GetCellValue(SheetProfile, "H2")
			if strings.TrimSpace(pinCell) == "" || pinCell == "true" || pinCell == "false" {
				if envPin := loadPinFromEnv(); envPin != "" {
					pf.SetCellValue(SheetProfile, "H2", envPin)
				}
			}
		}
	}

	if err := pf.SaveAs(profilePath); err != nil {
		return fmt.Errorf("failed to save profile Excel: %w", err)
	}

	return nil
}

// ensureSheet creates a sheet with headers only if it does not already exist.
func ensureSheet(f *excelize.File, name string, headers []string) {
	idx, err := f.GetSheetIndex(name)
	if err != nil || idx < 0 {
		newIdx, createErr := f.NewSheet(name)
		if createErr != nil {
			return
		}
		_ = newIdx
		for colIdx, h := range headers {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
			f.SetCellValue(name, cell, h)
		}
	}
}

// ── Item Row Writers ──────────────────────────────────────────────────────────

func writeItemRow(f *excelize.File, row int, item Item) {
	assigneeJSON, _ := json.Marshal(item.Assignee)
	tagsCSV := strings.Join(item.Tags, ",")
	projJSON, _ := json.Marshal(item.ProjectMetrics)
	acadJSON, _ := json.Marshal(item.AcademicMetrics)
	evtJSON, _ := json.Marshal(item.EventMetrics)
	teamJSON, _ := json.Marshal(item.TeamMetrics)
	othJSON, _ := json.Marshal(item.OtherMetrics)
	actJSON, _ := json.Marshal(item.Activity)

	if item.UpdatedAt == "" {
		item.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	}

	values := []interface{}{
		item.ID,
		item.Domain,
		item.Title,
		item.Status,
		item.Priority,
		string(assigneeJSON),
		item.DueDate,
		item.CreatedAt,
		item.UpdatedAt,
		tagsCSV,
		item.Description,
		string(projJSON),
		string(acadJSON),
		string(evtJSON),
		string(teamJSON),
		string(othJSON),
		string(actJSON),
	}

	for colIdx, val := range values {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, row)
		f.SetCellValue(SheetCentralNodes, cell, val)
	}
}

// writeDomainRow routes each item to its domain-specific sub-sheet.
func writeDomainRow(f *excelize.File, item Item, domainRowMap map[string]int) {
	switch item.Domain {
	case "academic":
		row := domainRowMap["academic"]
		courseName := ""
		professor := ""
		gradeWeight := ""
		if item.AcademicMetrics != nil {
			courseName = item.AcademicMetrics.PaperTitle
			professor = item.AcademicMetrics.AdvisorFeedback
			gradeWeight = item.AcademicMetrics.GradingScale
		}
		vals := []interface{}{item.ID, courseName, professor, item.DueDate, gradeWeight, item.Status}
		for ci, v := range vals {
			cell, _ := excelize.CoordinatesToCellName(ci+1, row)
			f.SetCellValue(SheetAcademic, cell, v)
		}
		domainRowMap["academic"]++

	case "events":
		row := domainRowMap["events"]
		venue := ""
		budget := ""
		role := ""
		if item.EventMetrics != nil {
			venue = item.EventMetrics.LocationType
			budget = item.EventMetrics.EventType
			role = item.EventMetrics.LocationCoordinates
		}
		vals := []interface{}{item.ID, item.Title, venue, budget, role, item.DueDate}
		for ci, v := range vals {
			cell, _ := excelize.CoordinatesToCellName(ci+1, row)
			f.SetCellValue(SheetEvents, cell, v)
		}
		domainRowMap["events"]++

	case "projects":
		row := domainRowMap["projects"]
		repoURL := ""
		techStack := ""
		sprintCycle := ""
		deployURL := ""
		if item.ProjectMetrics != nil {
			repoURL = item.ProjectMetrics.RepoUrl
			techStack = item.ProjectMetrics.BuildStatus
			sprintCycle = item.ProjectMetrics.RepoBranch
			deployURL = item.ProjectMetrics.TargetRelease
		}
		vals := []interface{}{item.ID, repoURL, techStack, sprintCycle, deployURL}
		for ci, v := range vals {
			cell, _ := excelize.CoordinatesToCellName(ci+1, row)
			f.SetCellValue(SheetProductDev, cell, v)
		}
		domainRowMap["projects"]++
	}
}

// ── GetAllItems ───────────────────────────────────────────────────────────────

func GetAllItems(filePath string) ([]Item, error) {
	fileMutex.Lock()
	defer fileMutex.Unlock()

	f, err := excelize.OpenFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open excel file: %w", err)
	}
	defer f.Close()

	// Try CentralNodes first, fall back to legacy TrackingNodes
	sheetName := SheetCentralNodes
	if idx, err2 := f.GetSheetIndex(SheetCentralNodes); err2 != nil || idx < 0 {
		sheetName = SheetLegacy
	}

	rows, err := f.GetRows(sheetName)
	if err != nil {
		return nil, fmt.Errorf("failed to read sheet %s: %w", sheetName, err)
	}

	var items []Item
	if len(rows) <= 1 {
		return items, nil
	}

	for i := 1; i < len(rows); i++ {
		row := rows[i]
		if len(row) == 0 || row[0] == "" {
			continue
		}

		item := Item{
			ID:          getCol(row, 0),
			Domain:      getCol(row, 1),
			Title:       getCol(row, 2),
			Status:      getCol(row, 3),
			Priority:    getCol(row, 4),
			DueDate:     getCol(row, 6),
			CreatedAt:   getCol(row, 7),
			UpdatedAt:   getCol(row, 8),
			Description: getCol(row, 10),
		}

		// Tags at col 9
		if tagsStr := getCol(row, 9); tagsStr != "" {
			item.Tags = strings.Split(tagsStr, ",")
		} else {
			item.Tags = []string{}
		}

		if assnStr := getCol(row, 5); assnStr != "" && assnStr != "null" {
			var assn Assignee
			if err := json.Unmarshal([]byte(assnStr), &assn); err == nil {
				item.Assignee = &assn
			}
		}
		if projStr := getCol(row, 11); projStr != "" && projStr != "null" {
			var pm ProjectMetrics
			if err := json.Unmarshal([]byte(projStr), &pm); err == nil {
				item.ProjectMetrics = &pm
			}
		}
		if acadStr := getCol(row, 12); acadStr != "" && acadStr != "null" {
			var am AcademicMetrics
			if err := json.Unmarshal([]byte(acadStr), &am); err == nil {
				item.AcademicMetrics = &am
			}
		}
		if evtStr := getCol(row, 13); evtStr != "" && evtStr != "null" {
			var em EventMetrics
			if err := json.Unmarshal([]byte(evtStr), &em); err == nil {
				item.EventMetrics = &em
			}
		}
		if teamStr := getCol(row, 14); teamStr != "" && teamStr != "null" {
			var tm TeamMetrics
			if err := json.Unmarshal([]byte(teamStr), &tm); err == nil {
				item.TeamMetrics = &tm
			}
		}
		if othStr := getCol(row, 15); othStr != "" && othStr != "null" {
			var om OtherMetrics
			if err := json.Unmarshal([]byte(othStr), &om); err == nil {
				item.OtherMetrics = &om
			}
		}
		if actStr := getCol(row, 16); actStr != "" && actStr != "null" {
			var act []ActivityLog
			if err := json.Unmarshal([]byte(actStr), &act); err == nil {
				item.Activity = act
			} else {
				item.Activity = []ActivityLog{}
			}
		} else {
			item.Activity = []ActivityLog{}
		}

		items = append(items, item)
	}
	return items, nil
}

// ── SaveAllItems — Open-Modify-Save (preserves all other sheets) ──────────────

func SaveAllItems(filePath string, items []Item) error {
	fileMutex.Lock()
	defer fileMutex.Unlock()

	f, err := excelize.OpenFile(filePath)
	if err != nil {
		// If the file cannot be opened, fall back to creating it fresh
		f = excelize.NewFile()
		_ = f.DeleteSheet("Sheet1")
	}
	defer func() { _ = f.Close() }()

	// Ensure CentralNodes exists
	ensureSheet(f, SheetCentralNodes, []string{
		"NodeID", "Domain", "Title", "Status", "Priority",
		"Assignee_JSON", "DueDate", "CreatedAt", "UpdatedAt", "Tags_CSV", "Description",
		"ProjectMetrics_JSON", "AcademicMetrics_JSON", "EventMetrics_JSON",
		"TeamMetrics_JSON", "OtherMetrics_JSON", "Activity_JSON",
	})

	// Clear existing data rows in CentralNodes (keep header row 1)
	rows, _ := f.GetRows(SheetCentralNodes)
	for i := 1; i < len(rows); i++ {
		rowNum := i + 1
		for col := 1; col <= 17; col++ {
			cell, _ := excelize.CoordinatesToCellName(col, rowNum)
			_ = f.SetCellValue(SheetCentralNodes, cell, "")
		}
	}

	// Clear domain sub-sheet data rows (keep header row 1)
	for _, sheet := range []string{SheetAcademic, SheetEvents, SheetProductDev} {
		ensureSheet(f, sheet, domainHeaders(sheet))
		drows, _ := f.GetRows(sheet)
		for i := 1; i < len(drows); i++ {
			rowNum := i + 1
			for col := 1; col <= 6; col++ {
				cell, _ := excelize.CoordinatesToCellName(col, rowNum)
				_ = f.SetCellValue(sheet, cell, "")
			}
		}
	}

	// Domain row counters (start at row 2 for each sub-sheet)
	domainRowMap := map[string]int{
		"academic": 2,
		"events":   2,
		"projects": 2,
	}

	// Write all items
	for i, item := range items {
		writeItemRow(f, i+2, item)
		writeDomainRow(f, item, domainRowMap)
	}

	return f.SaveAs(filePath)
}

func domainHeaders(sheet string) []string {
	switch sheet {
	case SheetAcademic:
		return []string{"NodeID", "CourseName", "Professor", "SubmissionDeadline", "GradeWeight", "Status"}
	case SheetEvents:
		return []string{"NodeID", "EventName", "Venue", "Budget", "Role", "EventDate"}
	case SheetProductDev:
		return []string{"NodeID", "RepositoryURL", "TechStack", "SprintCycle", "DeploymentURL"}
	default:
		return []string{}
	}
}

// ── Multi-Profile CRUD ────────────────────────────────────────────────────────

// getAllProfilesInternal reads all profile rows WITHOUT acquiring the mutex.
// Caller must hold fileMutex or not require thread-safety (e.g., during init).
func getAllProfilesInternal(profilePath string) ([]ProfileData, error) {
	f, err := excelize.OpenFile(profilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open profile excel: %w", err)
	}
	defer f.Close()

	rows, err := f.GetRows(SheetProfile)
	if err != nil || len(rows) <= 1 {
		return nil, nil
	}

	// Detect schema: legacy (Name in A1) vs new (ProfileID in A1)
	isLegacy := strings.EqualFold(strings.TrimSpace(rows[0][0]), "Name")

	var profiles []ProfileData
	for i := 1; i < len(rows); i++ {
		row := rows[i]
		if len(row) == 0 || strings.TrimSpace(getCol(row, 0)) == "" {
			continue
		}

		var p ProfileData
		if isLegacy {
			p = ProfileData{
				ProfileID:   "PROF-001",
				Name:        getCol(row, 0),
				Role:        getCol(row, 1),
				Email:       getCol(row, 2),
				Department:  getCol(row, 3),
				Avatar:      getCol(row, 4),
				AccentColor: getCol(row, 5),
				PinHash:     cleanHash(getCol(row, 6)),
			}
		} else {
			// New 9-column schema: ProfileID|Name|Role|Email|Department|Avatar|AccentColor|PinHash|UpdatedAt
			p = ProfileData{
				ProfileID:   getCol(row, 0),
				Name:        getCol(row, 1),
				Role:        getCol(row, 2),
				Email:       getCol(row, 3),
				Department:  getCol(row, 4),
				Avatar:      getCol(row, 5),
				AccentColor: getCol(row, 6),
				PinHash:     cleanHash(getCol(row, 7)),
				UpdatedAt:   getCol(row, 8),
			}
		}

		// Fallback pin from env for Team Lead (PROF-001) if hash is empty
		if p.PinHash == "" && p.ProfileID == "PROF-001" {
			p.PinHash = loadPinFromEnv()
		}
		if p.AccentColor == "" {
			p.AccentColor = "#5E6AD2"
		}
		if p.Role == "" && p.ProfileID == "PROF-001" {
			p.Role = roleTeamLead
		}

		profiles = append(profiles, p)
	}
	return profiles, nil
}

// GetAllProfiles returns all profiles with pin hashes (internal use only — never send to frontend).
func GetAllProfiles() ([]ProfileData, error) {
	fileMutex.Lock()
	defer fileMutex.Unlock()
	return getAllProfilesInternal(getProfilePath())
}

// GetProfileList returns the safe public list for the profile picker (no PIN hashes).
func GetProfileList() ([]ProfileListItem, error) {
	fileMutex.Lock()
	defer fileMutex.Unlock()

	profiles, err := getAllProfilesInternal(getProfilePath())
	if err != nil {
		return nil, err
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

// GetProfileByID returns a single profile by its ProfileID (with pin hash, internal use).
func GetProfileByID(profileID string) (*ProfileData, error) {
	fileMutex.Lock()
	defer fileMutex.Unlock()

	profiles, err := getAllProfilesInternal(getProfilePath())
	if err != nil {
		return nil, err
	}
	for _, p := range profiles {
		if p.ProfileID == profileID {
			cp := p
			return &cp, nil
		}
	}
	return nil, fmt.Errorf("profile not found: %s", profileID)
}

// SaveProfileByID updates a specific profile row in profile_data.xlsx.
// Only fields that are non-empty in `data` are updated (merge semantics).
func SaveProfileByID(profileID string, data map[string]string) error {
	fileMutex.Lock()
	defer fileMutex.Unlock()

	profilePath := getProfilePath()
	f, err := excelize.OpenFile(profilePath)
	if err != nil {
		return fmt.Errorf("failed to open profile excel: %w", err)
	}
	defer func() { _ = f.Close() }()

	rows, err := f.GetRows(SheetProfile)
	if err != nil {
		return fmt.Errorf("failed to read ProfileData sheet: %w", err)
	}

	targetRow := -1
	for i := 1; i < len(rows); i++ {
		if getCol(rows[i], 0) == profileID {
			targetRow = i + 1 // 1-indexed Excel row
			break
		}
	}
	if targetRow < 0 {
		return fmt.Errorf("profile not found: %s", profileID)
	}

	// Read existing values for merge
	existing, _ := getAllProfilesInternal(profilePath)
	var cur ProfileData
	for _, p := range existing {
		if p.ProfileID == profileID {
			cur = p
			break
		}
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
	avatar := mergeStr("avatar", cur.Avatar)
	accent := mergeStr("accentColor", cur.AccentColor)
	if accent == "" {
		accent = "#5E6AD2"
	}

	rowStr := fmt.Sprintf("%d", targetRow)
	f.SetCellValue(SheetProfile, "A"+rowStr, profileID)
	f.SetCellValue(SheetProfile, "B"+rowStr, name)
	f.SetCellValue(SheetProfile, "C"+rowStr, role)
	f.SetCellValue(SheetProfile, "D"+rowStr, email)
	f.SetCellValue(SheetProfile, "E"+rowStr, dept)
	f.SetCellValue(SheetProfile, "F"+rowStr, avatar)
	f.SetCellValue(SheetProfile, "G"+rowStr, accent)
	// PinHash is NOT updated here — use SavePinHashByID
	f.SetCellValue(SheetProfile, "H"+rowStr, cur.PinHash)
	f.SetCellValue(SheetProfile, "I"+rowStr, time.Now().UTC().Format(time.RFC3339))

	return f.SaveAs(profilePath)
}

// SavePinHashByID sets the PIN hash for a specific profile.
func SavePinHashByID(profileID, hash string) error {
	fileMutex.Lock()
	defer fileMutex.Unlock()

	profilePath := getProfilePath()
	f, err := excelize.OpenFile(profilePath)
	if err != nil {
		return fmt.Errorf("failed to open profile excel: %w", err)
	}
	defer func() { _ = f.Close() }()

	rows, err := f.GetRows(SheetProfile)
	if err != nil {
		return fmt.Errorf("failed to read ProfileData sheet: %w", err)
	}

	targetRow := -1
	for i := 1; i < len(rows); i++ {
		if getCol(rows[i], 0) == profileID {
			targetRow = i + 1
			break
		}
	}
	if targetRow < 0 {
		return fmt.Errorf("profile not found: %s", profileID)
	}

	rowStr := fmt.Sprintf("%d", targetRow)
	f.SetCellValue(SheetProfile, "H"+rowStr, cleanHash(hash))
	f.SetCellValue(SheetProfile, "I"+rowStr, time.Now().UTC().Format(time.RFC3339))

	// Also update Team Lead PIN in env for backward compat
	if profileID == "PROF-001" {
		_ = savePinToEnv(hash)
	}

	return f.SaveAs(profilePath)
}

// AddNewProfile appends a new profile row and returns the generated ProfileID.
func AddNewProfile(data map[string]string) (string, error) {
	fileMutex.Lock()
	defer fileMutex.Unlock()

	profilePath := getProfilePath()
	f, err := excelize.OpenFile(profilePath)
	if err != nil {
		return "", fmt.Errorf("failed to open profile excel: %w", err)
	}
	defer func() { _ = f.Close() }()

	rows, err := f.GetRows(SheetProfile)
	if err != nil {
		return "", fmt.Errorf("failed to read ProfileData sheet: %w", err)
	}

	// Generate a unique ProfileID
	newID := fmt.Sprintf("PROF-%03d", len(rows)) // e.g. PROF-003
	// Ensure uniqueness
	existing := make(map[string]bool)
	for i := 1; i < len(rows); i++ {
		existing[getCol(rows[i], 0)] = true
	}
	counter := len(rows)
	for existing[newID] {
		counter++
		newID = fmt.Sprintf("PROF-%03d", counter)
	}

	newRow := len(rows) + 1 // next empty row
	rowStr := fmt.Sprintf("%d", newRow)

	name := strings.TrimSpace(data["name"])
	role := strings.TrimSpace(data["role"])
	email := strings.TrimSpace(data["email"])
	dept := strings.TrimSpace(data["department"])
	avatar := strings.TrimSpace(data["avatar"])
	accent := strings.TrimSpace(data["accentColor"])
	if accent == "" {
		accent = "#5E6AD2"
	}
	pinHash := cleanHash(data["pin_hash"])

	f.SetCellValue(SheetProfile, "A"+rowStr, newID)
	f.SetCellValue(SheetProfile, "B"+rowStr, name)
	f.SetCellValue(SheetProfile, "C"+rowStr, role)
	f.SetCellValue(SheetProfile, "D"+rowStr, email)
	f.SetCellValue(SheetProfile, "E"+rowStr, dept)
	f.SetCellValue(SheetProfile, "F"+rowStr, avatar)
	f.SetCellValue(SheetProfile, "G"+rowStr, accent)
	f.SetCellValue(SheetProfile, "H"+rowStr, pinHash)
	f.SetCellValue(SheetProfile, "I"+rowStr, time.Now().UTC().Format(time.RFC3339))

	return newID, f.SaveAs(profilePath)
}

// DeleteProfileByID removes a profile row (cannot delete PROF-001 Team Lead).
func DeleteProfileByID(profileID string) error {
	if profileID == "PROF-001" {
		return fmt.Errorf("cannot delete the Team Lead profile")
	}

	fileMutex.Lock()
	defer fileMutex.Unlock()

	profilePath := getProfilePath()
	f, err := excelize.OpenFile(profilePath)
	if err != nil {
		return fmt.Errorf("failed to open profile excel: %w", err)
	}
	defer func() { _ = f.Close() }()

	rows, err := f.GetRows(SheetProfile)
	if err != nil {
		return fmt.Errorf("failed to read ProfileData sheet: %w", err)
	}

	targetRow := -1
	for i := 1; i < len(rows); i++ {
		if getCol(rows[i], 0) == profileID {
			targetRow = i + 1
			break
		}
	}
	if targetRow < 0 {
		return fmt.Errorf("profile not found: %s", profileID)
	}

	if err := f.RemoveRow(SheetProfile, targetRow); err != nil {
		return fmt.Errorf("failed to remove row: %w", err)
	}

	return f.SaveAs(profilePath)
}

// ── Legacy single-profile compat helpers ──────────────────────────────────────

// IsConfigured returns true if at least one profile has a PIN hash configured.
func IsConfigured(filePath string) bool {
	profiles, err := GetAllProfiles()
	if err != nil || len(profiles) == 0 {
		return false
	}
	// We consider configured if Team Lead (PROF-001) has a PIN
	for _, p := range profiles {
		if p.ProfileID == "PROF-001" {
			return strings.TrimSpace(p.PinHash) != ""
		}
	}
	return false
}

// GetProfile returns Team Lead profile as a map (backward compat for old /api/profile endpoint).
func GetProfile(filePath string) (map[string]string, error) {
	p, err := GetProfileByID("PROF-001")
	if err != nil {
		// Return defaults
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

// SaveProfile updates Team Lead profile (backward compat).
func SaveProfile(filePath string, data map[string]string) error {
	return SaveProfileByID("PROF-001", data)
}

// GetPinHash returns Team Lead PIN hash (backward compat).
func GetPinHash(filePath string) (string, error) {
	p, err := GetProfileByID("PROF-001")
	if err != nil {
		return loadPinFromEnv(), nil
	}
	if p.PinHash != "" {
		return p.PinHash, nil
	}
	return loadPinFromEnv(), nil
}

// SavePinHash sets Team Lead PIN hash (backward compat).
func SavePinHash(filePath string, hash string) error {
	return SavePinHashByID("PROF-001", hash)
}

// SetupPin sets a PIN for PROF-001 only if not yet configured.
func SetupPin(filePath string, hash string) error {
	existing, _ := GetPinHash(filePath)
	if strings.TrimSpace(existing) != "" {
		return fmt.Errorf("PIN already configured: use verify endpoint to authenticate")
	}
	return SavePinHashByID("PROF-001", hash)
}

// SetupPinForProfile sets a PIN for a specific profile only if not yet configured.
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

// ── Env Helpers ───────────────────────────────────────────────────────────────

func loadPinFromEnv() string {
	clean := func(s string) string {
		s = strings.TrimSpace(s)
		return strings.ToLower(strings.Trim(s, "\"\r\n\t "))
	}

	if envHash := clean(os.Getenv("PIN_HASH")); envHash != "" && envHash != "true" && envHash != "false" {
		return envHash
	}

	checkFile := func(path string) string {
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
		return ""
	}

	if h := checkFile(".env"); h != "" {
		return h
	}
	if h := checkFile("../.env"); h != "" {
		return h
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

func getProfilePath() string {
	if p := os.Getenv("PROFILE_EXCEL_FILE_PATH"); p != "" {
		return p
	}
	return ProfileExcelFilePath
}

// ── Sheet Info Inspector ──────────────────────────────────────────────────────

func GetSheetsInfo(filePath string) ([]SheetInfo, error) {
	fileMutex.Lock()
	defer fileMutex.Unlock()

	purposes := map[string]string{
		SheetCentralNodes: "Master index of all work tracking nodes with domain metrics & activity logs",
		SheetAcademic:     "Academic work details: courses, professors, submission deadlines & grade weights",
		SheetEvents:       "Event management: venue, budget, roles & event dates",
		SheetProductDev:   "Product development: repository, tech stack, sprint cycles & deployment",
		SheetAssignees:    "Team member roster & assignee directory",
		SheetProfile:      "User profile configuration, preferences & SHA-256 PIN hash (multi-user)",
		SheetLegacy:       "Legacy tracking nodes (migrated to CentralNodes on first boot)",
	}

	var infos []SheetInfo
	if f, err := excelize.OpenFile(filePath); err == nil {
		for _, sheet := range f.GetSheetList() {
			rows, _ := f.GetRows(sheet)
			rowCount, colCount := 0, 0
			var headers []string
			if len(rows) > 0 {
				rowCount = len(rows) - 1
				headers = rows[0]
				colCount = len(headers)
			}
			infos = append(infos, SheetInfo{
				Name:        sheet,
				RowCount:    rowCount,
				ColumnCount: colCount,
				Headers:     headers,
				Purpose:     purposes[sheet],
			})
		}
		_ = f.Close()
	}
	return infos, nil
}

// ── TeamRoster CRUD ───────────────────────────────────────────────────────────

func GetAssignees(filePath string) ([]Assignee, error) {
	fileMutex.Lock()
	defer fileMutex.Unlock()

	f, err := excelize.OpenFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open excel file: %w", err)
	}
	defer f.Close()

	rows, err := f.GetRows(SheetAssignees)
	if err != nil || len(rows) <= 1 {
		return []Assignee{}, nil
	}

	var assignees []Assignee
	for i := 1; i < len(rows); i++ {
		row := rows[i]
		if len(row) == 0 || row[0] == "" {
			continue
		}
		assignees = append(assignees, Assignee{
			Name:   getCol(row, 0),
			Email:  getCol(row, 1),
			Role:   getCol(row, 2),
			Avatar: getCol(row, 3),
		})
	}
	return assignees, nil
}

func SaveAssignees(filePath string, assignees []Assignee) error {
	fileMutex.Lock()
	defer fileMutex.Unlock()

	f, err := excelize.OpenFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to open excel file: %w", err)
	}
	defer func() { _ = f.Close() }()

	ensureSheet(f, SheetAssignees, []string{"Name", "Email", "Role", "Avatar"})

	// Clear existing rows
	existingRows, _ := f.GetRows(SheetAssignees)
	for i := 1; i < len(existingRows); i++ {
		for col := 1; col <= 4; col++ {
			cell, _ := excelize.CoordinatesToCellName(col, i+1)
			_ = f.SetCellValue(SheetAssignees, cell, "")
		}
	}

	for i, a := range assignees {
		row := i + 2
		f.SetCellValue(SheetAssignees, fmt.Sprintf("A%d", row), a.Name)
		f.SetCellValue(SheetAssignees, fmt.Sprintf("B%d", row), a.Email)
		f.SetCellValue(SheetAssignees, fmt.Sprintf("C%d", row), a.Role)
		f.SetCellValue(SheetAssignees, fmt.Sprintf("D%d", row), a.Avatar)
	}

	return f.SaveAs(filePath)
}

// ── Misc Helpers ──────────────────────────────────────────────────────────────

func GetInitialSeedItems() []Item { return []Item{} }

func getCol(row []string, idx int) string {
	if idx < len(row) {
		return strings.TrimSpace(row[idx])
	}
	return ""
}
