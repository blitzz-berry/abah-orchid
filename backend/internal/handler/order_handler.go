package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"orchidmart-backend/internal/dto/request"
	"orchidmart-backend/internal/service"
)

type OrderHandler struct {
	orderService service.OrderService
}

func NewOrderHandler(orderService service.OrderService) *OrderHandler {
	return &OrderHandler{orderService}
}

func (h *OrderHandler) Checkout(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req request.CheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	order, paymentURL, err := h.orderService.Checkout(userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":      "Order created successfully",
		"data":         order,
		"payment_url":  paymentURL,
	})
}

func (h *OrderHandler) WebhookMidtrans(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// In production, MUST verify SignatureKey here.

	if err := h.orderService.HandleMidtransWebhook(payload); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Webhook processed"})
}

func (h *OrderHandler) GetUserOrders(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		// Mock for now if middleware is missing
		userID = "mock-user-id"
	}

	orders, err := h.orderService.GetOrders(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch orders"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": orders})
}

func (h *OrderHandler) GetOrderByID(c *gin.Context) {
	id := c.Param("id")
	order, err := h.orderService.GetOrderByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": order})
}

func (h *OrderHandler) ConfirmDelivery(c *gin.Context) {
	id := c.Param("id")
	if err := h.orderService.UpdateOrderStatus(id, "COMPLETED"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to confirm delivery"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Delivery confirmed"})
}
