// handlers/auth_handler.go
package handlers

import (
	"net/http"
	"sfaf-plotter/models"
	"sfaf-plotter/services"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	authService *services.AuthService
}

func NewAuthHandler(authService *services.AuthService) *AuthHandler {
	return &AuthHandler{
		authService: authService,
	}
}

// Login handles password-based login
// POST /api/auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	var req models.PasswordLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.PasswordLoginResponse{
			Success: false,
			Message: "Invalid request format",
		})
		return
	}

	// Get client info
	ipAddress := c.ClientIP()
	userAgent := c.Request.UserAgent()

	// Authenticate
	user, token, err := h.authService.AuthenticatePassword(req.Username, req.Password, ipAddress, userAgent)
	if err != nil {
		c.JSON(http.StatusUnauthorized, models.PasswordLoginResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	// Set session cookie
	c.SetCookie(
		"session_token",
		token,
		86400, // 24 hours
		"/",
		"",
		false, // Set to true if using HTTPS
		true,  // HttpOnly
	)

	c.JSON(http.StatusOK, models.PasswordLoginResponse{
		Success: true,
		Message: "Login successful",
		Token:   token,
		User:    user,
	})
}

// Logout handles session logout
// POST /api/auth/logout
func (h *AuthHandler) Logout(c *gin.Context) {
	// Get token from cookie or header
	token, err := c.Cookie("session_token")
	if err != nil {
		// Try Authorization header
		token = c.GetHeader("Authorization")
		if token == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "No session found",
			})
			return
		}
	}

	// Delete session
	err = h.authService.Logout(token)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to logout",
		})
		return
	}

	// Clear cookie
	c.SetCookie("session_token", "", -1, "/", "", false, true)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Logged out successfully",
	})
}

// VerifySession validates the current session
// GET /api/auth/session
func (h *AuthHandler) VerifySession(c *gin.Context) {
	// Get token from cookie or header
	token, err := c.Cookie("session_token")
	if err != nil {
		token = c.GetHeader("Authorization")
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"valid": false,
				"message": "No session found",
			})
			return
		}
	}

	// Validate session
	user, err := h.authService.ValidateSession(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"valid": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"valid": true,
		"user":  user,
	})
}

// CreateSuperuser creates the initial superuser account (development only)
// POST /api/auth/create-superuser
func (h *AuthHandler) CreateSuperuser(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
		Email    string `json:"email" binding:"required"`
		FullName string `json:"full_name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request format",
		})
		return
	}

	user, err := h.authService.CreateSuperuser(req.Username, req.Password, req.Email, req.FullName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Superuser created successfully",
		"user":    user,
	})
}
