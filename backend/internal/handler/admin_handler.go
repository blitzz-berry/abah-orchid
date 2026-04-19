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

func (h *AdminHandler) GetOrders(c *gin.Context) {
	var orders []model.Order
	if err := h.db.Preload("Items").Preload("User").Order("created_at desc").Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch orders"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": orders})
}

func (h *AdminHandler) GetCustomers(c *gin.Context) {
	var users []model.User
	if err := h.db.Where("role = ?", "customer").Order("created_at desc").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch customers"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": users})
}

func (h *AdminHandler) GetCustomerByID(c *gin.Context) {
	id := c.Param("id")
	var user model.User
	if err := h.db.Preload("Orders").Where("id = ?", id).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": user})
}

func (h *AdminHandler) UpdateOrderStatus(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.db.Model(&model.Order{}).Where("id = ?", id).Update("status", req.Status).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update status"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Status updated"})
}

func (h *AdminHandler) UpdateOrderTracking(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		TrackingNumber string `json:"tracking_number" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.db.Model(&model.Order{}).Where("id = ?", id).Updates(map[string]interface{}{
		"tracking_number": req.TrackingNumber,
		"status":          "SHIPPED",
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update tracking"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Tracking updated"})
}

func (h *AdminHandler) GetMovements(c *gin.Context) {
	var movements []model.StockMovement
	if err := h.db.Preload("Product").Order("created_at desc").Limit(50).Find(&movements).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch movements"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": movements})
}
