// handlers/sfaf_field_registry_handler.go
package handlers

import (
	"net/http"
	"sfaf-plotter/models"
	"sfaf-plotter/repositories"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ─────────────────────────────────────────────
// SFAFFieldCategoryHandler
// ─────────────────────────────────────────────

type SFAFFieldCategoryHandler struct {
	repo *repositories.SFAFFieldCategoryRepository
}

func NewSFAFFieldCategoryHandler(repo *repositories.SFAFFieldCategoryRepository) *SFAFFieldCategoryHandler {
	return &SFAFFieldCategoryHandler{repo: repo}
}

// GET /api/sfaf-categories
func (h *SFAFFieldCategoryHandler) GetAll(c *gin.Context) {
	rows, err := h.repo.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"categories": rows, "count": len(rows)})
}

// POST /api/sfaf-categories
func (h *SFAFFieldCategoryHandler) Create(c *gin.Context) {
	var req models.CreateSFAFFieldCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}
	cat := &models.SFAFFieldCategory{Name: req.Name, SortOrder: req.SortOrder}
	if err := h.repo.Create(cat); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create category: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"category": cat})
}

// PUT /api/sfaf-categories/:id
func (h *SFAFFieldCategoryHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	var req models.UpdateSFAFFieldCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}
	cat := &models.SFAFFieldCategory{ID: id, Name: req.Name, SortOrder: req.SortOrder}
	if err := h.repo.Update(cat); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update category: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"category": cat})
}

// DELETE /api/sfaf-categories/:id
func (h *SFAFFieldCategoryHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	if err := h.repo.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete category: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ─────────────────────────────────────────────
// SFAFFieldDefinitionHandler
// ─────────────────────────────────────────────

type SFAFFieldDefinitionHandler struct {
	repo *repositories.SFAFFieldDefinitionRepository
}

func NewSFAFFieldDefinitionHandler(repo *repositories.SFAFFieldDefinitionRepository) *SFAFFieldDefinitionHandler {
	return &SFAFFieldDefinitionHandler{repo: repo}
}

// GET /api/sfaf-field-defs?category_id=<uuid>
func (h *SFAFFieldDefinitionHandler) GetAll(c *gin.Context) {
	catIDStr := c.Query("category_id")
	if catIDStr != "" {
		catID, err := uuid.Parse(catIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category_id"})
			return
		}
		rows, err := h.repo.GetByCategory(catID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"fields": rows, "count": len(rows)})
		return
	}
	rows, err := h.repo.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"fields": rows, "count": len(rows)})
}

// PUT /api/sfaf-field-defs/:id
func (h *SFAFFieldDefinitionHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	var req models.UpdateSFAFFieldDefinitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}
	if err := h.repo.Update(id, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update field: " + err.Error()})
		return
	}
	// Return updated record
	updated, err := h.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": true})
		return
	}
	c.JSON(http.StatusOK, gin.H{"field": updated})
}

// ─────────────────────────────────────────────
// SFAFRequiredFieldHandler
// ─────────────────────────────────────────────

type SFAFRequiredFieldHandler struct {
	repo *repositories.SFAFRequiredFieldRepository
}

func NewSFAFRequiredFieldHandler(repo *repositories.SFAFRequiredFieldRepository) *SFAFRequiredFieldHandler {
	return &SFAFRequiredFieldHandler{repo: repo}
}

// GET /api/sfaf-required?scope_type=global&scope_value=
func (h *SFAFRequiredFieldHandler) GetAll(c *gin.Context) {
	scopeType := c.Query("scope_type")
	scopeValue := c.Query("scope_value")
	if scopeType != "" {
		rows, err := h.repo.GetByScope(scopeType, scopeValue)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"required_fields": rows, "count": len(rows)})
		return
	}
	rows, err := h.repo.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"required_fields": rows, "count": len(rows)})
}

// POST /api/sfaf-required
func (h *SFAFRequiredFieldHandler) Create(c *gin.Context) {
	var req models.CreateSFAFRequiredFieldRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Get caller's user ID from session if available
	var createdBy *uuid.UUID
	if userID, exists := c.Get("userID"); exists {
		if uid, ok := userID.(uuid.UUID); ok {
			createdBy = &uid
		}
	}

	row, err := h.repo.Create(&req, createdBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create required field: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"required_field": row})
}

// DELETE /api/sfaf-required/:id
func (h *SFAFRequiredFieldHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	if err := h.repo.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete required field: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// DELETE /api/sfaf-required (by scope + field_number in body)
func (h *SFAFRequiredFieldHandler) DeleteByScope(c *gin.Context) {
	var body struct {
		FieldNumber string `json:"field_number" binding:"required"`
		ScopeType   string `json:"scope_type" binding:"required"`
		ScopeValue  string `json:"scope_value"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}
	if err := h.repo.DeleteByScope(body.FieldNumber, body.ScopeType, body.ScopeValue); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
