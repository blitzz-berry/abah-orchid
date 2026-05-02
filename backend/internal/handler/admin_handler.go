package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"orchidmart-backend/internal/model"
	"orchidmart-backend/internal/service"
)

type AdminHandler struct {
	db           *gorm.DB
	orderService service.OrderService
}

type salesPoint struct {
	Label   string  `json:"label"`
	Revenue float64 `json:"revenue"`
	Orders  int64   `json:"orders"`
}

type topProduct struct {
	ProductID string  `json:"product_id"`
	Name      string  `json:"name"`
	Quantity  int64   `json:"quantity"`
	Revenue   float64 `json:"revenue"`
}

func NewAdminHandler(db *gorm.DB, orderService service.OrderService) *AdminHandler {
	return &AdminHandler{db: db, orderService: orderService}
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

func (h *AdminHandler) GetAnalyticsOverview(c *gin.Context) {
	now := time.Now()
	start := now.AddDate(0, 0, -6)

	var totalRevenue float64
	var totalOrders int64
	var totalCustomers int64
	var lowStockItems int64
	var paidOrders int64

	successStatuses := []string{"PAID", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"}

	h.db.Model(&model.Order{}).Where("status IN ?", successStatuses).Select("COALESCE(SUM(total), 0)").Scan(&totalRevenue)
	h.db.Model(&model.Order{}).Where("status != ?", "CANCELLED").Count(&totalOrders)
	h.db.Model(&model.Order{}).Where("status IN ?", successStatuses).Count(&paidOrders)
	h.db.Model(&model.User{}).Where("role = ?", "customer").Count(&totalCustomers)
	h.db.Model(&model.Inventory{}).Where("quantity <= low_stock_threshold").Count(&lowStockItems)

	var orders []model.Order
	_ = h.db.Preload("Items").Where("created_at >= ?", start).Order("created_at asc").Find(&orders).Error

	salesSeries := make([]salesPoint, 0, 7)
	for i := 0; i < 7; i++ {
		day := start.AddDate(0, 0, i)
		label := day.Format("02 Jan")
		point := salesPoint{Label: label}
		for _, order := range orders {
			if sameDay(order.CreatedAt, day) {
				point.Orders++
				if containsStatus(successStatuses, order.Status) {
					point.Revenue += order.Total
				}
			}
		}
		salesSeries = append(salesSeries, point)
	}

	type statusRow struct {
		Status string `json:"status"`
		Count  int64  `json:"count"`
	}
	var statusRows []statusRow
	_ = h.db.Model(&model.Order{}).
		Select("status, COUNT(*) as count").
		Group("status").
		Scan(&statusRows).Error

	statusMap := gin.H{}
	for _, row := range statusRows {
		statusMap[row.Status] = row.Count
	}

	var topProducts []topProduct
	_ = h.db.Raw(`
		SELECT
			order_items.product_id::text as product_id,
			order_items.product_name as name,
			COALESCE(SUM(order_items.quantity), 0) as quantity,
			COALESCE(SUM(order_items.subtotal), 0) as revenue
		FROM order_items
		JOIN orders ON orders.id = order_items.order_id
		WHERE orders.status IN ?
		GROUP BY order_items.product_id, order_items.product_name
		ORDER BY quantity DESC, revenue DESC
		LIMIT 5
	`, successStatuses).Scan(&topProducts).Error

	var b2bCount int64
	var b2cCount int64
	h.db.Model(&model.User{}).Where("role = ? AND customer_type = ?", "customer", "B2B").Count(&b2bCount)
	h.db.Model(&model.User{}).Where("role = ? AND (customer_type = ? OR customer_type = '')", "customer", "B2C").Count(&b2cCount)

	var lowStockProducts []model.Product
	_ = h.db.Preload("Inventory").Where("id IN (?)",
		h.db.Model(&model.Inventory{}).Select("product_id").Where("quantity <= low_stock_threshold").Limit(5),
	).Limit(5).Find(&lowStockProducts).Error

	aov := 0.0
	if paidOrders > 0 {
		aov = totalRevenue / float64(paidOrders)
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"kpi": gin.H{
				"revenue":     totalRevenue,
				"orders":      totalOrders,
				"customers":   totalCustomers,
				"low_stock":   lowStockItems,
				"aov":         aov,
				"paid_orders": paidOrders,
			},
			"sales_series":       salesSeries,
			"order_statuses":     statusMap,
			"top_products":       topProducts,
			"customer_segments":  gin.H{"b2b": b2bCount, "b2c": b2cCount},
			"low_stock_products": lowStockProducts,
		},
	})
}

