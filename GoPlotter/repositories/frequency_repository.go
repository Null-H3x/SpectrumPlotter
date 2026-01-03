// repositories/frequency_repository.go
package repositories

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"sfaf-plotter/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type FrequencyRepository struct {
	db *sqlx.DB
}

func NewFrequencyRepository(db *sqlx.DB) *FrequencyRepository {
	return &FrequencyRepository{db: db}
}

// ============================================
// Unit Operations
// ============================================

func (r *FrequencyRepository) CreateUnit(unit *models.Unit) error {
	query := `
		INSERT INTO units (
			name, unit_code, parent_unit_id, unit_type, organization, location,
			commander_name, commander_email, s6_poc_name, s6_poc_email, s6_poc_phone
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at, updated_at`

	return r.db.QueryRowx(query,
		unit.Name, unit.UnitCode, unit.ParentUnitID, unit.UnitType, unit.Organization,
		unit.Location, unit.CommanderName, unit.CommanderEmail, unit.CommPocName,
		unit.CommPocEmail, unit.CommPocPhone,
	).Scan(&unit.ID, &unit.CreatedAt, &unit.UpdatedAt)
}

func (r *FrequencyRepository) GetUnitByID(id uuid.UUID) (*models.Unit, error) {
	var unit models.Unit
	query := `SELECT * FROM units WHERE id = $1 AND is_active = true`
	err := r.db.Get(&unit, query, id)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("unit not found")
	}
	return &unit, err
}

func (r *FrequencyRepository) GetUnitByCode(unitCode string) (*models.Unit, error) {
	var unit models.Unit
	query := `SELECT * FROM units WHERE unit_code = $1 AND is_active = true`
	err := r.db.Get(&unit, query, unitCode)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("unit not found")
	}
	return &unit, err
}

func (r *FrequencyRepository) GetUserUnits(userID uuid.UUID) ([]models.Unit, error) {
	var units []models.Unit
	query := `
		SELECT u.* FROM units u
		INNER JOIN user_units uu ON u.id = uu.unit_id
		WHERE uu.user_id = $1 AND u.is_active = true
		ORDER BY uu.is_primary DESC, u.name`
	err := r.db.Select(&units, query, userID)
	return units, err
}

func (r *FrequencyRepository) GetAllUnits() ([]models.Unit, error) {
	var units []models.Unit
	query := `SELECT * FROM units WHERE is_active = true ORDER BY organization, name`
	err := r.db.Select(&units, query)
	return units, err
}

func (r *FrequencyRepository) UpdateUnit(unit *models.Unit) error {
	unit.UpdatedAt = time.Now()
	query := `
		UPDATE units SET
			name = $1, parent_unit_id = $2, unit_type = $3, organization = $4,
			location = $5, commander_name = $6, commander_email = $7,
			s6_poc_name = $8, s6_poc_email = $9, s6_poc_phone = $10,
			updated_at = $11
		WHERE id = $12 AND is_active = true`

	result, err := r.db.Exec(query,
		unit.Name, unit.ParentUnitID, unit.UnitType, unit.Organization, unit.Location,
		unit.CommanderName, unit.CommanderEmail, unit.CommPocName, unit.CommPocEmail,
		unit.CommPocPhone, unit.UpdatedAt, unit.ID,
	)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("unit not found")
	}
	return nil
}

