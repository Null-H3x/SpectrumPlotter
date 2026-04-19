package repositories

import (
	"database/sql"
	"fmt"

	"sfaf-plotter/cache"
	"sfaf-plotter/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type InstallationRepository struct {
	db *sqlx.DB
}

func NewInstallationRepository(db *sqlx.DB) *InstallationRepository {
	return &InstallationRepository{db: db}
}

func (r *InstallationRepository) GetAll() ([]models.Installation, error) {
	if v, ok := cache.Ref.Get("installations:all"); ok {
		return v.([]models.Installation), nil
	}
	var installations []models.Installation
	err := r.db.Select(&installations, `SELECT * FROM installations ORDER BY name ASC`)
	if err == nil {
		cache.Ref.Set("installations:all", installations)
	}
	return installations, err
}

func (r *InstallationRepository) GetActive() ([]models.Installation, error) {
	if v, ok := cache.Ref.Get("installations:active"); ok {
		return v.([]models.Installation), nil
	}
	var installations []models.Installation
	err := r.db.Select(&installations, `SELECT * FROM installations WHERE is_active = true ORDER BY name ASC`)
	if err == nil {
		cache.Ref.Set("installations:active", installations)
	}
	return installations, err
}

func (r *InstallationRepository) GetByID(id uuid.UUID) (*models.Installation, error) {
	var inst models.Installation
	err := r.db.Get(&inst, `SELECT * FROM installations WHERE id = $1`, id)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("installation not found")
	}
	return &inst, err
}

func (r *InstallationRepository) invalidate() {
	cache.Ref.Delete("installations:all")
	cache.Ref.Delete("installations:active")
	cache.Ref.Delete("installations:public")
}

func (r *InstallationRepository) Create(inst *models.Installation) error {
	query := `
		INSERT INTO installations (name, code, organization, state, country)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, is_active, created_at, updated_at`
	err := r.db.QueryRowx(query, inst.Name, inst.Code, inst.Organization, inst.State, inst.Country).
		Scan(&inst.ID, &inst.IsActive, &inst.CreatedAt, &inst.UpdatedAt)
	if err == nil {
		r.invalidate()
	}
	return err
}

func (r *InstallationRepository) Update(inst *models.Installation) error {
	query := `
		UPDATE installations
		SET name = $1, code = $2, organization = $3, state = $4, country = $5, is_active = $6, updated_at = NOW()
		WHERE id = $7
		RETURNING updated_at`
	err := r.db.QueryRowx(query, inst.Name, inst.Code, inst.Organization, inst.State, inst.Country, inst.IsActive, inst.ID).
		Scan(&inst.UpdatedAt)
	if err == nil {
		r.invalidate()
	}
	return err
}

func (r *InstallationRepository) Delete(id uuid.UUID) error {
	_, err := r.db.Exec(`DELETE FROM installations WHERE id = $1`, id)
	if err == nil {
		r.invalidate()
	}
	return err
}

// PublicInstallation is a minimal projection used by the public account-request dropdown.
type PublicInstallation struct {
	ID           string `json:"id" db:"id"`
	Name         string `json:"name" db:"name"`
	Code         string `json:"code" db:"code"`
	Organization string `json:"organization" db:"organization"`
}

// GetPublicInstallations returns the id, name, code, and organization of every
// active installation, ordered by name.  Intended for unauthenticated dropdowns.
func (r *InstallationRepository) GetPublicInstallations() ([]PublicInstallation, error) {
	if v, ok := cache.Ref.Get("installations:public"); ok {
		return v.([]PublicInstallation), nil
	}
	var list []PublicInstallation
	err := r.db.Select(&list, `
		SELECT id::text, name,
		       COALESCE(code, '')         AS code,
		       COALESCE(organization, '') AS organization
		FROM installations
		WHERE is_active = true
		ORDER BY name`)
	if list == nil {
		list = []PublicInstallation{}
	}
	if err == nil {
		cache.Ref.Set("installations:public", list)
	}
	return list, err
}
