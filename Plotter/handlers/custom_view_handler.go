package handlers

import (
	"net/http"
	"sfaf-plotter/models"
	"sfaf-plotter/repositories"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type CustomViewHandler struct {
	repo *repositories.CustomViewRepository
}

func NewCustomViewHandler(repo *repositories.CustomViewRepository) *CustomViewHandler {
	return &CustomViewHandler{repo: repo}
}

func (h *CustomViewHandler) getUserID(c *gin.Context) (uuid.UUID, bool) {
	raw, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, NewErrorResponse("not authenticated"))
		return uuid.Nil, false
	}
	id, ok := raw.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, NewErrorResponse("invalid session"))
		return uuid.Nil, false
	}
	return id, true
}

// GET /api/custom-views
func (h *CustomViewHandler) List(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}
	views, err := h.repo.GetByUserID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, NewErrorResponse("failed to load views: "+err.Error()))
		return
	}
	if views == nil {
		views = []*models.CustomView{}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "views": views})
}

// POST /api/custom-views
func (h *CustomViewHandler) Create(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}
	var body struct {
		Name        string             `json:"name"        binding:"required"`
		Description string             `json:"description"`
		Fields      []models.ViewField `json:"fields"      binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, NewErrorResponse("invalid request: "+err.Error()))
		return
	}
	view, err := h.repo.Create(userID, body.Name, body.Description, body.Fields)
	if err != nil {
		c.JSON(http.StatusInternalServerError, NewErrorResponse("failed to create view: "+err.Error()))
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "view": view})
}

// PUT /api/custom-views/:id
func (h *CustomViewHandler) Update(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}
	viewID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, NewErrorResponse("invalid view ID"))
		return
	}
	var body struct {
		Name        string             `json:"name"        binding:"required"`
		Description string             `json:"description"`
		Fields      []models.ViewField `json:"fields"      binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, NewErrorResponse("invalid request: "+err.Error()))
		return
	}
	view, err := h.repo.Update(viewID, userID, body.Name, body.Description, body.Fields)
	if err != nil {
		c.JSON(http.StatusNotFound, NewErrorResponse(err.Error()))
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "view": view})
}

// DELETE /api/custom-views/:id
func (h *CustomViewHandler) Delete(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}
	viewID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, NewErrorResponse("invalid view ID"))
		return
	}
	if err := h.repo.Delete(viewID, userID); err != nil {
		c.JSON(http.StatusNotFound, NewErrorResponse(err.Error()))
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