func (h *AdminHandler) GetSalesAnalytics(c *gin.Context) {
	start, end := analyticsRange(c)
	successStatuses := []string{"PAID", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"}

	var revenue float64
	var transactions int64
	h.db.Model(&model.Order{}).Where("status IN ? AND created_at BETWEEN ? AND ?", successStatuses, start, end).Select("COALESCE(SUM(total), 0)").Scan(&revenue)
	h.db.Model(&model.Order{}).Where("status IN ? AND created_at BETWEEN ? AND ?", successStatuses, start, end).Count(&transactions)
	aov := 0.0
	if transactions > 0 {
		aov = revenue / float64(transactions)
	}

	type breakdown struct {
		Method  string  `json:"method"`
		Revenue float64 `json:"revenue"`
		Orders  int64   `json:"orders"`
	}
	var paymentBreakdown []breakdown
	h.db.Raw(`
		SELECT COALESCE(payments.method, 'unknown') AS method,
		       COALESCE(SUM(orders.total), 0) AS revenue,
		       COUNT(*) AS orders
		FROM orders
		LEFT JOIN payments ON payments.order_id = orders.id
		WHERE orders.status IN ? AND orders.created_at BETWEEN ? AND ?
		GROUP BY payments.method
	`, successStatuses, start, end).Scan(&paymentBreakdown)

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"summary":           gin.H{"revenue": revenue, "transactions": transactions, "aov": aov},
		"payment_breakdown": paymentBreakdown,
	}})
}

func (h *AdminHandler) GetSalesChart(c *gin.Context) {
	start, end := analyticsRange(c)
	successStatuses := []string{"PAID", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"}
	var rows []salesPoint
	h.db.Raw(`
		SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS label,
		       COALESCE(SUM(total), 0) AS revenue,
		       COUNT(*) AS orders
		FROM orders
		WHERE status IN ? AND created_at BETWEEN ? AND ?
		GROUP BY DATE_TRUNC('day', created_at)
		ORDER BY DATE_TRUNC('day', created_at)
	`, successStatuses, start, end).Scan(&rows)
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

func (h *AdminHandler) GetTopProducts(c *gin.Context) {
	start, end := analyticsRange(c)
	successStatuses := []string{"PAID", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"}
	var rows []topProduct
	h.db.Raw(`
		SELECT order_items.product_id::text as product_id,
		       order_items.product_name as name,
		       COALESCE(SUM(order_items.quantity), 0) as quantity,
		       COALESCE(SUM(order_items.subtotal), 0) as revenue
		FROM order_items
		JOIN orders ON orders.id = order_items.order_id
		WHERE orders.status IN ? AND orders.created_at BETWEEN ? AND ?
		GROUP BY order_items.product_id, order_items.product_name
		ORDER BY quantity DESC, revenue DESC
		LIMIT 10
	`, successStatuses, start, end).Scan(&rows)
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

func (h *AdminHandler) GetInventoryAnalytics(c *gin.Context) {
	var totalItems int64
	var totalValue float64
	var lowStock int64
	var outOfStock int64
	h.db.Model(&model.Inventory{}).Select("COALESCE(SUM(quantity), 0)").Scan(&totalItems)
	h.db.Raw(`SELECT COALESCE(SUM(inventories.quantity * products.price), 0) FROM inventories JOIN products ON products.id = inventories.product_id`).Scan(&totalValue)
	h.db.Model(&model.Inventory{}).Where("quantity <= low_stock_threshold").Count(&lowStock)
	h.db.Model(&model.Inventory{}).Where("quantity <= 0").Count(&outOfStock)

	var movements []model.StockMovement
	h.db.Preload("Product").Order("created_at desc").Limit(50).Find(&movements)
	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"total_items":      totalItems,
		"total_value":      totalValue,
		"low_stock":        lowStock,
		"out_of_stock":     outOfStock,
		"recent_movements": movements,
	}})
}

func (h *AdminHandler) GetCustomerAnalytics(c *gin.Context) {
	start, end := analyticsRange(c)
	var totalCustomers int64
	var newCustomers int64
	h.db.Model(&model.User{}).Where("role = ?", "customer").Count(&totalCustomers)
	h.db.Model(&model.User{}).Where("role = ? AND created_at BETWEEN ? AND ?", "customer", start, end).Count(&newCustomers)

	type topCustomer struct {
		UserID string  `json:"user_id"`
		Name   string  `json:"name"`
		Email  string  `json:"email"`
		Spend  float64 `json:"spend"`
		Orders int64   `json:"orders"`
	}
	var topCustomers []topCustomer
	h.db.Raw(`
		SELECT users.id::text AS user_id, users.full_name AS name, users.email,
		       COALESCE(SUM(orders.total), 0) AS spend,
		       COUNT(orders.id) AS orders
		FROM users
		JOIN orders ON orders.user_id = users.id
		WHERE users.role = 'customer' AND orders.status IN ?
		GROUP BY users.id, users.full_name, users.email
		ORDER BY spend DESC
		LIMIT 10
	`, []string{"PAID", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"}).Scan(&topCustomers)

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"total_customers": totalCustomers, "new_customers": newCustomers, "top_customers": topCustomers}})
}

