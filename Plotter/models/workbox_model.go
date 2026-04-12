package models

import (
	"time"

	"github.com/google/uuid"
)

// Workbox represents an ISM spectrum management office (e.g. "AFSOC ISM", "GAFC").
// ISM+ users are identified by the workbox they own, not by unit membership.
type Workbox struct {
	ID          uuid.UUID `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	IsActive    bool      `json:"is_active" db:"is_active"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}
