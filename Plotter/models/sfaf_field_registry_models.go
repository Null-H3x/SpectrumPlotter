// models/sfaf_field_registry_models.go
package models

import (
	"time"

	"github.com/google/uuid"
)

// SFAFFieldCategory groups SFAF fields into logical sections.
type SFAFFieldCategory struct {
	ID        uuid.UUID `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	SortOrder int       `json:"sort_order" db:"sort_order"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type CreateSFAFFieldCategoryRequest struct {
	Name      string `json:"name" binding:"required"`
	SortOrder int    `json:"sort_order"`
}

type UpdateSFAFFieldCategoryRequest struct {
	Name      string `json:"name" binding:"required"`
	SortOrder int    `json:"sort_order"`
}

// SFAFFieldDefinition holds metadata for every SFAF line-item field.
type SFAFFieldDefinition struct {
	ID                    uuid.UUID  `json:"id" db:"id"`
	FieldNumber           string     `json:"field_number" db:"field_number"`
	Title                 string     `json:"title" db:"title"`
	CategoryID            *uuid.UUID `json:"category_id,omitempty" db:"category_id"`
	CategoryName          *string    `json:"category_name,omitempty" db:"category_name"` // joined
	SpectrumXXITags       *string    `json:"spectrum_xxi_tags,omitempty" db:"spectrum_xxi_tags"`
	GMFTags               *string    `json:"gmf_tags,omitempty" db:"gmf_tags"`
	MaxInputLength        *string    `json:"max_input_length,omitempty" db:"max_input_length"`
	MaxOccurrences        *string    `json:"max_occurrences,omitempty" db:"max_occurrences"`
	ToIRAC                *string    `json:"to_irac,omitempty" db:"to_irac"`
	MaxCharsPerOccurrence *int       `json:"max_chars_per_occurrence,omitempty" db:"max_chars_per_occurrence"`
	MaxCharsPerLine       *int       `json:"max_chars_per_line,omitempty" db:"max_chars_per_line"`
	HasLookup             bool       `json:"has_lookup" db:"has_lookup"`
	SortOrder             int        `json:"sort_order" db:"sort_order"`
	Notes                 *string    `json:"notes,omitempty" db:"notes"`
	IsActive              bool       `json:"is_active" db:"is_active"`
	CreatedAt             time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at" db:"updated_at"`
}

type UpdateSFAFFieldDefinitionRequest struct {
	Title                 string     `json:"title" binding:"required"`
	CategoryID            *uuid.UUID `json:"category_id"`
	SpectrumXXITags       *string    `json:"spectrum_xxi_tags"`
	GMFTags               *string    `json:"gmf_tags"`
	MaxInputLength        *string    `json:"max_input_length"`
	MaxOccurrences        *string    `json:"max_occurrences"`
	ToIRAC                *string    `json:"to_irac"`
	MaxCharsPerOccurrence *int       `json:"max_chars_per_occurrence"`
	MaxCharsPerLine       *int       `json:"max_chars_per_line"`
	HasLookup             bool       `json:"has_lookup"`
	SortOrder             int        `json:"sort_order"`
	Notes                 *string    `json:"notes"`
	IsActive              bool       `json:"is_active"`
}

// SFAFRequiredField marks a field as required within a given scope.
type SFAFRequiredField struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	FieldNumber string     `json:"field_number" db:"field_number"`
	ScopeType   string     `json:"scope_type" db:"scope_type"` // global|agency|unified_command|majcom
	ScopeValue  string     `json:"scope_value" db:"scope_value"`
	CreatedBy   *uuid.UUID `json:"created_by,omitempty" db:"created_by"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
}

type CreateSFAFRequiredFieldRequest struct {
	FieldNumber string `json:"field_number" binding:"required"`
	ScopeType   string `json:"scope_type" binding:"required"`
	ScopeValue  string `json:"scope_value"`
}
