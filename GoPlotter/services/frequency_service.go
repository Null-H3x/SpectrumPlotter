// services/frequency_service.go
package services

import (
	"fmt"
	"sfaf-plotter/models"
	"sfaf-plotter/repositories"
	"time"

	"github.com/google/uuid"
)

type FrequencyService struct {
	repo *repositories.FrequencyRepository
}

func NewFrequencyService(repo *repositories.FrequencyRepository) *FrequencyService {
	return &FrequencyService{repo: repo}
}

// ============================================
// Unit Management
// ============================================

func (s *FrequencyService) CreateUnit(input *models.Unit) (*models.Unit, error) {
	// Validate unit code is unique
	existing, _ := s.repo.GetUnitByCode(input.UnitCode)
	if existing != nil {
		return nil, fmt.Errorf("unit code already exists: %s", input.UnitCode)
	}

	input.IsActive = true
	err := s.repo.CreateUnit(input)
	if err != nil {
		return nil, fmt.Errorf("failed to create unit: %w", err)
	}

	return input, nil
}

// UpdateUnit updates an existing unit
func (s *FrequencyService) UpdateUnit(input *models.Unit) (*models.Unit, error) {
	// Check if unit exists
	existing, err := s.repo.GetUnitByID(input.ID)
	if err != nil {
		return nil, fmt.Errorf("unit not found: %w", err)
	}

	// If unit code is being changed, check it's unique
	if input.UnitCode != existing.UnitCode {
		codeCheck, _ := s.repo.GetUnitByCode(input.UnitCode)
		if codeCheck != nil {
			return nil, fmt.Errorf("unit code already exists: %s", input.UnitCode)
		}
	}

	err = s.repo.UpdateUnit(input)
	if err != nil {
		return nil, fmt.Errorf("failed to update unit: %w", err)
	}

	return input, nil
}

// DeleteUnit deletes a unit
func (s *FrequencyService) DeleteUnit(unitID uuid.UUID) error {
	// Check if unit has active frequency assignments
	assignments, err := s.repo.GetUnitFrequencyAssignments(unitID)
	if err != nil {
		return fmt.Errorf("failed to check unit assignments: %w", err)
	}

	if len(assignments) > 0 {
		return fmt.Errorf("cannot delete unit with active frequency assignments")
	}

	err = s.repo.DeleteUnit(unitID)
	if err != nil {
		return fmt.Errorf("failed to delete unit: %w", err)
	}

	return nil
}

func (s *FrequencyService) GetUserUnitsWithAssignments(userID uuid.UUID) ([]models.UnitWithAssignments, error) {
	units, err := s.repo.GetUserUnits(userID)
	if err != nil {
		return nil, err
	}

	result := make([]models.UnitWithAssignments, 0, len(units))
	for _, unit := range units {
		assignments, err := s.repo.GetUnitFrequencyAssignments(unit.ID)
		if err != nil {
			return nil, err
		}

		// Get pending requests for this unit
		unitRequests, err := s.repo.GetUnitFrequencyRequests(unit.ID)
		if err != nil {
			return nil, err
		}

		pendingRequests := make([]models.FrequencyRequest, 0)
		for _, req := range unitRequests {
			if req.Status == "pending" || req.Status == "under_review" {
				pendingRequests = append(pendingRequests, req)
			}
		}

		// Get member count
		members, _ := s.repo.GetUnitMembers(unit.ID)

		result = append(result, models.UnitWithAssignments{
			Unit:                 &unit,
			FrequencyAssignments: assignments,
			PendingRequests:      pendingRequests,
			MemberCount:          len(members),
		})
	}

	return result, nil
}

func (s *FrequencyService) GetAllUnitsWithAssignments() ([]models.UnitWithAssignments, error) {
	units, err := s.repo.GetAllUnits()
	if err != nil {
		return nil, err
	}

	result := make([]models.UnitWithAssignments, 0, len(units))
	for _, unit := range units {
		assignments, err := s.repo.GetUnitFrequencyAssignments(unit.ID)
		if err != nil {
			return nil, err
		}

		// Get pending requests for this unit
		unitRequests, err := s.repo.GetUnitFrequencyRequests(unit.ID)
		if err != nil {
			return nil, err
		}

		pendingRequests := make([]models.FrequencyRequest, 0)
		for _, req := range unitRequests {
			if req.Status == "pending" || req.Status == "under_review" {
				pendingRequests = append(pendingRequests, req)
			}
		}

		// Get member count
		members, _ := s.repo.GetUnitMembers(unit.ID)

		result = append(result, models.UnitWithAssignments{
			Unit:                 &unit,
			FrequencyAssignments: assignments,
			PendingRequests:      pendingRequests,
			MemberCount:          len(members),
		})
	}

	return result, nil
}

// ============================================
// Frequency Assignment Management
// ============================================

