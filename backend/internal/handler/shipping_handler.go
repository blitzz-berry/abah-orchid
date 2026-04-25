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
	provinceID := c.Param("province_id")
	if provinceID == "" {
		provinceID = c.Query("province")
	}
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

func (h *ShippingHandler) Track(c *gin.Context) {
	trackingNumber := c.Param("tracking_number")
	if trackingNumber == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tracking number is required"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"tracking_number": trackingNumber,
		"status":          "Tracking provider is not configured",
		"history":         []gin.H{},
	}})
}

func (h *ShippingHandler) LivePlantOptions(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"packing_options": []gin.H{
			{"code": "standard", "name": "Standard live plant packing", "cost": 0},
			{"code": "premium", "name": "Premium rigid box + moisture protection", "cost": 15000},
		},
		"insurance":            gin.H{"available": true, "recommended": true},
		"disclaimer":           "Live plant shipping requires unboxing video evidence for damage claims. Fast service is recommended for long-distance delivery.",
		"recommended_services": []string{"YES", "REG", "SDS", "Next Day"},
	}})
}
