// repositories/sfaf_field_registry_repository.go
package repositories

import (
	"database/sql"
	"fmt"

	"sfaf-plotter/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// ─────────────────────────────────────────────
// SFAFFieldCategoryRepository
// ─────────────────────────────────────────────

type SFAFFieldCategoryRepository struct {
	db *sqlx.DB
}

func NewSFAFFieldCategoryRepository(db *sqlx.DB) *SFAFFieldCategoryRepository {
	return &SFAFFieldCategoryRepository{db: db}
}

func (r *SFAFFieldCategoryRepository) GetAll() ([]models.SFAFFieldCategory, error) {
	var rows []models.SFAFFieldCategory
	err := r.db.Select(&rows, `SELECT * FROM sfaf_field_categories ORDER BY sort_order, name`)
	return rows, err
}

func (r *SFAFFieldCategoryRepository) GetByID(id uuid.UUID) (*models.SFAFFieldCategory, error) {
	var row models.SFAFFieldCategory
	err := r.db.Get(&row, `SELECT * FROM sfaf_field_categories WHERE id = $1`, id)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("category not found")
	}
	return &row, err
}

func (r *SFAFFieldCategoryRepository) Create(cat *models.SFAFFieldCategory) error {
	return r.db.QueryRowx(`
		INSERT INTO sfaf_field_categories (name, sort_order)
		VALUES ($1, $2)
		RETURNING id, created_at`,
		cat.Name, cat.SortOrder,
	).Scan(&cat.ID, &cat.CreatedAt)
}

func (r *SFAFFieldCategoryRepository) Update(cat *models.SFAFFieldCategory) error {
	_, err := r.db.Exec(`
		UPDATE sfaf_field_categories SET name = $1, sort_order = $2 WHERE id = $3`,
		cat.Name, cat.SortOrder, cat.ID)
	return err
}

func (r *SFAFFieldCategoryRepository) Delete(id uuid.UUID) error {
	_, err := r.db.Exec(`DELETE FROM sfaf_field_categories WHERE id = $1`, id)
	return err
}

// ─────────────────────────────────────────────
// SFAFFieldDefinitionRepository
// ─────────────────────────────────────────────

type SFAFFieldDefinitionRepository struct {
	db *sqlx.DB
}

func NewSFAFFieldDefinitionRepository(db *sqlx.DB) *SFAFFieldDefinitionRepository {
	return &SFAFFieldDefinitionRepository{db: db}
}

const fieldDefSelect = `
	SELECT fd.*,
	       cat.name AS category_name
	FROM sfaf_field_definitions fd
	LEFT JOIN sfaf_field_categories cat ON cat.id = fd.category_id`

func (r *SFAFFieldDefinitionRepository) GetAll() ([]models.SFAFFieldDefinition, error) {
	var rows []models.SFAFFieldDefinition
	err := r.db.Select(&rows, fieldDefSelect+` ORDER BY fd.sort_order, fd.field_number`)
	return rows, err
}

func (r *SFAFFieldDefinitionRepository) GetByCategory(categoryID uuid.UUID) ([]models.SFAFFieldDefinition, error) {
	var rows []models.SFAFFieldDefinition
	err := r.db.Select(&rows, fieldDefSelect+` WHERE fd.category_id = $1 ORDER BY fd.sort_order, fd.field_number`, categoryID)
	return rows, err
}

func (r *SFAFFieldDefinitionRepository) GetByID(id uuid.UUID) (*models.SFAFFieldDefinition, error) {
	var row models.SFAFFieldDefinition
	err := r.db.Get(&row, fieldDefSelect+` WHERE fd.id = $1`, id)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("field definition not found")
	}
	return &row, err
}

