// models/frequency_models.go
package models

import (
	"time"

	"github.com/google/uuid"
)

// Unit represents a military unit or organization
type Unit struct {
	ID             uuid.UUID  `json:"id" db:"id"`
	Name           string     `json:"name" db:"name"`
	UnitCode       string     `json:"unit_code" db:"unit_code"`
	ParentUnitID   *uuid.UUID `json:"parent_unit_id,omitempty" db:"parent_unit_id"`
	UnitType       *string    `json:"unit_type,omitempty" db:"unit_type"`
	Organization   *string    `json:"organization,omitempty" db:"organization"`
	Location       *string    `json:"location,omitempty" db:"location"`
	CommanderName  *string    `json:"commander_name,omitempty" db:"commander_name"`
	CommanderEmail *string    `json:"commander_email,omitempty" db:"commander_email"`
	CommPocName    *string    `json:"comm_poc_name,omitempty" db:"s6_poc_name"`
	CommPocEmail   *string    `json:"comm_poc_email,omitempty" db:"s6_poc_email"`
	CommPocPhone   *string    `json:"comm_poc_phone,omitempty" db:"s6_poc_phone"`
	IsActive       bool       `json:"is_active" db:"is_active"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at"`
}

// UserUnit represents a user's assignment to a unit
type UserUnit struct {
	ID         uuid.UUID  `json:"id" db:"id"`
	UserID     uuid.UUID  `json:"user_id" db:"user_id"`
	UnitID     uuid.UUID  `json:"unit_id" db:"unit_id"`
	Role       string     `json:"role" db:"role"` // commander, s6, member, viewer
	IsPrimary  bool       `json:"is_primary" db:"is_primary"`
	AssignedAt time.Time  `json:"assigned_at" db:"assigned_at"`
	AssignedBy *uuid.UUID `json:"assigned_by,omitempty" db:"assigned_by"`
}

// FrequencyAssignment represents a frequency assigned to a unit
type FrequencyAssignment struct {
	ID                    uuid.UUID  `json:"id" db:"id"`
	UnitID                uuid.UUID  `json:"unit_id" db:"unit_id"`
	Serial                string     `json:"serial" db:"serial"`
	Frequency             string     `json:"frequency" db:"frequency"`
	FrequencyMhz          *float64   `json:"frequency_mhz,omitempty" db:"frequency_mhz"`
	AssignmentType        string     `json:"assignment_type" db:"assignment_type"`
	Purpose               *string    `json:"purpose,omitempty" db:"purpose"`
	NetName               *string    `json:"net_name,omitempty" db:"net_name"`
	Callsign              *string    `json:"callsign,omitempty" db:"callsign"`
	EmissionDesignator    *string    `json:"emission_designator,omitempty" db:"emission_designator"`
	Bandwidth             *string    `json:"bandwidth,omitempty" db:"bandwidth"`
	PowerWatts            *int       `json:"power_watts,omitempty" db:"power_watts"`
	AuthorizedRadiusKm    *float64   `json:"authorized_radius_km,omitempty" db:"authorized_radius_km"`
	AssignmentDate        *time.Time `json:"assignment_date,omitempty" db:"assignment_date"`
	ExpirationDate        *time.Time `json:"expiration_date,omitempty" db:"expiration_date"`
	AssignmentAuthority   *string    `json:"assignment_authority,omitempty" db:"assignment_authority"`
	AuthorizationNumber   *string    `json:"authorization_number,omitempty" db:"authorization_number"`
	Priority              string     `json:"priority" db:"priority"`
	IsEncrypted           bool       `json:"is_encrypted" db:"is_encrypted"`
	EncryptionType        *string    `json:"encryption_type,omitempty" db:"encryption_type"`
	Classification        string     `json:"classification" db:"classification"`
	Notes                 *string    `json:"notes,omitempty" db:"notes"`
	IsActive              bool       `json:"is_active" db:"is_active"`
	CreatedBy             *uuid.UUID `json:"created_by,omitempty" db:"created_by"`
	ApprovedBy            *uuid.UUID `json:"approved_by,omitempty" db:"approved_by"`
	CreatedAt             time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at" db:"updated_at"`
}