func (s *FrequencyService) CreateFrequencyAssignment(
	input *models.CreateFrequencyAssignmentInput,
	createdBy uuid.UUID,
) (*models.FrequencyAssignment, error) {
	// Validate unit exists
	_, err := s.repo.GetUnitByID(input.UnitID)
	if err != nil {
		return nil, fmt.Errorf("unit not found: %w", err)
	}

	// Helper function to convert empty strings to nil pointers
	strPtr := func(s string) *string {
		if s == "" {
			return nil
		}
		return &s
	}

	// Create assignment
	assignment := &models.FrequencyAssignment{
		UnitID:              input.UnitID,
		Frequency:           input.Frequency,
		FrequencyMhz:        input.FrequencyMhz,
		AssignmentType:      input.AssignmentType,
		Purpose:             strPtr(input.Purpose),
		NetName:             strPtr(input.NetName),
		Callsign:            strPtr(input.Callsign),
		EmissionDesignator:  strPtr(input.EmissionDesignator),
		Bandwidth:           strPtr(input.Bandwidth),
		PowerWatts:          input.PowerWatts,
		AuthorizedRadiusKm:  input.AuthorizedRadiusKm,
		AssignmentDate:      input.AssignmentDate,
		ExpirationDate:      input.ExpirationDate,
		AssignmentAuthority: strPtr(input.AssignmentAuthority),
		AuthorizationNumber: strPtr(input.AuthorizationNumber),
		Priority:            input.Priority,
		IsEncrypted:         input.IsEncrypted,
		EncryptionType:      strPtr(input.EncryptionType),
		Classification:      input.Classification,
		Notes:               strPtr(input.Notes),
		IsActive:            true,
		CreatedBy:           &createdBy,
	}

	err = s.repo.CreateFrequencyAssignment(assignment)
	if err != nil {
		return nil, fmt.Errorf("failed to create frequency assignment: %w", err)
	}

	return assignment, nil
}

func (s *FrequencyService) GetUserFrequencyAssignments(userID uuid.UUID) ([]models.FrequencyAssignmentWithDetails, error) {
	assignments, err := s.repo.GetUserUnitFrequencyAssignments(userID)
	if err != nil {
		return nil, err
	}

	result := make([]models.FrequencyAssignmentWithDetails, 0, len(assignments))
	for _, assignment := range assignments {
		unit, _ := s.repo.GetUnitByID(assignment.UnitID)

		result = append(result, models.FrequencyAssignmentWithDetails{
			Assignment: &assignment,
			Unit:       unit,
		})
	}

	return result, nil
}

func (s *FrequencyService) GetExpiringFrequencies(days int) ([]models.FrequencyAssignmentWithDetails, error) {
	assignments, err := s.repo.GetExpiringAssignments(days)
	if err != nil {
		return nil, err
	}

	result := make([]models.FrequencyAssignmentWithDetails, 0, len(assignments))
	for _, assignment := range assignments {
		unit, _ := s.repo.GetUnitByID(assignment.UnitID)

		result = append(result, models.FrequencyAssignmentWithDetails{
			Assignment: &assignment,
			Unit:       unit,
		})
	}

	return result, nil
}

// ============================================
// Frequency Request Management
// ============================================

func (s *FrequencyService) SubmitFrequencyRequest(
	input *models.CreateFrequencyRequestInput,
	requestedBy uuid.UUID,
) (*models.FrequencyRequest, error) {
	// Validate unit exists and user has access
	_, err := s.repo.GetUnitByID(input.UnitID)
	if err != nil {
		return nil, fmt.Errorf("unit not found: %w", err)
	}

	// Validate start date is not in the past
	if input.StartDate.Before(time.Now().Truncate(24 * time.Hour)) {
		return nil, fmt.Errorf("start date cannot be in the past")
	}

	// Create request
	request := &models.FrequencyRequest{
		UnitID:               input.UnitID,
		RequestedBy:          requestedBy,
		RequestType:          input.RequestType,
		Status:               "pending",
		Priority:             input.Priority,
		RequestedFrequency:   input.RequestedFrequency,
		FrequencyRangeMin:    input.FrequencyRangeMin,
		FrequencyRangeMax:    input.FrequencyRangeMax,
		Purpose:              input.Purpose,
		NetName:              input.NetName,
		Callsign:             input.Callsign,
		AssignmentType:       input.AssignmentType,
		EmissionDesignator:   input.EmissionDesignator,
		Bandwidth:            input.Bandwidth,
		PowerWatts:           input.PowerWatts,
		CoverageArea:         input.CoverageArea,
		AuthorizedRadiusKm:   input.AuthorizedRadiusKm,
		StartDate:            input.StartDate,
		EndDate:              input.EndDate,
		HoursOfOperation:     input.HoursOfOperation,
		NumTransmitters:      input.NumTransmitters,
		NumReceivers:         input.NumReceivers,
		IsEncrypted:          input.IsEncrypted,
		EncryptionType:       input.EncryptionType,
		Classification:       input.Classification,
		RequiresCoordination: input.RequiresCoordination,
		CoordinationNotes:    input.CoordinationNotes,
		Justification:        input.Justification,
		MissionImpact:        input.MissionImpact,
	}

	err = s.repo.CreateFrequencyRequest(request)
	if err != nil {
		return nil, fmt.Errorf("failed to create frequency request: %w", err)
	}

	return request, nil
}

