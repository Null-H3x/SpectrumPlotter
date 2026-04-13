// handlers/frequency_handler.go
package handlers

import (
	"io"
	"net/http"
	"sfaf-plotter/models"
	"sfaf-plotter/services"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type FrequencyHandler struct {
	service *services.FrequencyService
}

func NewFrequencyHandler(service *services.FrequencyService) *FrequencyHandler {
	return &FrequencyHandler{service: service}
}

// ============================================
// Unit Endpoints
// ============================================

// GetUserUnits returns all units assigned to the current user
// GET /api/frequency/units
func (h *FrequencyHandler) GetUserUnits(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	// Admins and ISM+ with ?all=true see all units (used by Table Manager)
	var units []models.UnitWithAssignments
	var err error

	if atLeast(c, "admin") || (atLeast(c, "ism") && c.Query("all") == "true") {
		units, err = h.service.GetAllUnitsWithAssignments()
	} else {
		units, err = h.service.GetUserUnitsWithAssignments(userID.(uuid.UUID))
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"units": units,
		"count": len(units),
	})
}

// GET /api/frequency/units/majcom — returns MAJCOM-type units for serial allocation UI
func (h *FrequencyHandler) GetMajcomUnits(c *gin.Context) {
	units, err := h.service.GetMajcomUnits()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"units": units, "count": len(units)})
}

// GET /api/frequency/units/:id/subordinates — returns child units of the given unit
func (h *FrequencyHandler) GetSubordinateUnits(c *gin.Context) {
	parentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid unit id"})
		return
	}
	units, err := h.service.GetSubordinateUnits(parentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"units": units, "count": len(units)})
}

// CreateUnit creates a new unit (admin only)
// POST /api/frequency/units
func (h *FrequencyHandler) CreateUnit(c *gin.Context) {
	_, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	if !atLeast(c, "admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
		return
	}

	var input models.Unit
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	unit, err := h.service.CreateUnit(&input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "unit created successfully",
		"unit":    unit,
	})
}

// UpdateUnit updates an existing unit (admin only)
// PUT /api/frequency/units/:id
func (h *FrequencyHandler) UpdateUnit(c *gin.Context) {
	_, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	if !atLeast(c, "admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
		return
	}

	unitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid unit id"})
		return
	}

	var input models.Unit
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Set the ID from URL parameter
	input.ID = unitID

	unit, err := h.service.UpdateUnit(&input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "unit updated successfully",
		"unit":    unit,
	})
}

// DeleteUnit deletes a unit (admin only)
// DELETE /api/frequency/units/:id
func (h *FrequencyHandler) DeleteUnit(c *gin.Context) {
	_, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	if !atLeast(c, "admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
		return
	}

	unitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid unit id"})
		return
	}

	err = h.service.DeleteUnit(unitID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "unit deleted successfully",
	})
}

// ============================================
// Frequency Assignment Endpoints
// ============================================

// GetUserFrequencyAssignments returns all frequency assignments for user's units
// GET /api/frequency/assignments
func (h *FrequencyHandler) GetUserFrequencyAssignments(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	assignments, err := h.service.GetUserFrequencyAssignments(userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"assignments": assignments,
		"count":       len(assignments),
	})
}

// GetExpiringFrequencies returns frequencies expiring within specified days
// GET /api/frequency/assignments/expiring?days=30
func (h *FrequencyHandler) GetExpiringFrequencies(c *gin.Context) {
	daysStr := c.DefaultQuery("days", "30")
	days, err := strconv.Atoi(daysStr)
	if err != nil || days < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid days parameter"})
		return
	}

	assignments, err := h.service.GetExpiringFrequencies(days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"assignments": assignments,
		"count":       len(assignments),
		"days":        days,
	})
}

// CreateFrequencyAssignment creates a new frequency assignment (s6/admin only)
// POST /api/frequency/assignments
func (h *FrequencyHandler) CreateFrequencyAssignment(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	var input models.CreateFrequencyAssignmentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify user has permission to manage this unit
	canManage, err := h.service.CanUserManageUnit(userID.(uuid.UUID), input.UnitID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if !canManage {
		c.JSON(http.StatusForbidden, gin.H{"error": "you do not have permission to manage this unit"})
		return
	}

	assignment, err := h.service.CreateFrequencyAssignment(&input, userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":    "frequency assignment created successfully",
		"assignment": assignment,
	})
}