// FrequencyRequest represents a request for a new frequency or modification
type FrequencyRequest struct {
	ID                   uuid.UUID  `json:"id" db:"id"`
	UnitID               uuid.UUID  `json:"unit_id" db:"unit_id"`
	RequestedBy          uuid.UUID  `json:"requested_by" db:"requested_by"`
	RequestType          string     `json:"request_type" db:"request_type"`
	Status               string     `json:"status" db:"status"`
	Priority             string     `json:"priority" db:"priority"`
	RequestedFrequency   string     `json:"requested_frequency,omitempty" db:"requested_frequency"`
	FrequencyRangeMin    *float64   `json:"frequency_range_min,omitempty" db:"frequency_range_min"`
	FrequencyRangeMax    *float64   `json:"frequency_range_max,omitempty" db:"frequency_range_max"`
	Purpose              string     `json:"purpose" db:"purpose"`
	NetName              string     `json:"net_name,omitempty" db:"net_name"`
	Callsign             string     `json:"callsign,omitempty" db:"callsign"`
	AssignmentType       string     `json:"assignment_type,omitempty" db:"assignment_type"`
	EmissionDesignator   string     `json:"emission_designator,omitempty" db:"emission_designator"`
	Bandwidth            string     `json:"bandwidth,omitempty" db:"bandwidth"`
	PowerWatts           *int       `json:"power_watts,omitempty" db:"power_watts"`
	CoverageArea         string     `json:"coverage_area,omitempty" db:"coverage_area"`
	AuthorizedRadiusKm   *float64   `json:"authorized_radius_km,omitempty" db:"authorized_radius_km"`
	StartDate            time.Time  `json:"start_date" db:"start_date"`
	EndDate              *time.Time `json:"end_date,omitempty" db:"end_date"`
	HoursOfOperation     string     `json:"hours_of_operation,omitempty" db:"hours_of_operation"`
	NumTransmitters      *int       `json:"num_transmitters,omitempty" db:"num_transmitters"`
	NumReceivers         *int       `json:"num_receivers,omitempty" db:"num_receivers"`
	IsEncrypted          bool       `json:"is_encrypted" db:"is_encrypted"`
	EncryptionType       string     `json:"encryption_type,omitempty" db:"encryption_type"`
	Classification       string     `json:"classification" db:"classification"`
	RequiresCoordination bool       `json:"requires_coordination" db:"requires_coordination"`
	CoordinationNotes    string     `json:"coordination_notes,omitempty" db:"coordination_notes"`
	Justification        string     `json:"justification" db:"justification"`
	MissionImpact        string     `json:"mission_impact,omitempty" db:"mission_impact"`
	ReviewedBy           *uuid.UUID `json:"reviewed_by,omitempty" db:"reviewed_by"`
	ReviewedAt           *time.Time `json:"reviewed_at,omitempty" db:"reviewed_at"`
	ReviewNotes          string     `json:"review_notes,omitempty" db:"review_notes"`
	ApprovedBy           *uuid.UUID `json:"approved_by,omitempty" db:"approved_by"`
	ApprovedAt           *time.Time `json:"approved_at,omitempty" db:"approved_at"`
	ApprovalNotes        string     `json:"approval_notes,omitempty" db:"approval_notes"`
	DeniedReason         string     `json:"denied_reason,omitempty" db:"denied_reason"`
	AssignmentID         *uuid.UUID `json:"assignment_id,omitempty" db:"assignment_id"`
	CreatedAt            time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at" db:"updated_at"`
}