func (h *AdminHandler) GetTrendAnalytics(c *gin.Context) {
	start, end := analyticsRange(c)
	type categoryTrend struct {
		Category string  `json:"category"`
		Revenue  float64 `json:"revenue"`
		Quantity int64   `json:"quantity"`
	}
	var categories []categoryTrend
	h.db.Raw(`
		SELECT COALESCE(categories.name, 'Uncategorized') AS category,
		       COALESCE(SUM(order_items.subtotal), 0) AS revenue,
		       COALESCE(SUM(order_items.quantity), 0) AS quantity
		FROM order_items
		JOIN orders ON orders.id = order_items.order_id
		LEFT JOIN products ON products.id = order_items.product_id
		LEFT JOIN categories ON categories.id = products.category_id
		WHERE orders.status IN ? AND orders.created_at BETWEEN ? AND ?
		GROUP BY categories.name
		ORDER BY revenue DESC
	`, []string{"PAID", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"}, start, end).Scan(&categories)
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"category_trends": categories}})
}

func (h *AdminHandler) GetOrders(c *gin.Context) {
	var orders []model.Order
	if err := h.db.Preload("Items").Preload("Payments").Preload("User").Order("created_at desc").Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch orders"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": orders})
}

func (h *AdminHandler) GetOrderByID(c *gin.Context) {
	var order model.Order
	if err := h.db.Preload("Items").Preload("Payments").Preload("StatusHistory").Preload("User").
		Where("id = ?", c.Param("id")).
		First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": order})
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

	if err := h.orderService.UpdateOrderStatus(id, req.Status); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update status"})
		return
	}
	_ = h.createOrderNotification(id, req.Status)
	h.logAdminActivity(c, "UPDATE_STATUS", "order", id, gin.H{"status": req.Status})
	c.JSON(http.StatusOK, gin.H{"message": "Status updated"})
}

