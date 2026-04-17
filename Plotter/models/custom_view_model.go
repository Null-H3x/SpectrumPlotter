package models

import (
	"time"

	"github.com/google/uuid"
)

// ViewField is one column in a custom view.
type ViewField struct {
	Key   string `json:"key"`
	Label string `json:"label"`
}

// CustomView is a user-defined set of SFAF columns saved to the database.
type CustomView struct {
	ID          uuid.UUID   `json:"id"          db:"id"`
	UserID      uuid.UUID   `json:"user_id"     db:"user_id"`
	Name        string      `json:"name"        db:"name"`
	Description string      `json:"description" db:"description"`
	Fields      []ViewField `json:"fields"      db:"fields"`
	CreatedAt   time.Time   `json:"created_at"  db:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"  db:"updated_at"`
}