func (s *FrequencyService) ReviewFrequencyRequest(
	requestID uuid.UUID,
	reviewedBy uuid.UUID,
	status string,
	notes string,
) (*models.FrequencyRequest, error) {
	// Validate status
	validStatuses := map[string]bool{
		"under_review": true,
		"approved":     true,
		"denied":       true,
	}
	if !validStatuses[status] {
		return nil, fmt.Errorf("invalid status: %s", status)
	}

	// Get existing request
	_, err := s.repo.GetFrequencyRequestByID(requestID)
	if err != nil {
		return nil, err
	}

	// Update status
	err = s.repo.UpdateFrequencyRequestStatus(requestID, status, &reviewedBy, notes, "", "")
	if err != nil {
		return nil, err
	}

	// Get updated request
	return s.repo.GetFrequencyRequestByID(requestID)
}

func (s *FrequencyService) ApproveAndCreateAssignment(
	requestID uuid.UUID,
	approvedBy uuid.UUID,
	assignmentInput *models.CreateFrequencyAssignmentInput,
) (*models.FrequencyRequest, *models.FrequencyAssignment, error) {
	// Get the request
	request, err := s.repo.GetFrequencyRequestByID(requestID)
	if err != nil {
		return nil, nil, err
	}

	if request.Status == "approved" {
		return nil, nil, fmt.Errorf("request already approved")
	}

	// Create the frequency assignment
	assignment, err := s.CreateFrequencyAssignment(assignmentInput, approvedBy)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create assignment: %w", err)
	}

	// Update request status
	err = s.repo.ApproveFrequencyRequest(requestID, approvedBy, assignment.ID)
	if err != nil {
		// Rollback assignment if request update fails
		s.repo.DeactivateFrequencyAssignment(assignment.ID)
		return nil, nil, fmt.Errorf("failed to approve request: %w", err)
	}

	// Get updated request
	updatedRequest, _ := s.repo.GetFrequencyRequestByID(requestID)
	return updatedRequest, assignment, nil
}

func (s *FrequencyService) GetUserRequestsWithDetails(userID uuid.UUID) ([]models.FrequencyRequestWithDetails, error) {
	requests, err := s.repo.GetUserFrequencyRequests(userID)
	if err != nil {
		return nil, err
	}

	result := make([]models.FrequencyRequestWithDetails, 0, len(requests))
	for _, request := range requests {
		unit, _ := s.repo.GetUnitByID(request.UnitID)

		result = append(result, models.FrequencyRequestWithDetails{
			Request: &request,
			Unit:    unit,
		})
	}

	return result, nil
}

func (s *FrequencyService) GetPendingRequestsWithDetails() ([]models.FrequencyRequestWithDetails, error) {
	requests, err := s.repo.GetPendingRequests()
	if err != nil {
		return nil, err
	}

	result := make([]models.FrequencyRequestWithDetails, 0, len(requests))
	for _, request := range requests {
		unit, _ := s.repo.GetUnitByID(request.UnitID)

		result = append(result, models.FrequencyRequestWithDetails{
			Request: &request,
			Unit:    unit,
		})
	}

	return result, nil
}

// ============================================
// Conflict Detection (Basic Implementation)
// ============================================

func (s *FrequencyService) CheckFrequencyConflicts(
	frequencyMhz float64,
	unitID uuid.UUID,
	radiusKm float64,
) ([]models.FrequencyAssignment, error) {
	// Simple frequency proximity check
	// In a real system, this would include geographic distance calculations
	minFreq := frequencyMhz - 0.025 // 25 kHz spacing
	maxFreq := frequencyMhz + 0.025

	query := &models.FrequencySearchQuery{
		MinFrequency:  &minFreq,
		MaxFrequency:  &maxFreq,
		ExcludeUnitID: &unitID,
	}

	return s.repo.SearchAvailableFrequencies(query)
}

// ============================================
// Authorization Helpers
// ============================================

func (s *FrequencyService) CanUserManageUnit(userID, unitID uuid.UUID) (bool, error) {
	units, err := s.repo.GetUserUnits(userID)
	if err != nil {
		return false, err
	}

	for _, unit := range units {
		if unit.ID == unitID {
			return true, nil
		}
	}

	return false, nil
}