// CheckFrequencyConflicts checks for potential conflicts
// GET /api/frequency/assignments/conflicts?frequency=123.450&unit_id=...&radius=50
func (h *FrequencyHandler) CheckFrequencyConflicts(c *gin.Context) {
	frequencyStr := c.Query("frequency")
	unitIDStr := c.Query("unit_id")
	radiusStr := c.DefaultQuery("radius", "50")

	if frequencyStr == "" || unitIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "frequency and unit_id are required"})
		return
	}

	frequency, err := strconv.ParseFloat(frequencyStr, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid frequency value"})
		return
	}

	unitID, err := uuid.Parse(unitIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid unit_id"})
		return
	}

	radius, err := strconv.ParseFloat(radiusStr, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid radius value"})
		return
	}

	conflicts, err := h.service.CheckFrequencyConflicts(frequency, unitID, radius)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"conflicts": conflicts,
		"count":     len(conflicts),
		"has_conflicts": len(conflicts) > 0,
	})
}

// GetAssignmentsInRange returns all active assignments in a frequency band.
// Used by the ISM deconfliction panel in the approval modal.
// GET /api/frequency/assignments/in-range?min=30.000&max=88.000
func (h *FrequencyHandler) GetAssignmentsInRange(c *gin.Context) {
	if !atLeast(c, "ism") {
		c.JSON(http.StatusForbidden, gin.H{"error": "ISM-level access or higher required"})
		return
	}
	minStr := c.Query("min")
	maxStr := c.Query("max")
	if minStr == "" || maxStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "min and max (MHz) are required"})
		return
	}
	minMhz, err := strconv.ParseFloat(minStr, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid min value"})
		return
	}
	maxMhz, err := strconv.ParseFloat(maxStr, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid max value"})
		return
	}
	if minMhz >= maxMhz {
		c.JSON(http.StatusBadRequest, gin.H{"error": "min must be less than max"})
		return
	}
	assignments, err := h.service.GetAssignmentsInRange(minMhz, maxMhz)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"assignments": assignments,
		"count":       len(assignments),
		"band_min":    minMhz,
		"band_max":    maxMhz,
	})
}

// ============================================
// Frequency Request Endpoints
// ============================================

// GetUserRequests returns all frequency requests submitted by the user
// GET /api/frequency/requests
func (h *FrequencyHandler) GetUserRequests(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	requests, err := h.service.GetUserRequestsWithDetails(userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"requests": requests,
		"count":    len(requests),
	})
}

// GetPendingRequests returns pending/under_review requests visible to the caller's workbox.
// GET /api/frequency/requests/pending
func (h *FrequencyHandler) GetPendingRequests(c *gin.Context) {
	if !atLeast(c, "ism") {
		c.JSON(http.StatusForbidden, gin.H{"error": "ISM-level access or higher required"})
		return
	}
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	requests, err := h.service.GetPendingRequestsWithDetails(userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"requests": requests,
		"count":    len(requests),
	})
}

// SubmitFrequencyRequest submits a new frequency request
// POST /api/frequency/requests
func (h *FrequencyHandler) SubmitFrequencyRequest(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	var input models.CreateFrequencyRequestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate dates
	if input.StartDate.IsZero() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_date is required"})
		return
	}

	if input.EndDate == nil && input.RequestType != "permanent" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "end_date is required for non-permanent requests"})
		return
	}

	if input.Justification == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "justification is required"})
		return
	}

	request, err := h.service.SubmitFrequencyRequest(&input, userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "frequency request submitted successfully",
		"request": request,
	})
}

// DeleteFrequencyRequest permanently deletes a cancelled or denied request.
// DELETE /api/frequency/requests/:id
func (h *FrequencyHandler) DeleteFrequencyRequest(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}
	requestID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request id"})
		return
	}
	isAdmin := atLeast(c, "admin")
	if err := h.service.DeleteFrequencyRequest(requestID, userID.(uuid.UUID), isAdmin); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "request deleted"})
}

// ResubmitFrequencyRequest updates a denied request and resets it to pending.
// PUT /api/frequency/requests/:id/resubmit
func (h *FrequencyHandler) ResubmitFrequencyRequest(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}
	requestID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request id"})
		return
	}
	var input models.CreateFrequencyRequestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	request, err := h.service.ResubmitFrequencyRequest(requestID, userID.(uuid.UUID), input)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "request resubmitted", "request": request})
}