func (r *FrequencyRepository) DeleteUnit(id uuid.UUID) error {
	query := `UPDATE units SET is_active = false WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}

// ============================================
// User-Unit Assignment Operations
// ============================================

func (r *FrequencyRepository) AssignUserToUnit(userID, unitID uuid.UUID, role string, isPrimary bool, assignedBy *uuid.UUID) error {
	query := `
		INSERT INTO user_units (user_id, unit_id, role, is_primary, assigned_by)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, unit_id) DO UPDATE
		SET role = $3, is_primary = $4, assigned_at = CURRENT_TIMESTAMP`

	_, err := r.db.Exec(query, userID, unitID, role, isPrimary, assignedBy)
	return err
}

func (r *FrequencyRepository) RemoveUserFromUnit(userID, unitID uuid.UUID) error {
	query := `DELETE FROM user_units WHERE user_id = $1 AND unit_id = $2`
	_, err := r.db.Exec(query, userID, unitID)
	return err
}

func (r *FrequencyRepository) GetUnitMembers(unitID uuid.UUID) ([]models.User, error) {
	var users []models.User
	query := `
		SELECT u.* FROM users u
		INNER JOIN user_units uu ON u.id = uu.user_id
		WHERE uu.unit_id = $1 AND u.is_active = true
		ORDER BY uu.role, u.full_name`
	err := r.db.Select(&users, query, unitID)
	return users, err
}

// ============================================
// Frequency Assignment Operations
// ============================================

func (r *FrequencyRepository) CreateFrequencyAssignment(assignment *models.FrequencyAssignment) error {
	query := `
		INSERT INTO frequency_assignments (
			unit_id, frequency, frequency_mhz, assignment_type, purpose, net_name,
			callsign, emission_designator, bandwidth, power_watts, authorized_radius_km,
			assignment_date, expiration_date, assignment_authority, authorization_number,
			priority, is_encrypted, encryption_type, classification, notes, created_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
		RETURNING id, created_at, updated_at`

	return r.db.QueryRowx(query,
		assignment.UnitID, assignment.Frequency, assignment.FrequencyMhz, assignment.AssignmentType,
		assignment.Purpose, assignment.NetName, assignment.Callsign, assignment.EmissionDesignator,
		assignment.Bandwidth, assignment.PowerWatts, assignment.AuthorizedRadiusKm,
		assignment.AssignmentDate, assignment.ExpirationDate, assignment.AssignmentAuthority,
		assignment.AuthorizationNumber, assignment.Priority, assignment.IsEncrypted,
		assignment.EncryptionType, assignment.Classification, assignment.Notes, assignment.CreatedBy,
	).Scan(&assignment.ID, &assignment.CreatedAt, &assignment.UpdatedAt)
}

func (r *FrequencyRepository) GetFrequencyAssignmentByID(id uuid.UUID) (*models.FrequencyAssignment, error) {
	var assignment models.FrequencyAssignment
	query := `SELECT * FROM frequency_assignments WHERE id = $1`
	err := r.db.Get(&assignment, query, id)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("frequency assignment not found")
	}
	return &assignment, err
}

func (r *FrequencyRepository) GetUnitFrequencyAssignments(unitID uuid.UUID) ([]models.FrequencyAssignment, error) {
	var assignments []models.FrequencyAssignment
	query := `
		SELECT * FROM frequency_assignments
		WHERE unit_id = $1 AND is_active = true
		ORDER BY assignment_type, frequency_mhz`
	err := r.db.Select(&assignments, query, unitID)
	return assignments, err
}

func (r *FrequencyRepository) GetUserUnitFrequencyAssignments(userID uuid.UUID) ([]models.FrequencyAssignment, error) {
	var assignments []models.FrequencyAssignment
	query := `
		SELECT fa.* FROM frequency_assignments fa
		INNER JOIN user_units uu ON fa.unit_id = uu.unit_id
		WHERE uu.user_id = $1 AND fa.is_active = true
		ORDER BY fa.assignment_type, fa.frequency_mhz`
	err := r.db.Select(&assignments, query, userID)
	return assignments, err
}

func (r *FrequencyRepository) GetExpiringAssignments(daysThreshold int) ([]models.FrequencyAssignment, error) {
	var assignments []models.FrequencyAssignment
	query := `
		SELECT * FROM frequency_assignments
		WHERE is_active = true
		AND expiration_date IS NOT NULL
		AND expiration_date <= CURRENT_DATE + $1 * INTERVAL '1 day'
		AND expiration_date >= CURRENT_DATE
		ORDER BY expiration_date`
	err := r.db.Select(&assignments, query, daysThreshold)
	return assignments, err
}

func (r *FrequencyRepository) UpdateFrequencyAssignment(assignment *models.FrequencyAssignment) error {
	assignment.UpdatedAt = time.Now()
	query := `
		UPDATE frequency_assignments SET
			frequency = $1, frequency_mhz = $2, assignment_type = $3, purpose = $4,
			net_name = $5, callsign = $6, emission_designator = $7, bandwidth = $8,
			power_watts = $9, authorized_radius_km = $10, assignment_date = $11,
			expiration_date = $12, assignment_authority = $13, authorization_number = $14,
			priority = $15, is_encrypted = $16, encryption_type = $17, classification = $18,
			notes = $19, updated_at = $20
		WHERE id = $21 AND is_active = true`

	result, err := r.db.Exec(query,
		assignment.Frequency, assignment.FrequencyMhz, assignment.AssignmentType, assignment.Purpose,
		assignment.NetName, assignment.Callsign, assignment.EmissionDesignator, assignment.Bandwidth,
		assignment.PowerWatts, assignment.AuthorizedRadiusKm, assignment.AssignmentDate,
		assignment.ExpirationDate, assignment.AssignmentAuthority, assignment.AuthorizationNumber,
		assignment.Priority, assignment.IsEncrypted, assignment.EncryptionType, assignment.Classification,
		assignment.Notes, assignment.UpdatedAt, assignment.ID,
	)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("frequency assignment not found")
	}
	return nil
}

func (r *FrequencyRepository) DeactivateFrequencyAssignment(id uuid.UUID) error {
	query := `UPDATE frequency_assignments SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}

// ============================================
// Frequency Request Operations
// ============================================

