package repositories

import (
	"encoding/json"
	"fmt"
	"sfaf-plotter/models"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type CustomViewRepository struct {
	db *sqlx.DB
}

func NewCustomViewRepository(db *sqlx.DB) *CustomViewRepository {
	return &CustomViewRepository{db: db}
}

func (r *CustomViewRepository) GetByUserID(userID uuid.UUID) ([]*models.CustomView, error) {
	rows, err := r.db.Query(
		`SELECT id, user_id, name, description, fields, created_at, updated_at
		 FROM user_custom_views WHERE user_id = $1 ORDER BY name ASC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query custom views: %w", err)
	}
	defer rows.Close()

	var views []*models.CustomView
	for rows.Next() {
		var v models.CustomView
		var fieldsJSON []byte
		if err := rows.Scan(&v.ID, &v.UserID, &v.Name, &v.Description, &fieldsJSON, &v.CreatedAt, &v.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan custom view: %w", err)
		}
		if err := json.Unmarshal(fieldsJSON, &v.Fields); err != nil {
			v.Fields = []models.ViewField{}
		}
		views = append(views, &v)
	}
	return views, rows.Err()
}

func (r *CustomViewRepository) Create(userID uuid.UUID, name, description string, fields []models.ViewField) (*models.CustomView, error) {
	fieldsJSON, err := json.Marshal(fields)
	if err != nil {
		return nil, fmt.Errorf("failed to encode fields: %w", err)
	}
	v := &models.CustomView{
		ID:          uuid.New(),
		UserID:      userID,
		Name:        name,
		Description: description,
		Fields:      fields,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	_, err = r.db.Exec(
		`INSERT INTO user_custom_views (id, user_id, name, description, fields, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		v.ID, v.UserID, v.Name, v.Description, fieldsJSON, v.CreatedAt, v.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create custom view: %w", err)
	}
	return v, nil
}

func (r *CustomViewRepository) Update(viewID, userID uuid.UUID, name, description string, fields []models.ViewField) (*models.CustomView, error) {
	fieldsJSON, err := json.Marshal(fields)
	if err != nil {
		return nil, fmt.Errorf("failed to encode fields: %w", err)
	}
	now := time.Now()
	res, err := r.db.Exec(
		`UPDATE user_custom_views SET name=$1, description=$2, fields=$3, updated_at=$4
		 WHERE id=$5 AND user_id=$6`,
		name, description, fieldsJSON, now, viewID, userID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update custom view: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return nil, fmt.Errorf("view not found or not owned by user")
	}
	return &models.CustomView{ID: viewID, UserID: userID, Name: name, Description: description, Fields: fields, UpdatedAt: now}, nil
}

func (r *CustomViewRepository) Delete(viewID, userID uuid.UUID) error {
	res, err := r.db.Exec(
		`DELETE FROM user_custom_views WHERE id=$1 AND user_id=$2`,
		viewID, userID,
	)
	if err != nil {
		return fmt.Errorf("failed to delete custom view: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("view not found or not owned by user")
	}
	return nil
}