// FrequencyConflict tracks potential interference between assignments
type FrequencyConflict struct {
	ID                       uuid.UUID  `json:"id" db:"id"`
	FrequencyAssignmentID    uuid.UUID  `json:"frequency_assignment_id" db:"frequency_assignment_id"`
	ConflictingAssignmentID  uuid.UUID  `json:"conflicting_assignment_id" db:"conflicting_assignment_id"`
	ConflictType             string     `json:"conflict_type" db:"conflict_type"`
	DistanceKm               *float64   `json:"distance_km,omitempty" db:"distance_km"`
	Severity                 string     `json:"severity" db:"severity"`
	MitigationNotes          string     `json:"mitigation_notes,omitempty" db:"mitigation_notes"`
	Resolved                 bool       `json:"resolved" db:"resolved"`
	ResolvedAt               *time.Time `json:"resolved_at,omitempty" db:"resolved_at"`
	ResolvedBy               *uuid.UUID `json:"resolved_by,omitempty" db:"resolved_by"`
	CreatedAt                time.Time  `json:"created_at" db:"created_at"`
}

// FrequencyUsageLog tracks when frequencies are actively used
type FrequencyUsageLog struct {
	ID                    uuid.UUID  `json:"id" db:"id"`
	FrequencyAssignmentID uuid.UUID  `json:"frequency_assignment_id" db:"frequency_assignment_id"`
	UsedBy                *uuid.UUID `json:"used_by,omitempty" db:"used_by"`
	UsageStart            time.Time  `json:"usage_start" db:"usage_start"`
	UsageEnd              *time.Time `json:"usage_end,omitempty" db:"usage_end"`
	Location              string     `json:"location,omitempty" db:"location"`
	Notes                 string     `json:"notes,omitempty" db:"notes"`
	CreatedAt             time.Time  `json:"created_at" db:"created_at"`
}

// Extended response models with joined data

// UnitWithAssignments includes unit info and its frequency assignments
type UnitWithAssignments struct {
	Unit                *Unit                  `json:"unit"`
	FrequencyAssignments []FrequencyAssignment `json:"frequency_assignments"`
	PendingRequests     []FrequencyRequest     `json:"pending_requests"`
	MemberCount         int                    `json:"member_count"`
}

// FrequencyRequestWithDetails includes request and related information
type FrequencyRequestWithDetails struct {
	Request       *FrequencyRequest `json:"request"`
	Unit          *Unit             `json:"unit"`
	RequestedBy   *User             `json:"requested_by"`
	ReviewedBy    *User             `json:"reviewed_by,omitempty"`
	ApprovedBy    *User             `json:"approved_by,omitempty"`
	Assignment    *FrequencyAssignment `json:"assignment,omitempty"`
}

// FrequencyAssignmentWithDetails includes assignment and unit info
type FrequencyAssignmentWithDetails struct {
	Assignment  *FrequencyAssignment `json:"assignment"`
	Unit        *Unit                `json:"unit"`
	CreatedBy   *User                `json:"created_by,omitempty"`
	ApprovedBy  *User                `json:"approved_by,omitempty"`
	Conflicts   []FrequencyConflict  `json:"conflicts,omitempty"`
	UsageLogs   []FrequencyUsageLog  `json:"usage_logs,omitempty"`
}

// Request/Response models for API