func (h *AdminHandler) ConfirmPayment(c *gin.Context) {
	if err := h.orderService.ConfirmManualPayment(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	_ = h.createOrderNotification(c.Param("id"), "PAID")
	h.logAdminActivity(c, "CONFIRM_PAYMENT", "order", c.Param("id"), nil)
	c.JSON(http.StatusOK, gin.H{"message": "Payment confirmed"})
}

func (h *AdminHandler) ExpirePayments(c *gin.Context) {
	count, err := h.orderService.ExpirePendingPayments()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Pending payments expired", "data": gin.H{"expired": count}})
}

func (h *AdminHandler) RefundOrder(c *gin.Context) {
	var req struct {
		Reason string  `json:"reason" binding:"required"`
		Amount float64 `json:"amount"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.orderService.RefundOrder(c.Param("id"), req.Reason, req.Amount); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.logAdminActivity(c, "REFUND", "order", c.Param("id"), gin.H{"amount": req.Amount, "reason": req.Reason})
	c.JSON(http.StatusOK, gin.H{"message": "Order refunded"})
}

func (h *AdminHandler) PrintInvoice(c *gin.Context) {
	var order model.Order
	if err := h.db.Preload("Items").Preload("User").Where("id = ?", c.Param("id")).First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"invoice_number": order.OrderNumber,
		"order":          order,
		"issued_at":      time.Now(),
		"packing_note":   "Pack live orchids with moisture protection and rigid box support.",
	}})
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

	now := time.Now()
	if err := h.db.Model(&model.Order{}).Where("id = ?", id).Updates(map[string]interface{}{
		"tracking_number": req.TrackingNumber,
		"status":          "SHIPPED",
		"shipped_at":      &now,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update tracking"})
		return
	}
	_ = h.createOrderNotification(id, "SHIPPED")
	h.logAdminActivity(c, "UPDATE_TRACKING", "order", id, gin.H{"tracking_number": req.TrackingNumber})
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

func (h *AdminHandler) GetInventory(c *gin.Context) {
	var products []model.Product
	if err := h.db.Preload("Category").Preload("Images").Preload("Inventory").
		Order("created_at desc").
		Find(&products).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch inventory"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": products})
}

func (h *AdminHandler) GetLowStockInventory(c *gin.Context) {
	var products []model.Product
	if err := h.db.Preload("Category").Preload("Images").Preload("Inventory").
		Joins("JOIN inventories ON inventories.product_id = products.id").
		Where("inventories.quantity <= inventories.low_stock_threshold").
		Order("inventories.quantity asc").
		Find(&products).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch low stock inventory"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": products})
}

func (h *AdminHandler) UpdateInventory(c *gin.Context) {
	productID := c.Param("product_id")
	var req struct {
		Quantity          *int   `json:"quantity" binding:"required,min=0"`
		LowStockThreshold *int   `json:"low_stock_threshold" binding:"omitempty,min=0"`
		Note              string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		var inv model.Inventory
		if err := tx.Where("product_id = ?", productID).First(&inv).Error; err != nil {
			return err
		}

		nextQuantity := *req.Quantity
		diff := nextQuantity - inv.Quantity
		threshold := inv.LowStockThreshold
		if req.LowStockThreshold != nil {
			threshold = *req.LowStockThreshold
		}
		if err := tx.Model(&inv).Updates(map[string]interface{}{
			"quantity":            nextQuantity,
			"low_stock_threshold": threshold,
			"updated_at":          time.Now(),
		}).Error; err != nil {
			return err
		}

		movementType := "ADJUSTMENT"
		quantity := diff
		if quantity < 0 {
			quantity = -quantity
		}
		adminID, _ := uuid.Parse(c.GetString("userID"))
		return tx.Create(&model.StockMovement{
			ProductID:     inv.ProductID,
			MovementType:  movementType,
			Quantity:      quantity,
			ReferenceType: "ADMIN_INVENTORY",
			Note:          req.Note,
			PerformedBy:   &adminID,
		}).Error
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Inventory updated"})
}

func (h *AdminHandler) CreateCategory(c *gin.Context) {
	var category model.Category
	if err := c.ShouldBindJSON(&category); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if category.Slug == "" {
		category.Slug = slugify(category.Name)
	}
	if err := h.db.Create(&category).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Category created", "data": category})
}

func (h *AdminHandler) UpdateCategory(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid category id"})
		return
	}

	var req model.Category
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.ID = id
	if req.Slug == "" {
		req.Slug = slugify(req.Name)
	}
	if err := h.db.Model(&model.Category{}).Where("id = ?", id).Updates(req).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Category updated"})
}

func (h *AdminHandler) DeleteCategory(c *gin.Context) {
	if err := h.db.Where("id = ?", c.Param("id")).Delete(&model.Category{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Category deleted"})
}

func (h *AdminHandler) AddProductImage(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid product id"})
		return
	}

	var req struct {
		ImageURL  string `json:"image_url" binding:"required,url"`
		AltText   string `json:"alt_text"`
		SortOrder int    `json:"sort_order"`
		IsPrimary bool   `json:"is_primary"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	image := model.ProductImage{
		ProductID: productID,
		ImageURL:  req.ImageURL,
		AltText:   req.AltText,
		SortOrder: req.SortOrder,
		IsPrimary: req.IsPrimary,
	}
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if req.IsPrimary {
			if err := tx.Model(&model.ProductImage{}).Where("product_id = ?", productID).Update("is_primary", false).Error; err != nil {
				return err
			}
		}
		return tx.Create(&image).Error
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Product image added", "data": image})
}

func (h *AdminHandler) DeleteProductImage(c *gin.Context) {
	if err := h.db.Where("id = ? AND product_id = ?", c.Param("image_id"), c.Param("id")).Delete(&model.ProductImage{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Product image deleted"})
}

func (h *AdminHandler) logAdminActivity(c *gin.Context, action, entityType, entityID string, values interface{}) {
	adminID, err := uuid.Parse(c.GetString("userID"))
	if err != nil {
		return
	}
	var parsedEntityID uuid.UUID
	if entityID != "" {
		parsedEntityID, _ = uuid.Parse(entityID)
	}
	log := model.AdminActivityLog{
		AdminID:    adminID,
		Action:     action,
		EntityType: entityType,
		EntityID:   parsedEntityID,
		IPAddress:  c.ClientIP(),
	}
	if values != nil {
		_ = h.db.Create(&log).Error
		return
	}
	_ = h.db.Create(&log).Error
}

func (h *AdminHandler) createOrderNotification(orderID string, status string) error {
	var order model.Order
	if err := h.db.Where("id = ?", orderID).First(&order).Error; err != nil {
		return err
	}
	title, message := orderNotificationContent(order.OrderNumber, status)
	return h.db.Create(&model.Notification{
		UserID:        order.UserID,
		Type:          "order_status",
		Title:         title,
		Message:       message,
		ReferenceType: "order",
		ReferenceID:   order.ID,
	}).Error
}

func orderNotificationContent(orderNumber string, status string) (string, string) {
	switch status {
	case "PAID":
		return "Pembayaran dikonfirmasi", "Pesanan " + orderNumber + " sudah di-acc dan akan segera diproses."
	case "PROCESSING":
		return "Pesanan sedang diproses", "Pesanan " + orderNumber + " sedang disiapkan oleh admin."
	case "SHIPPED":
		return "Pesanan dikirim", "Pesanan " + orderNumber + " sudah dikirim. Cek detail pesanan untuk melihat resi."
	case "DELIVERED":
		return "Pesanan diterima", "Pesanan " + orderNumber + " sudah ditandai diterima."
	case "COMPLETED":
		return "Pesanan selesai", "Pesanan " + orderNumber + " sudah selesai."
	case "CANCELLED":
		return "Pesanan dibatalkan", "Pesanan " + orderNumber + " dibatalkan oleh admin."
	default:
		return "Status pesanan diperbarui", "Status pesanan " + orderNumber + " berubah menjadi " + status + "."
	}
}

func containsStatus(statuses []string, target string) bool {
	for _, status := range statuses {
		if status == target {
			return true
		}
	}
	return false
}

func sameDay(a, b time.Time) bool {
	ay, am, ad := a.Date()
	by, bm, bd := b.Date()
	return ay == by && am == bm && ad == bd
}

func analyticsRange(c *gin.Context) (time.Time, time.Time) {
	end := time.Now()
	start := end.AddDate(0, 0, -30)
	switch c.DefaultQuery("period", "30d") {
	case "today":
		start = time.Date(end.Year(), end.Month(), end.Day(), 0, 0, 0, 0, end.Location())
	case "7d":
		start = end.AddDate(0, 0, -7)
	case "3m":
		start = end.AddDate(0, -3, 0)
	case "6m":
		start = end.AddDate(0, -6, 0)
	case "1y":
		start = end.AddDate(-1, 0, 0)
	case "custom":
		if parsed, err := time.Parse("2006-01-02", c.Query("start_date")); err == nil {
			start = parsed
		}
		if parsed, err := time.Parse("2006-01-02", c.Query("end_date")); err == nil {
			end = parsed.Add(24*time.Hour - time.Nanosecond)
		}
	}
	return start, end
}

func slugify(value string) string {
	result := ""
	lastDash := false
	for _, ch := range strings.TrimSpace(value) {
		if ch >= 'A' && ch <= 'Z' {
			ch = ch + 32
		}
		if (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') {
			result += string(ch)
			lastDash = false
			continue
		}
		if !lastDash && result != "" {
			result += "-"
			lastDash = true
		}
	}
	if len(result) > 0 && result[len(result)-1:] == "-" {
		return result[:len(result)-1]
	}
	return result
}
