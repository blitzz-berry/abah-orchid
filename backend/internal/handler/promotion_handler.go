package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"orchidmart-backend/internal/model"
	"orchidmart-backend/internal/service"
)

type PromotionHandler interface {
	CreatePromotion(c *gin.Context)
	GetAllPromotions(c *gin.Context)
	TogglePromotionStatus(c *gin.Context)
	DeletePromotion(c *gin.Context)
}

type promotionHandler struct {
	promotionSvc service.PromotionService
}

func NewPromotionHandler(promotionSvc service.PromotionService) PromotionHandler {
	return &promotionHandler{promotionSvc: promotionSvc}
}

func (h *promotionHandler) CreatePromotion(c *gin.Context) {
	var promo model.Promotion
	if err := c.ShouldBindJSON(&promo); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.promotionSvc.CreatePromotion(&promo); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, promo)
}

func (h *promotionHandler) GetAllPromotions(c *gin.Context) {
	promos, err := h.promotionSvc.GetAllPromotions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, promos)
}

func (h *promotionHandler) TogglePromotionStatus(c *gin.Context) {
	idParam := c.Param("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id format"})
		return
	}
	if err := h.promotionSvc.TogglePromotionStatus(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "status toggled"})
}

func (h *promotionHandler) DeletePromotion(c *gin.Context) {
	idParam := c.Param("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id format"})
		return
	}
	if err := h.promotionSvc.DeletePromotion(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "promotion deleted"})
}
