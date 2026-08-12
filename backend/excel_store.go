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

// ── In-Memory Session Token Store ────────────────────────────────────────────

type sessionEntry struct {
	token     string
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

// StoreSessionToken records a token with a 24-hour TTL.
func StoreSessionToken(token string) {
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

// ── Bootstrap / Init ──────────────────────────────────────────────────────────

func InitExcelStore(filePath string) error {
	fileMutex.Lock()
	defer fileMutex.Unlock()

	var f *excelize.File

	if _, err := os.Stat(filePath); err != nil {
		// File does not exist — create fresh
		f = excelize.NewFile()
		_ = f.DeleteSheet("Sheet1")
		fmt.Printf("[ExcelStore] Creating new workspace: %s\n", filePath)
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
					fmt.Printf("[ExcelStore] Warning: could not rename TrackingNodes: %v\n", renameErr)
				} else {
					fmt.Printf("[ExcelStore] Migrated TrackingNodes → CentralNodes\n")
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
	profilePath := getProfilePath()
	var pf *excelize.File
	if _, err := os.Stat(profilePath); err != nil {
		pf = excelize.NewFile()
		_ = pf.DeleteSheet("Sheet1")
	} else {
		pf, _ = excelize.OpenFile(profilePath)
	}

	if pf != nil {
		pidx, _ := pf.GetSheetIndex(SheetProfile)
		if pidx < 0 {
			newPidx, _ := pf.NewSheet(SheetProfile)
			pf.SetActiveSheet(newPidx)
		}
		profHeaders := []string{"ProfileID", "Name", "Role", "Email", "Department", "Avatar", "AccentColor", "PinHash", "UpdatedAt"}
		for colIdx, h := range profHeaders {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
			pf.SetCellValue(SheetProfile, cell, h)
		}

		seedPinHash := loadPinFromEnv()
		if existingPin, _ := pf.GetCellValue(SheetProfile, "H2"); strings.TrimSpace(existingPin) != "" && strings.TrimSpace(existingPin) != "true" && strings.TrimSpace(existingPin) != "false" {
			seedPinHash = strings.TrimSpace(existingPin)
		}

		pf.SetCellValue(SheetProfile, "A2", "PROF-001")
		pf.SetCellValue(SheetProfile, "C2", "Team Lead")
		pf.SetCellValue(SheetProfile, "G2", "#5E6AD2")
		if seedPinHash != "" && seedPinHash != "true" && seedPinHash != "false" {
			pf.SetCellValue(SheetProfile, "H2", seedPinHash)
		}
		pf.SetCellValue(SheetProfile, "I2", time.Now().UTC().Format(time.RFC3339))
		_ = pf.SaveAs(profilePath)
		_ = pf.Close()
		fmt.Printf("[ExcelStore] Dedicated Profile/Auth Excel engine initialized: %s (PIN Configured: %t)\n", profilePath, seedPinHash != "")
	}

	fmt.Printf("[ExcelStore] Work Workspace engine initialized: %s (sheets: CentralNodes, AcademicWork, EventManagement, ProductDev, TeamRoster)\n", filePath)
	fmt.Printf("[ExcelStore] Workspace ready: %s (sheets: CentralNodes, AcademicWork, EventManagement, ProductDev, TeamRoster, ProfileData)\n", filePath)
	return nil
}

// ensureSheet creates a sheet with headers only if it does not already exist.
func ensureSheet(f *excelize.File, name string, headers []string) {
	idx, err := f.GetSheetIndex(name)
	if err != nil || idx < 0 {
		newIdx, createErr := f.NewSheet(name)
		if createErr != nil {
			fmt.Printf("[ExcelStore] Warning: could not create sheet %s: %v\n", name, createErr)
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
// It appends a new row matching the domain schema.
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
		// Clear each cell in this row (up to 17 columns)
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

// ── Profile CRUD — Consolidated into workspace_data.xlsx ─────────────────────

// IsConfigured returns true if a PIN hash is stored in workspace_data.xlsx ProfileData.
func IsConfigured(filePath string) bool {
	hash, err := GetPinHash(filePath)
	if err != nil {
		return false
	}
	return strings.TrimSpace(hash) != ""
}

// readProfileFromFile is an internal helper that reads profile cells without acquiring the mutex.
func readProfileFromFile(targetPath string) (map[string]string, error) {
	result := map[string]string{
		"profile_id":  "PROF-001",
		"role":        "Team Lead",
		"name":        "",
		"email":       "",
		"department":  "",
		"avatar":      "",
		"accentColor": "#5E6AD2",
		"pin_hash":    "",
		"updated_at":  "",
	}

	f, err := excelize.OpenFile(targetPath)
	if err != nil {
		return result, err
	}
	defer f.Close()

	// Check which sheet to read from
	sheet := SheetProfile
	if idx, e := f.GetSheetIndex(SheetProfile); e != nil || idx < 0 {
		return result, fmt.Errorf("ProfileData sheet not found in %s", targetPath)
	}

	read := func(cell string) string {
		v, _ := f.GetCellValue(sheet, cell)
		return strings.TrimSpace(v)
	}

	a1 := read("A1")
	if strings.EqualFold(a1, "Name") {
		// Legacy 7-column schema: Name, Role, Email, Department, Avatar, AccentColor, PinHash
		result["profile_id"] = "PROF-001"
		if v := read("A2"); v != "" { result["name"] = v }
		if v := read("B2"); v != "" { result["role"] = v }
		if v := read("C2"); v != "" { result["email"] = v }
		if v := read("D2"); v != "" { result["department"] = v }
		if v := read("E2"); v != "" { result["avatar"] = v }
		if v := read("F2"); v != "" { result["accentColor"] = v }
		if v := read("G2"); v != "" && v != "true" && v != "false" {
			result["pin_hash"] = v
		} else {
			result["pin_hash"] = loadPinFromEnv()
		}
		return result, nil
	}

	// 9-column schema: ProfileID, Name, Role, Email, Department, Avatar, AccentColor, PinHash, UpdatedAt
	if v := read("A2"); v != "" { result["profile_id"] = v }
	if v := read("B2"); v != "" { result["name"] = v }
	if v := read("C2"); v != "" { result["role"] = v }
	if v := read("D2"); v != "" { result["email"] = v }
	if v := read("E2"); v != "" { result["department"] = v }
	if v := read("F2"); v != "" { result["avatar"] = v }
	if v := read("G2"); v != "" { result["accentColor"] = v }
	if v := read("H2"); v != "" && v != "true" && v != "false" {
		result["pin_hash"] = v
	} else {
		result["pin_hash"] = loadPinFromEnv()
	}
	if v := read("I2"); v != "" { result["updated_at"] = v }

	return result, nil
}

func GetProfile(filePath string) (map[string]string, error) {
	fileMutex.Lock()
	defer fileMutex.Unlock()

	// Always read profile from dedicated profile_data.xlsx first
	targetPath := getProfilePath()
	result, err := readProfileFromFile(targetPath)
	if err != nil {
		result, _ = readProfileFromFile(filePath)
	}

	// Sanitize pin_hash: if empty or boolean string, fall back to environment PIN hash
	ph := cleanHash(result["pin_hash"])
	if ph == "" || ph == "true" || ph == "false" {
		ph = cleanHash(loadPinFromEnv())
	}
	result["pin_hash"] = ph

	return result, nil
}

func SaveProfile(filePath string, data map[string]string) error {
	fileMutex.Lock()
	defer fileMutex.Unlock()

	// Write profile strictly to dedicated profile_data.xlsx
	targetPath := getProfilePath()
	f, err := excelize.OpenFile(targetPath)
	if err != nil {
		f = excelize.NewFile()
		_ = f.DeleteSheet("Sheet1")
	}
	defer func() { _ = f.Close() }()

	// Ensure ProfileData sheet exists
	if idx, e := f.GetSheetIndex(SheetProfile); e != nil || idx < 0 {
		pidx, _ := f.NewSheet(SheetProfile)
		_ = pidx
		profHeaders := []string{"ProfileID", "Name", "Role", "Email", "Department", "Avatar", "AccentColor", "PinHash", "UpdatedAt"}
		for ci, h := range profHeaders {
			cell, _ := excelize.CoordinatesToCellName(ci+1, 1)
			f.SetCellValue(SheetProfile, cell, h)
		}
	}

	existing, _ := readProfileFromFile(targetPath)

	merge := func(key, cell string) {
		if v, ok := data[key]; ok && v != "" {
			f.SetCellValue(SheetProfile, cell, v)
		} else if existing[key] != "" {
			f.SetCellValue(SheetProfile, cell, existing[key])
		}
	}

	profileID := existing["profile_id"]
	if profileID == "" {
		profileID = "PROF-001"
	}
	f.SetCellValue(SheetProfile, "A2", profileID)
	merge("name", "B2")
	merge("role", "C2")
	merge("email", "D2")
	merge("department", "E2")
	merge("avatar", "F2")

	accentColor := data["accentColor"]
	if accentColor == "" {
		accentColor = existing["accentColor"]
	}
	if accentColor == "" {
		accentColor = "#5E6AD2"
	}
	f.SetCellValue(SheetProfile, "G2", accentColor)

	pinHash := cleanHash(data["pin_hash"])
	if pinHash == "" || pinHash == "true" || pinHash == "false" {
		pinHash = cleanHash(existing["pin_hash"])
	}
	if pinHash == "" || pinHash == "true" || pinHash == "false" {
		pinHash = cleanHash(loadPinFromEnv())
	}
	f.SetCellValue(SheetProfile, "H2", pinHash)
	f.SetCellValue(SheetProfile, "I2", time.Now().UTC().Format(time.RFC3339))

	if pinHash != "" && pinHash != "true" && pinHash != "false" {
		_ = savePinToEnv(pinHash)
	}

	return f.SaveAs(targetPath)
}

func GetPinHash(filePath string) (string, error) {
	prof, err := GetProfile(filePath)
	if err == nil {
		if ph := cleanHash(prof["pin_hash"]); ph != "" && ph != "true" && ph != "false" {
			return ph, nil
		}
	}
	return cleanHash(loadPinFromEnv()), nil
}

func SavePinHash(filePath string, hash string) error {
	existing, _ := GetProfile(getProfilePath())
	existing["pin_hash"] = hash
	return SaveProfile(getProfilePath(), existing)
}

// SetupPin sets a PIN hash only if no PIN currently exists. Returns an error if already configured.
func SetupPin(filePath string, hash string) error {
	existingHash, _ := GetPinHash(filePath)
	if strings.TrimSpace(existingHash) != "" {
		return fmt.Errorf("PIN already configured: use verify endpoint to authenticate")
	}
	return SavePinHash(filePath, hash)
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
		SheetProfile:      "User profile configuration, preferences & SHA-256 PIN hash",
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
