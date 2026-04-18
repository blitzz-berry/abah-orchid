package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"orchidmart-backend/internal/dto/request"
	"orchidmart-backend/internal/dto/response"
	"orchidmart-backend/internal/service"
)

type AuthHandler struct {
	authService service.AuthService
}

func NewAuthHandler(authService service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req request.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.authService.Register(req.Email, req.Password, req.FullName, req.Phone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res := response.UserResponse{
		ID:        user.ID,
		Email:     user.Email,
		FullName:  user.FullName,
		Phone:     user.Phone,
		Role:      user.Role,
		CreatedAt: user.CreatedAt,
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Registration successful", "data": res})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req request.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	acToken, rfToken, err := h.authService.Login(req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"data": gin.H{
			"access_token":  acToken,
			"refresh_token": rfToken,
		},
	})
}