// RetractFrequencyRequest cancels the caller's own pending/under-review request.
// PUT /api/frequency/requests/:id/retract
func (h *FrequencyHandler) RetractFrequencyRequest(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}
	requestID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request id"})
		return
	}
	request, err := h.service.RetractFrequencyRequest(requestID, userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "request retracted", "request": request})
}

// ReturnRequest routes a request back to the originating ISM workbox.
// PUT /api/frequency/requests/:id/return
func (h *FrequencyHandler) ReturnRequest(c *gin.Context) {
	if !atLeast(c, "ism") {
		c.JSON(http.StatusForbidden, gin.H{"error": "ISM-level access or higher required"})
		return
	}
	requestID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request id"})
		return
	}
	if err := h.service.ReturnRequest(requestID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "request returned to originating workbox"})
}

// SaveRequestSFAFDraft persists in-progress SFAF form fields on the request
// so edits made by one workbox are visible to all reviewers across browsers.
// PUT /api/frequency/requests/:id/sfaf-draft
func (h *FrequencyHandler) SaveRequestSFAFDraft(c *gin.Context) {
	if !atLeast(c, "ism") {
		c.JSON(http.StatusForbidden, gin.H{"error": "ISM-level access or higher required"})
		return
	}
	requestID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request id"})
		return
	}
	// Read raw JSON body — we store it as-is in the JSONB column.
	body, err := io.ReadAll(c.Request.Body)
	if err != nil || len(body) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "request body required"})
		return
	}
	if err := h.service.SaveRequestSFAFDraft(requestID, body); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "draft saved"})
}

// ReviewFrequencyRequest updates the status of a frequency request (s6/admin only)
// PUT /api/frequency/requests/:id/review
func (h *FrequencyHandler) ReviewFrequencyRequest(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	if !atLeast(c, "ism") {
		c.JSON(http.StatusForbidden, gin.H{"error": "ISM-level access or higher required"})
		return
	}

	requestID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request id"})
		return
	}

	var input struct {
		Status string `json:"status" binding:"required"`
		Notes  string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	request, err := h.service.ReviewFrequencyRequest(requestID, userID.(uuid.UUID), input.Status, input.Notes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "request reviewed successfully",
		"request": request,
	})
}

// ApproveFrequencyRequest approves a request and creates assignment (admin only)
// POST /api/frequency/requests/:id/approve
func (h *FrequencyHandler) ApproveFrequencyRequest(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	if !atLeast(c, "ism") {
		c.JSON(http.StatusForbidden, gin.H{"error": "ISM-level access or higher required"})
		return
	}

	requestID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request id"})
		return
	}

	var assignmentInput models.CreateFrequencyAssignmentInput
	if err := c.ShouldBindJSON(&assignmentInput); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// A and T are final assignments — only Agency, NTIA, or Admin may create them.
	// P and S are proposals — ISM and above may create them.
	recordType := assignmentInput.SFAFRecordType
	if recordType == "" {
		recordType = "A"
	}
	if recordType == "A" || recordType == "T" {
		if !atLeast(c, "agency") {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "Only Agency, NTIA, or Admin may create final assignments (A/T). Use record type P or S to submit a proposal.",
			})
			return
		}
	}

	request, assignment, err := h.service.ApproveAndCreateAssignment(
		requestID,
		userID.(uuid.UUID),
		&assignmentInput,
	)
	if err != nil {
		_ = c.Error(err) // surfaces in middleware log
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "request approved and assignment created",
		"request":    request,
		"assignment": assignment,
	})
}

// GetSubmittedAssignments returns all P/S assignments from the current user's ISM unit.
// GET /api/frequency/assignments/submitted
func (h *FrequencyHandler) GetSubmittedAssignments(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}
	result, err := h.service.GetSubmittedAssignments(userID.(uuid.UUID))
	if err != nil {
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"assignments": result})
}

// GetInboundAssignments returns P/S assignments routed to the current user's ISM workbox.
// GET /api/frequency/assignments/inbound
func (h *FrequencyHandler) GetInboundAssignments(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}
	result, err := h.service.GetInboundAssignments(userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"assignments": result})
}

