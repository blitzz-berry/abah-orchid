package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"orchidmart-backend/internal/pkg/rajaongkir"
)

type ShippingHandler struct{}

func NewShippingHandler() *ShippingHandler {
	return &ShippingHandler{}
}

func (h *ShippingHandler) GetProvinces(c *gin.Context) {
	data, err := rajaongkir.GetProvinces()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, data)
}

func (h *ShippingHandler) GetCities(c *gin.Context) {
	provinceID := c.Query("province")
	data, err := rajaongkir.GetCities(provinceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, data)
}

func (h *ShippingHandler) GetCost(c *gin.Context) {
	var payload rajaongkir.CostPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	data, err := rajaongkir.GetCost(payload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, data)
}
