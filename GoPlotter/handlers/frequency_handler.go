// handlers/frequency_handler.go
package handlers

import (
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

	// Check if user is admin - admins see all units
	role, _ := c.Get("role")
	var units []models.UnitWithAssignments
	var err error

	if role == "admin" {
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

// CreateUnit creates a new unit (admin only)
// POST /api/frequency/units
func (h *FrequencyHandler) CreateUnit(c *gin.Context) {
	_, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	// Check if user is admin
	role, _ := c.Get("role")
	if role != "admin" {
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

	// Check if user is admin
	role, _ := c.Get("role")
	if role != "admin" {
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

	// Check if user is admin
	role, _ := c.Get("role")
	if role != "admin" {
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

// GetPendingRequests returns all pending/under review requests (s6/admin only)
// GET /api/frequency/requests/pending
func (h *FrequencyHandler) GetPendingRequests(c *gin.Context) {
	role, exists := c.Get("role")
	if !exists || (role != "admin" && role != "s6") {
		c.JSON(http.StatusForbidden, gin.H{"error": "s6 or admin access required"})
		return
	}

	requests, err := h.service.GetPendingRequestsWithDetails()
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

// ReviewFrequencyRequest updates the status of a frequency request (s6/admin only)
// PUT /api/frequency/requests/:id/review
func (h *FrequencyHandler) ReviewFrequencyRequest(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	role, _ := c.Get("role")
	if role != "admin" && role != "s6" {
		c.JSON(http.StatusForbidden, gin.H{"error": "s6 or admin access required"})
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

	role, _ := c.Get("role")
	if role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
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

	request, assignment, err := h.service.ApproveAndCreateAssignment(
		requestID,
		userID.(uuid.UUID),
		&assignmentInput,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "request approved and assignment created",
		"request":    request,
		"assignment": assignment,
	})
}

// ============================================
// Helper middleware for frequency routes
// ============================================

// RequireAuth middleware to verify user is authenticated
func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// This should check session token and set userID, role in context
		// For now, this is a placeholder - integrate with your existing auth
		token := c.GetHeader("Authorization")
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
			c.Abort()
			return
		}

		// TODO: Validate token and extract user info
		// For now, just check if token exists
		c.Next()
	}
}

// RequireRole middleware to verify user has required role
func RequireRole(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "role not found"})
			c.Abort()
			return
		}

		roleStr := role.(string)
		for _, allowedRole := range allowedRoles {
			if roleStr == allowedRole {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
		c.Abort()
	}
}

// CleanupOrphanedAssignments removes frequency assignments that don't have corresponding SFAF records
// POST /api/frequency/cleanup-orphaned (admin only)
func (h *FrequencyHandler) CleanupOrphanedAssignments(c *gin.Context) {
	// Check if user is admin
	role, _ := c.Get("role")
	if role != "admin" {
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