// GetProposalAssignments returns active P/S proposals visible to the requesting user.
// command/combatant_command: only proposals routed to them (or unrouted).
// agency/ntia/admin: all proposals.
// GET /api/frequency/assignments/proposals
func (h *FrequencyHandler) GetProposalAssignments(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}
	if !atLeast(c, "command") {
		c.JSON(http.StatusForbidden, gin.H{"error": "command-level access or higher required"})
		return
	}

	role, _ := c.Get("role")
	roleStr, _ := role.(string)

	proposals, err := h.service.GetProposalAssignments(userID.(uuid.UUID), roleStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"proposals": proposals})
}

// RetractAssignment deactivates a P/S proposal created by the caller (ISM+).
// PUT /api/frequency/assignments/:id/retract
func (h *FrequencyHandler) RetractAssignment(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}
	if !atLeast(c, "ism") {
		c.JSON(http.StatusForbidden, gin.H{"error": "ism-level access or higher required"})
		return
	}
	assignmentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignment id"})
		return
	}
	resetCount, err := h.service.RetractProposalAssignment(assignmentID, userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "proposal retracted", "requests_returned": resetCount})
}

// GetFiveYearReviews returns permanent assignments due for 5-year review scoped
// to the requesting ISM's installation (admins see all).
// GET /api/frequency/assignments/five-year-review
func (h *FrequencyHandler) GetFiveYearReviews(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}
	if !atLeast(c, "ism") {
		c.JSON(http.StatusForbidden, gin.H{"error": "ism-level access or higher required"})
		return
	}
	role, _ := c.Get("role")
	roleStr, _ := role.(string)
	result, err := h.service.GetFiveYearReviews(userID.(uuid.UUID), roleStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"assignments": result})
}

// GetWorkboxes returns workboxes from the database (replaces the old hardcoded list).
// GET /api/frequency/reviewers  (path kept for backward compatibility)
func (h *FrequencyHandler) GetWorkboxes(c *gin.Context) {
	wbs, err := h.service.GetAllWorkboxes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// Keep the existing API shape (array of name strings) for backward compatibility,
	// but also include full objects for new consumers.
	names := make([]string, 0, len(wbs))
	for _, w := range wbs {
		if w.IsActive {
			names = append(names, w.Name)
		}
	}
	c.JSON(http.StatusOK, gin.H{"workboxes": names, "workbox_objects": wbs})
}

// GetWorkboxObjects returns full workbox objects for management UI.
// GET /api/workboxes
func (h *FrequencyHandler) GetWorkboxObjects(c *gin.Context) {
	wbs, err := h.service.GetAllWorkboxes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"workboxes": wbs})
}

// CreateWorkbox adds a new workbox.
// POST /api/workboxes
func (h *FrequencyHandler) CreateWorkbox(c *gin.Context) {
	var req models.CreateWorkboxRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	w := models.Workbox{
		Name:           req.Name,
		Description:    req.Description,
		InstallationID: req.InstallationID,
		IsActive:       true,
	}
	if err := h.service.CreateWorkbox(&w); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"workbox": w})
}

// UpdateWorkbox edits an existing workbox.
// PUT /api/workboxes/:id
func (h *FrequencyHandler) UpdateWorkbox(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req models.UpdateWorkboxRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	w := models.Workbox{
		ID:             id,
		Name:           req.Name,
		Description:    req.Description,
		InstallationID: req.InstallationID,
		IsActive:       req.IsActive,
	}
	if err := h.service.UpdateWorkbox(&w); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"workbox": w})
}

// DeleteWorkbox removes a workbox.
// DELETE /api/workboxes/:id
func (h *FrequencyHandler) DeleteWorkbox(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := h.service.DeleteWorkbox(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// GetWorkboxMembers returns users assigned to a workbox.
// GET /api/workboxes/:id/members
func (h *FrequencyHandler) GetWorkboxMembers(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	members, err := h.service.GetWorkboxMembers(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"members": members})
}

// AddWorkboxMember assigns a user to a workbox.
// POST /api/workboxes/:id/members
func (h *FrequencyHandler) AddWorkboxMember(c *gin.Context) {
	workboxID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workbox id"})
		return
	}
	var req models.AssignWorkboxMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: " + err.Error()})
		return
	}
	if err := h.service.AddWorkboxMember(req.UserID, workboxID, req.IsPrimary); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// RemoveWorkboxMember removes a user from a workbox.