func (r *SFAFFieldDefinitionRepository) Update(id uuid.UUID, req *models.UpdateSFAFFieldDefinitionRequest) error {
	_, err := r.db.Exec(`
		UPDATE sfaf_field_definitions SET
			title                   = $1,
			category_id             = $2,
			spectrum_xxi_tags       = $3,
			gmf_tags                = $4,
			max_input_length        = $5,
			max_occurrences         = $6,
			to_irac                 = $7,
			max_chars_per_occurrence= $8,
			max_chars_per_line      = $9,
			has_lookup              = $10,
			sort_order              = $11,
			notes                   = $12,
			is_active               = $13,
			updated_at              = NOW()
		WHERE id = $14`,
		req.Title, req.CategoryID, req.SpectrumXXITags, req.GMFTags,
		req.MaxInputLength, req.MaxOccurrences, req.ToIRAC,
		req.MaxCharsPerOccurrence, req.MaxCharsPerLine,
		req.HasLookup, req.SortOrder, req.Notes, req.IsActive, id)
	return err
}

// ─────────────────────────────────────────────
// SFAFRequiredFieldRepository
// ─────────────────────────────────────────────

type SFAFRequiredFieldRepository struct {
	db *sqlx.DB
}

func NewSFAFRequiredFieldRepository(db *sqlx.DB) *SFAFRequiredFieldRepository {
	return &SFAFRequiredFieldRepository{db: db}
}

func (r *SFAFRequiredFieldRepository) GetAll() ([]models.SFAFRequiredField, error) {
	var rows []models.SFAFRequiredField
	err := r.db.Select(&rows, `SELECT * FROM sfaf_required_fields ORDER BY scope_type, scope_value, field_number`)
	return rows, err
}

func (r *SFAFRequiredFieldRepository) GetByScope(scopeType, scopeValue string) ([]models.SFAFRequiredField, error) {
	var rows []models.SFAFRequiredField
	err := r.db.Select(&rows,
		`SELECT * FROM sfaf_required_fields WHERE scope_type = $1 AND scope_value = $2 ORDER BY field_number`,
		scopeType, scopeValue)
	return rows, err
}

// GetEffective returns all required fields that apply to a given majcom:
// global + agency-level + unified_command-level + majcom-specific entries.
// scopeValues: map of scope_type -> scope_value for the caller's org chain.
func (r *SFAFRequiredFieldRepository) GetEffective(scopeValues map[string]string) ([]models.SFAFRequiredField, error) {
	var rows []models.SFAFRequiredField
	err := r.db.Select(&rows, `
		SELECT * FROM sfaf_required_fields
		WHERE (scope_type = 'global')
		   OR (scope_type = 'agency'           AND scope_value = $1)
		   OR (scope_type = 'unified_command'  AND scope_value = $2)
		   OR (scope_type = 'majcom'           AND scope_value = $3)
		ORDER BY scope_type, field_number`,
		scopeValues["agency"], scopeValues["unified_command"], scopeValues["majcom"])
	return rows, err
}

func (r *SFAFRequiredFieldRepository) Create(req *models.CreateSFAFRequiredFieldRequest, createdBy *uuid.UUID) (*models.SFAFRequiredField, error) {
	var row models.SFAFRequiredField
	err := r.db.QueryRowx(`
		INSERT INTO sfaf_required_fields (field_number, scope_type, scope_value, created_by)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (field_number, scope_type, scope_value) DO NOTHING
		RETURNING *`,
		req.FieldNumber, req.ScopeType, req.ScopeValue, createdBy,
	).StructScan(&row)
	if err == sql.ErrNoRows {
		// already existed — fetch it
		err2 := r.db.Get(&row,
			`SELECT * FROM sfaf_required_fields WHERE field_number=$1 AND scope_type=$2 AND scope_value=$3`,
			req.FieldNumber, req.ScopeType, req.ScopeValue)
		return &row, err2
	}
	return &row, err
}

func (r *SFAFRequiredFieldRepository) Delete(id uuid.UUID) error {
	_, err := r.db.Exec(`DELETE FROM sfaf_required_fields WHERE id = $1`, id)
	return err
}

func (r *SFAFRequiredFieldRepository) DeleteByScope(fieldNumber, scopeType, scopeValue string) error {
	_, err := r.db.Exec(`
		DELETE FROM sfaf_required_fields
		WHERE field_number=$1 AND scope_type=$2 AND scope_value=$3`,
		fieldNumber, scopeType, scopeValue)
	return err
}
