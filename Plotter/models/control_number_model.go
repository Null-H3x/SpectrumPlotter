// models/control_number_model.go
package models

import (
	"time"

	"github.com/google/uuid"
)

// ControlNumber is a 702 Control/Request Number reference entry.
type ControlNumber struct {
	ID          uuid.UUID `json:"id" db:"id"`
	Number      string    `json:"number" db:"number"`
	Description string    `json:"description" db:"description"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}
