package main

type Assignee struct {
	Name   string `json:"name"`
	Avatar string `json:"avatar"`
	Email  string `json:"email"`
	Role   string `json:"role"`
}

type ProjectMetrics struct {
	RepoUrl         string `json:"repoUrl,omitempty"`
	RepoBranch      string `json:"repoBranch,omitempty"`
	CompletionIndex int    `json:"completionIndex,omitempty"`
	TargetRelease   string `json:"targetRelease,omitempty"`
	BuildStatus     string `json:"buildStatus,omitempty"`
}

type AcademicMetrics struct {
	PaperTitle        string   `json:"paperTitle,omitempty"`
	Citations         []string `json:"citations,omitempty"`
	AdvisorFeedback   string   `json:"advisorFeedback,omitempty"`
	PublicationTarget string   `json:"publicationTarget,omitempty"`
	GradingScale      string   `json:"gradingScale,omitempty"`
}

type EventMetrics struct {
	EventTimestamp      string   `json:"eventTimestamp,omitempty"`
	LocationType        string   `json:"locationType,omitempty"`
	LocationCoordinates string   `json:"locationCoordinates,omitempty"`
	AttendeeRegistry    []string `json:"attendeeRegistry,omitempty"`
	EventType           string   `json:"eventType,omitempty"`
}

type TeamMetrics struct {
	TeamName           string   `json:"teamName,omitempty"`
	Department         string   `json:"department,omitempty"`
	AllocatedNodes     int      `json:"allocatedNodes,omitempty"`
	ThroughputVelocity string   `json:"throughputVelocity,omitempty"`
	Lead               string   `json:"lead,omitempty"`
	Members            []string `json:"members,omitempty"`
}

type OtherMetrics struct {
	Category     string `json:"category,omitempty"`
	ComplianceId string `json:"complianceId,omitempty"`
	UrgencyNote  string `json:"urgencyNote,omitempty"`
}

type ActivityLog struct {
	ID   string `json:"id"`
	User string `json:"user"`
	Time string `json:"time"`
	Text string `json:"text"`
}

type Item struct {
	ID              string           `json:"id"`
	Domain          string           `json:"domain"`
	Title           string           `json:"title"`
	Status          string           `json:"status"`
	Priority        string           `json:"priority"`
	Assignee        *Assignee        `json:"assignee,omitempty"`
	DueDate         string           `json:"dueDate,omitempty"`
	CreatedAt       string           `json:"createdAt,omitempty"`
	UpdatedAt       string           `json:"updatedAt,omitempty"`
	Tags            []string         `json:"tags,omitempty"`
	Description     string           `json:"description,omitempty"`
	ProjectMetrics  *ProjectMetrics  `json:"projectMetrics,omitempty"`
	AcademicMetrics *AcademicMetrics `json:"academicMetrics,omitempty"`
	EventMetrics    *EventMetrics    `json:"eventMetrics,omitempty"`
	TeamMetrics     *TeamMetrics     `json:"teamMetrics,omitempty"`
	OtherMetrics    *OtherMetrics    `json:"otherMetrics,omitempty"`
	Activity        []ActivityLog    `json:"activity,omitempty"`
}

type ProfileData struct {
	Name        string `json:"name"`
	Email       string `json:"email"`
	Role        string `json:"role"`
	Department  string `json:"department"`
	Avatar      string `json:"avatar"`
	AccentColor string `json:"accentColor"`
	PinHash     string `json:"pinHash"`
}

// AuthStatus is returned by GET /api/auth/status
type AuthStatus struct {
	Configured    bool   `json:"configured"`
	SessionValid  bool   `json:"sessionValid"`
}

// AuthToken is returned by POST /api/auth/verify
type AuthToken struct {
	Token     string `json:"token"`
	ExpiresIn int    `json:"expiresIn"` // seconds
}

type SheetInfo struct {
	Name        string   `json:"name"`
	RowCount    int      `json:"rowCount"`
	ColumnCount int      `json:"columnCount"`
	Headers     []string `json:"headers"`
	Purpose     string   `json:"purpose"`
}

