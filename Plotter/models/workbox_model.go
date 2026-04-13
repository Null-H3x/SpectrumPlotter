package models

import (
	"time"

	"github.com/google/uuid"
)

// Workbox represents an ISM spectrum management office (e.g. "AFSOC ISM", "GAFC").
// Multiple ISM users can be assigned to the same workbox.
// A workbox belongs to one installation (the base it operates from).
type Workbox struct {
	ID               uuid.UUID  `json:"id" db:"id"`
	Name             string     `json:"name" db:"name"`
	Description      string     `json:"description" db:"description"`
	InstallationID   *uuid.UUID `json:"installation_id,omitempty" db:"installation_id"`
	InstallationName *string    `json:"installation_name,omitempty" db:"installation_name"` // joined
	MemberCount      int        `json:"member_count" db:"member_count"`                     // joined
	IsActive         bool       `json:"is_active" db:"is_active"`
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at" db:"updated_at"`
}

// UserWorkboxAssignment is a member record linking a user to a workbox.
type UserWorkboxAssignment struct {
	UserID    uuid.UUID `json:"user_id" db:"user_id"`
	WorkboxID uuid.UUID `json:"workbox_id" db:"workbox_id"`
	IsPrimary bool      `json:"is_primary" db:"is_primary"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	// Joined fields for display
	WorkboxName *string `json:"workbox_name,omitempty" db:"workbox_name"`
	UserName    *string `json:"user_name,omitempty" db:"user_name"`
	UserEmail   *string `json:"user_email,omitempty" db:"user_email"`
	UserRole    *string `json:"user_role,omitempty" db:"user_role"`
}

type CreateWorkboxRequest struct {
	Name           string     `json:"name" binding:"required"`
	Description    string     `json:"description"`
	InstallationID *uuid.UUID `json:"installation_id"`
	IsActive       bool       `json:"is_active"`
}

type UpdateWorkboxRequest struct {
	Name           string     `json:"name" binding:"required"`
	Description    string     `json:"description"`
	InstallationID *uuid.UUID `json:"installation_id"`
	IsActive       bool       `json:"is_active"`
}

type AssignWorkboxMemberRequest struct {
	UserID    uuid.UUID `json:"user_id" binding:"required"`
	IsPrimary bool      `json:"is_primary"`
}