// CreateFrequencyRequestInput for submitting new frequency requests
type CreateFrequencyRequestInput struct {
	UnitID               uuid.UUID  `json:"unit_id" binding:"required"`
	RequestType          string     `json:"request_type" binding:"required"` // new_assignment, modification, renewal, cancellation
	Priority             string     `json:"priority" binding:"required"`     // emergency, urgent, priority, routine
	RequestedFrequency   string     `json:"requested_frequency,omitempty"`
	FrequencyRangeMin    *float64   `json:"frequency_range_min,omitempty"`
	FrequencyRangeMax    *float64   `json:"frequency_range_max,omitempty"`
	Purpose              string     `json:"purpose" binding:"required"`
	NetName              string     `json:"net_name,omitempty"`
	Callsign             string     `json:"callsign,omitempty"`
	AssignmentType       string     `json:"assignment_type,omitempty"`
	EmissionDesignator   string     `json:"emission_designator,omitempty"`
	Bandwidth            string     `json:"bandwidth,omitempty"`
	PowerWatts           *int       `json:"power_watts,omitempty"`
	CoverageArea         string     `json:"coverage_area,omitempty"`
	AuthorizedRadiusKm   *float64   `json:"authorized_radius_km,omitempty"`
	StartDate            time.Time  `json:"start_date" binding:"required"`
	EndDate              *time.Time `json:"end_date,omitempty"`
	HoursOfOperation     string     `json:"hours_of_operation,omitempty"`
	NumTransmitters      *int       `json:"num_transmitters,omitempty"`
	NumReceivers         *int       `json:"num_receivers,omitempty"`
	IsEncrypted          bool       `json:"is_encrypted"`
	EncryptionType       string     `json:"encryption_type,omitempty"`
	Classification       string     `json:"classification"`
	RequiresCoordination bool       `json:"requires_coordination"`
	CoordinationNotes    string     `json:"coordination_notes,omitempty"`
	Justification        string     `json:"justification" binding:"required"`
	MissionImpact        string     `json:"mission_impact,omitempty"`
}

// UpdateFrequencyRequestStatusInput for reviewing/approving requests
type UpdateFrequencyRequestStatusInput struct {
	Status        string `json:"status" binding:"required"` // under_review, approved, denied, cancelled
	ReviewNotes   string `json:"review_notes,omitempty"`
	ApprovalNotes string `json:"approval_notes,omitempty"`
	DeniedReason  string `json:"denied_reason,omitempty"`
}

// CreateFrequencyAssignmentInput for creating new assignments
type CreateFrequencyAssignmentInput struct {
	UnitID              uuid.UUID  `json:"unit_id" binding:"required"`
	Serial              string     `json:"serial" binding:"required"`
	Frequency           string     `json:"frequency" binding:"required"`
	FrequencyMhz        *float64   `json:"frequency_mhz,omitempty"`
	AssignmentType      string     `json:"assignment_type" binding:"required"`
	Purpose             string     `json:"purpose,omitempty"`
	NetName             string     `json:"net_name,omitempty"`
	Callsign            string     `json:"callsign,omitempty"`
	EmissionDesignator  string     `json:"emission_designator,omitempty"`
	Bandwidth           string     `json:"bandwidth,omitempty"`
	PowerWatts          *int       `json:"power_watts,omitempty"`
	AuthorizedRadiusKm  *float64   `json:"authorized_radius_km,omitempty"`
	AssignmentDate      *time.Time `json:"assignment_date,omitempty"`
	ExpirationDate      *time.Time `json:"expiration_date,omitempty"`
	AssignmentAuthority string     `json:"assignment_authority,omitempty"`
	AuthorizationNumber string     `json:"authorization_number,omitempty"`
	Priority            string     `json:"priority"`
	IsEncrypted         bool       `json:"is_encrypted"`
	EncryptionType      string     `json:"encryption_type,omitempty"`
	Classification      string     `json:"classification"`
	Notes               string     `json:"notes,omitempty"`
}

// FrequencySearchQuery for searching available frequencies
type FrequencySearchQuery struct {
	MinFrequency       *float64 `json:"min_frequency,omitempty"`
	MaxFrequency       *float64 `json:"max_frequency,omitempty"`
	Location           string   `json:"location,omitempty"`
	RadiusKm           *float64 `json:"radius_km,omitempty"`
	ExcludeUnitID      *uuid.UUID `json:"exclude_unit_id,omitempty"`
	RequiredBandwidth  *float64 `json:"required_bandwidth,omitempty"`
}