// DELETE /api/workboxes/:id/members/:user_id
func (h *FrequencyHandler) RemoveWorkboxMember(c *gin.Context) {
	workboxID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workbox id"})
		return
	}
	userID, err := uuid.Parse(c.Param("user_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}
	if err := h.service.RemoveWorkboxMember(userID, workboxID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// GetUserWorkboxAssignments returns all workboxes a user is assigned to.
// GET /api/users/:id/workboxes
func (h *FrequencyHandler) GetUserWorkboxAssignments(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}
	assignments, err := h.service.GetUserWorkboxAssignments(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"workboxes": assignments})
}

// ElevateAssignment promotes a P→A or S→T final assignment (agency-level and above)
// PUT /api/frequency/assignments/:id/elevate
func (h *FrequencyHandler) ElevateAssignment(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	if !atLeast(c, "agency") {
		c.JSON(http.StatusForbidden, gin.H{"error": "agency-level access or higher required to finalize assignments"})
		return
	}

	assignmentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignment id"})
		return
	}

	var body struct {
		Notes string `json:"notes"`
	}
	_ = c.ShouldBindJSON(&body)

	assignment, err := h.service.ElevateAssignment(assignmentID, userID.(uuid.UUID), body.Notes)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	finalType := map[string]string{"A": "Permanent Assignment", "T": "Temporary Assignment"}[assignment.SFAFRecordType]
	c.JSON(http.StatusOK, gin.H{
		"message":    "proposal elevated to " + finalType,
		"assignment": assignment,
	})
}

// BulkRouteRequests sets routed_to_workbox on multiple frequency requests at once.
// PUT /api/frequency/requests/bulk-route
func (h *FrequencyHandler) BulkRouteRequests(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}
	if !atLeast(c, "ism") {
		c.JSON(http.StatusForbidden, gin.H{"error": "ISM-level access or higher required"})
		return
	}

	var body struct {
		RequestIDs []string `json:"request_ids" binding:"required"`
		RoutedTo   *string  `json:"routed_to"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(body.RequestIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no request_ids provided"})
		return
	}

	ids := make([]uuid.UUID, 0, len(body.RequestIDs))
	for _, s := range body.RequestIDs {
		id, err := uuid.Parse(s)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request id: " + s})
			return
		}
		ids = append(ids, id)
	}

	var workbox *string
	if body.RoutedTo != nil && *body.RoutedTo != "" {
		workbox = body.RoutedTo
	}

	isAdmin := atLeast(c, "admin")
	count, err := h.service.BulkRouteRequests(ids, workbox, userID.(uuid.UUID), isAdmin)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": count})
}

// BulkRouteAssignments sets routed_to on multiple P/S proposals at once.
// ISMs may only route proposals they own; admins bypass the ownership check.
// PUT /api/frequency/assignments/bulk-route
func (h *FrequencyHandler) BulkRouteAssignments(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}
	if !atLeast(c, "ism") {
		c.JSON(http.StatusForbidden, gin.H{"error": "ISM-level access or higher required"})
		return
	}

	var body struct {
		AssignmentIDs []string `json:"assignment_ids" binding:"required"`
		RoutedTo      *string  `json:"routed_to"` // workbox name, null = unroute
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(body.AssignmentIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no assignment_ids provided"})
		return
	}

	ids := make([]uuid.UUID, 0, len(body.AssignmentIDs))
	for _, s := range body.AssignmentIDs {
		id, err := uuid.Parse(s)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignment id: " + s})
			return
		}
		ids = append(ids, id)
	}

	var workbox *string
	if body.RoutedTo != nil && *body.RoutedTo != "" {
		workbox = body.RoutedTo
	}

	isAdmin := atLeast(c, "admin")
	count, err := h.service.BulkRouteAssignments(ids, workbox, userID.(uuid.UUID), isAdmin)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": count})
}

// SetCoordinations replaces the lateral coordination workboxes for a proposal.
// PUT /api/frequency/assignments/:id/coordinations
func (h *FrequencyHandler) SetCoordinations(c *gin.Context) {
	if !atLeast(c, "ism") {
		c.JSON(http.StatusForbidden, gin.H{"error": "ism-level access required"})
		return
	}
	assignmentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignment id"})
		return
	}
	var body struct {
		Workboxes []string `json:"workboxes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.Workboxes == nil {
		body.Workboxes = []string{}
	}
	if err := h.service.SetCoordinations(assignmentID, body.Workboxes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"workboxes": body.Workboxes})
}