func (r *FrequencyRepository) CreateFrequencyRequest(request *models.FrequencyRequest) error {
	query := `
		INSERT INTO frequency_requests (
			unit_id, requested_by, request_type, status, priority, requested_frequency,
			frequency_range_min, frequency_range_max, purpose, net_name, callsign,
			assignment_type, emission_designator, bandwidth, power_watts, coverage_area,
			authorized_radius_km, start_date, end_date, hours_of_operation,
			num_transmitters, num_receivers, is_encrypted, encryption_type, classification,
			requires_coordination, coordination_notes, justification, mission_impact
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
			$18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
		)
		RETURNING id, created_at, updated_at`

	return r.db.QueryRowx(query,
		request.UnitID, request.RequestedBy, request.RequestType, request.Status, request.Priority,
		request.RequestedFrequency, request.FrequencyRangeMin, request.FrequencyRangeMax,
		request.Purpose, request.NetName, request.Callsign, request.AssignmentType,
		request.EmissionDesignator, request.Bandwidth, request.PowerWatts, request.CoverageArea,
		request.AuthorizedRadiusKm, request.StartDate, request.EndDate, request.HoursOfOperation,
		request.NumTransmitters, request.NumReceivers, request.IsEncrypted, request.EncryptionType,
		request.Classification, request.RequiresCoordination, request.CoordinationNotes,
		request.Justification, request.MissionImpact,
	).Scan(&request.ID, &request.CreatedAt, &request.UpdatedAt)
}

func (r *FrequencyRepository) GetFrequencyRequestByID(id uuid.UUID) (*models.FrequencyRequest, error) {
	var request models.FrequencyRequest
	query := `SELECT * FROM frequency_requests WHERE id = $1`
	err := r.db.Get(&request, query, id)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("frequency request not found")
	}
	return &request, err
}

func (r *FrequencyRepository) GetUnitFrequencyRequests(unitID uuid.UUID) ([]models.FrequencyRequest, error) {
	var requests []models.FrequencyRequest
	query := `
		SELECT * FROM frequency_requests
		WHERE unit_id = $1
		ORDER BY priority DESC, created_at DESC`
	err := r.db.Select(&requests, query, unitID)
	return requests, err
}

func (r *FrequencyRepository) GetUserFrequencyRequests(userID uuid.UUID) ([]models.FrequencyRequest, error) {
	var requests []models.FrequencyRequest
	query := `
		SELECT * FROM frequency_requests
		WHERE requested_by = $1
		ORDER BY created_at DESC`
	err := r.db.Select(&requests, query, userID)
	return requests, err
}

func (r *FrequencyRepository) GetPendingRequests() ([]models.FrequencyRequest, error) {
	var requests []models.FrequencyRequest
	query := `
		SELECT * FROM frequency_requests
		WHERE status IN ('pending', 'under_review')
		ORDER BY priority DESC, created_at`
	err := r.db.Select(&requests, query)
	return requests, err
}

func (r *FrequencyRepository) UpdateFrequencyRequestStatus(
	id uuid.UUID,
	status string,
	reviewedBy *uuid.UUID,
	reviewNotes, approvalNotes, deniedReason string,
) error {
	now := time.Now()
	query := `
		UPDATE frequency_requests SET
			status = $1,
			reviewed_by = $2,
			reviewed_at = $3,
			review_notes = $4,
			approval_notes = $5,
			denied_reason = $6,
			updated_at = $7
		WHERE id = $8`

	_, err := r.db.Exec(query, status, reviewedBy, now, reviewNotes, approvalNotes, deniedReason, now, id)
	return err
}

func (r *FrequencyRepository) ApproveFrequencyRequest(id uuid.UUID, approvedBy uuid.UUID, assignmentID uuid.UUID) error {
	now := time.Now()
	query := `
		UPDATE frequency_requests SET
			status = 'approved',
			approved_by = $1,
			approved_at = $2,
			assignment_id = $3,
			updated_at = $4
		WHERE id = $5`

	_, err := r.db.Exec(query, approvedBy, now, assignmentID, now, id)
	return err
}

// ============================================
// Search and Query Operations
// ============================================

func (r *FrequencyRepository) SearchAvailableFrequencies(query *models.FrequencySearchQuery) ([]models.FrequencyAssignment, error) {
	// Build dynamic query based on search criteria
	conditions := []string{"is_active = true"}
	args := []interface{}{}
	argCount := 1

	if query.MinFrequency != nil {
		conditions = append(conditions, fmt.Sprintf("frequency_mhz >= $%d", argCount))
		args = append(args, *query.MinFrequency)
		argCount++
	}

	if query.MaxFrequency != nil {
		conditions = append(conditions, fmt.Sprintf("frequency_mhz <= $%d", argCount))
		args = append(args, *query.MaxFrequency)
		argCount++
	}

	if query.ExcludeUnitID != nil {
		conditions = append(conditions, fmt.Sprintf("unit_id != $%d", argCount))
		args = append(args, *query.ExcludeUnitID)
		argCount++
	}

	sqlQuery := fmt.Sprintf(`
		SELECT * FROM frequency_assignments
		WHERE %s
		ORDER BY frequency_mhz`,
		strings.Join(conditions, " AND "),
	)

	var assignments []models.FrequencyAssignment
	err := r.db.Select(&assignments, sqlQuery, args...)
	return assignments, err
}
