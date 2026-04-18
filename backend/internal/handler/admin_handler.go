package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"orchidmart-backend/internal/model"
)

type AdminHandler struct {
	db *gorm.DB
}

func NewAdminHandler(db *gorm.DB) *AdminHandler {
	return &AdminHandler{db}
}

func (h *AdminHandler) GetKPI(c *gin.Context) {
	var totalRevenue float64
	var totalOrders int64
	var totalCustomers int64
	var lowStockItems int64

	h.db.Model(&model.Order{}).Where("status = ?", "PAID").Select("COALESCE(SUM(total), 0)").Scan(&totalRevenue)
	h.db.Model(&model.Order{}).Where("status != ?", "CANCELLED").Count(&totalOrders)
	h.db.Model(&model.User{}).Where("role = ?", "customer").Count(&totalCustomers)
	h.db.Model(&model.Inventory{}).Where("quantity <= low_stock_threshold").Count(&lowStockItems)

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"revenue":   totalRevenue,
			"orders":    totalOrders,
			"customers": totalCustomers,
			"low_stock": lowStockItems,
		},
	})
}