// AddComment adds a comment to a proposal's comment log.
// POST /api/frequency/assignments/:id/comments
func (h *FrequencyHandler) AddComment(c *gin.Context) {
	if !atLeast(c, "ism") {
		c.JSON(http.StatusForbidden, gin.H{"error": "ism-level access required"})
		return
	}
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}
	assignmentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignment id"})
		return
	}
	var body struct {
		Workbox string `json:"workbox" binding:"required"`
		Body    string `json:"body"    binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	comment, err := h.service.AddComment(assignmentID, userID.(uuid.UUID), body.Workbox, body.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, comment)
}

// GetComments returns the comment log for a proposal.
// GET /api/frequency/assignments/:id/comments
func (h *FrequencyHandler) GetComments(c *gin.Context) {
	if !atLeast(c, "ism") {
		c.JSON(http.StatusForbidden, gin.H{"error": "ism-level access required"})
		return
	}
	assignmentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignment id"})
		return
	}
	comments, err := h.service.GetComments(assignmentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"comments": comments})
}

// AddRequestComment adds a status-log comment to a pending frequency request.
// POST /api/frequency/requests/:id/comments
func (h *FrequencyHandler) AddRequestComment(c *gin.Context) {
	if !atLeast(c, "ism") {
		c.JSON(http.StatusForbidden, gin.H{"error": "ism-level access required"})
		return
	}
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}
	requestID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request id"})
		return
	}
	var body struct {
		Workbox string `json:"workbox"`
		Body    string `json:"body" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Fall back to the user's ISM unit name if workbox not supplied by client
	if body.Workbox == "" {
		if ismUnit, err := h.service.GetUserISMUnit(userID.(uuid.UUID)); err == nil {
			body.Workbox = ismUnit.Name
		}
	}
	comment, err := h.service.AddRequestComment(requestID, userID.(uuid.UUID), body.Workbox, body.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, comment)
}

// GetRequestComments returns the status log for a pending frequency request.
// GET /api/frequency/requests/:id/comments
func (h *FrequencyHandler) GetRequestComments(c *gin.Context) {
	if !atLeast(c, "ism") {
		c.JSON(http.StatusForbidden, gin.H{"error": "ism-level access required"})
		return
	}
	requestID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request id"})
		return
	}
	comments, err := h.service.GetRequestComments(requestID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"comments": comments})
}

// SetRequestCoordinations sets lateral coordination workboxes for a pending request.
// PUT /api/frequency/requests/:id/coordinations
func (h *FrequencyHandler) SetRequestCoordinations(c *gin.Context) {
	if !atLeast(c, "ism") {
		c.JSON(http.StatusForbidden, gin.H{"error": "ism-level access required"})
		return
	}
	requestID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request id"})
		return
	}
	var body struct {
		Workboxes []string `json:"workboxes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.Workboxes == nil {
		body.Workboxes = []string{}
	}
	if err := h.service.SetRequestCoordinations(requestID, body.Workboxes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"workboxes": body.Workboxes})
}

// ============================================
// Helper middleware for frequency routes
// ============================================

// CleanupOrphanedAssignments removes frequency assignments that don't have corresponding SFAF records
// POST /api/frequency/cleanup-orphaned (admin only)
func (h *FrequencyHandler) CleanupOrphanedAssignments(c *gin.Context) {
	if !atLeast(c, "admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
		return
	}

	deleted, err := h.service.CleanupOrphanedAssignments()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Cleanup completed successfully",
		"deleted": deleted,
	})
}

// ── Control Numbers (702) ─────────────────────────────────────────────────────

// GET /api/control-numbers
func (h *FrequencyHandler) GetControlNumbers(c *gin.Context) {
	rows, err := h.service.GetControlNumbers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"control_numbers": rows})
}

// POST /api/control-numbers
func (h *FrequencyHandler) CreateControlNumber(c *gin.Context) {
	var cn models.ControlNumber
	if err := c.ShouldBindJSON(&cn); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.service.CreateControlNumber(&cn); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, cn)
}

// PUT /api/control-numbers/:id
func (h *FrequencyHandler) UpdateControlNumber(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var cn models.ControlNumber
	if err := c.ShouldBindJSON(&cn); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	cn.ID = id
	if err := h.service.UpdateControlNumber(&cn); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cn)
}

// DELETE /api/control-numbers/:id
func (h *FrequencyHandler) DeleteControlNumber(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := h.service.DeleteControlNumber(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
