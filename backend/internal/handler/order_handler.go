package handler

import (
	"crypto/sha512"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"orchidmart-backend/internal/dto/request"
	"orchidmart-backend/internal/model"
	"orchidmart-backend/internal/pkg/realtime"
	"orchidmart-backend/internal/service"
)

type OrderHandler struct {
	orderService service.OrderService
	db           *gorm.DB
	events       *realtime.Hub
}

func NewOrderHandler(orderService service.OrderService, db *gorm.DB) *OrderHandler {
	return &OrderHandler{orderService: orderService, db: db}
}

func NewRealtimeOrderHandler(orderService service.OrderService, db *gorm.DB, events *realtime.Hub) *OrderHandler {
	return &OrderHandler{orderService: orderService, db: db, events: events}
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
		errMsg := safeErrorMessage(err)
		log.Printf("checkout failed for user %s with payment_method=%s courier=%s/%s coupon=%s: %s", userID, req.PaymentMethod, req.CourierCode, req.CourierService, strings.TrimSpace(req.CouponCode), errMsg)
		c.JSON(http.StatusInternalServerError, gin.H{"error": publicCheckoutErrorMessage(errMsg)})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":     "Order created successfully",
		"data":        order,
		"payment_url": paymentURL,
	})
}

func (h *OrderHandler) WebhookMidtrans(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if !verifyMidtransSignature(payload) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid Midtrans signature"})
		return
	}

	if err := h.orderService.HandleMidtransWebhook(payload); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Webhook processed"})
}

func (h *OrderHandler) GetUserOrders(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	orders, err := h.orderService.GetOrders(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch orders"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": orders})
}

func (h *OrderHandler) GetOrderByID(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	id := c.Param("id")
	order, err := h.orderService.GetOrderByID(id, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": order})
}

func (h *OrderHandler) ConfirmDelivery(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	id := c.Param("id")
	if err := h.orderService.ConfirmDelivery(id, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to confirm delivery"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Delivery confirmed"})
}

func (h *OrderHandler) CancelOrder(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req request.CancelOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil && !strings.Contains(strings.ToLower(err.Error()), "eof") {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	status, err := h.orderService.CancelOrder(c.Param("id"), userID, req.Reason)
	if err != nil {
		errMsg := safeErrorMessage(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": publicCancelOrderMessage(errMsg)})
		return
	}

	if status == "CANCELLATION_REQUESTED" {
		_ = h.createAdminCancellationNotifications(c.Param("id"), strings.TrimSpace(req.Reason))
	}
	c.JSON(http.StatusOK, gin.H{
		"message": "Order cancellation processed",
		"data": gin.H{
			"status": status,
		},
	})
}

func (h *OrderHandler) InitiatePayment(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	payment, err := h.orderService.InitiatePayment(c.Param("order_id"), userID)
	if err != nil {
		errMsg := safeErrorMessage(err)
		log.Printf("initiate payment failed for user %s order=%s: %s", userID, c.Param("order_id"), errMsg)
		c.JSON(http.StatusBadRequest, gin.H{"error": publicInitiatePaymentErrorMessage(errMsg)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Payment initiated", "data": payment, "payment_url": payment.PaymentURL})
}

func (h *OrderHandler) GetPaymentStatus(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	payment, err := h.orderService.GetPaymentStatus(c.Param("order_id"), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": payment})
}

func (h *OrderHandler) UploadPaymentProof(c *gin.Context) {
	c.JSON(http.StatusGone, gin.H{"error": "Upload payment proof using multipart file endpoint"})
}

func (h *OrderHandler) RequestReturn(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.orderService.RequestReturn(c.Param("id"), userID, req.Reason); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	_ = h.createAdminReturnNotifications(c.Param("id"), req.Reason)
	c.JSON(http.StatusOK, gin.H{"message": "Return requested"})
}

func (h *OrderHandler) createAdminReturnNotifications(orderID string, reason string) error {
	if h.db == nil {
		return nil
	}

	var order model.Order
	if err := h.db.Preload("User").Where("id = ?", orderID).First(&order).Error; err != nil {
		return err
	}

	var admins []model.User
	if err := h.db.Where("role = ? AND is_active = ?", "admin", true).Find(&admins).Error; err != nil {
		return err
	}

	trimmedReason := strings.TrimSpace(reason)
	if trimmedReason == "" {
		trimmedReason = "Pelanggan tidak memberikan alasan retur."
	}

	for _, admin := range admins {
		notification := model.Notification{
			UserID:        admin.ID,
			Type:          "order_status",
			Title:         "Pengajuan retur baru",
			Message:       "Pesanan " + order.OrderNumber + " dari " + order.ShippingName + " mengajukan retur. Alasan: " + trimmedReason,
			ReferenceType: "order",
			ReferenceID:   order.ID,
		}
		if err := h.db.Create(&notification).Error; err != nil {
			return err
		}
		if h.events != nil {
			h.events.NotificationCreated(admin.ID.String(), order.ID.String())
		}
	}

	return nil
}

func (h *OrderHandler) createAdminCancellationNotifications(orderID string, reason string) error {
	if h.db == nil {
		return nil
	}

	var order model.Order
	if err := h.db.Preload("User").Where("id = ?", orderID).First(&order).Error; err != nil {
		return err
	}

	var admins []model.User
	if err := h.db.Where("role = ? AND is_active = ?", "admin", true).Find(&admins).Error; err != nil {
		return err
	}

	if strings.TrimSpace(reason) == "" {
		reason = "Pelanggan tidak memberikan alasan pembatalan."
	}

	for _, admin := range admins {
		notification := model.Notification{
			UserID:        admin.ID,
			Type:          "order_status",
			Title:         "Pengajuan pembatalan pesanan",
			Message:       "Pesanan " + order.OrderNumber + " dari " + order.ShippingName + " meminta pembatalan. Alasan: " + reason,
			ReferenceType: "order",
			ReferenceID:   order.ID,
		}
		if err := h.db.Create(&notification).Error; err != nil {
			return err
		}
		if h.events != nil {
			h.events.NotificationCreated(admin.ID.String(), order.ID.String())
		}
	}

	return nil
}

func verifyMidtransSignature(payload map[string]interface{}) bool {
	signature, _ := payload["signature_key"].(string)
	if signature == "" {
		return false
	}

	orderID, _ := payload["order_id"].(string)
	statusCode, _ := payload["status_code"].(string)
	grossAmount, _ := payload["gross_amount"].(string)
	serverKey := os.Getenv("MIDTRANS_SERVER_KEY")
	if serverKey == "" || orderID == "" || statusCode == "" || grossAmount == "" {
		return false
	}

	sum := sha512.Sum512([]byte(orderID + statusCode + grossAmount + serverKey))
	expected := hex.EncodeToString(sum[:])
	return expected == signature
}

func safeErrorMessage(err error) (message string) {
	if err == nil {
		return "unexpected internal error"
	}

	defer func() {
		if recover() != nil {
			message = fmt.Sprint(err)
			if strings.TrimSpace(message) == "" || message == "<nil>" {
				message = "unexpected internal error"
			}
		}
	}()

	message = err.Error()
	if strings.TrimSpace(message) == "" {
		return "unexpected internal error"
	}
	return message
}

func publicCheckoutErrorMessage(errMsg string) string {
	errMsg = strings.TrimSpace(errMsg)
	if errMsg == "" {
		return "Terjadi kendala saat memproses pesanan. Silakan coba lagi."
	}

	allowed := []string{
		"cart is empty or not found",
		"no selected cart items found",
		"unsupported payment method",
		"invalid packing type",
		"shipping destination and courier are required",
		"selected courier service not available",
		"invalid shipping cost",
		"coupon is invalid or expired",
		"subtotal does not meet coupon minimum purchase",
		"coupon usage limit reached",
		"invalid order total",
	}

	for _, candidate := range allowed {
		if errMsg == candidate {
			return errMsg
		}
	}

	return "Terjadi kendala saat memproses pembayaran. Silakan coba lagi."
}

func publicInitiatePaymentErrorMessage(errMsg string) string {
	errMsg = strings.TrimSpace(errMsg)
	switch errMsg {
	case "payment can only be initiated for pending orders",
		"unsupported payment method",
		"selected payment method does not use Midtrans payment link":
		return errMsg
	default:
		return "Gagal membuka halaman pembayaran. Silakan coba lagi."
	}
}

func publicCancelOrderMessage(errMsg string) string {
	errMsg = strings.TrimSpace(errMsg)
	switch errMsg {
	case "cancellation reason is required",
		"cancellation request is only available for paid or processing orders",
		"cancellation request has already been submitted",
		"order can no longer be cancelled":
		return errMsg
	default:
		return "Gagal memproses pembatalan pesanan. Silakan coba lagi."
	}
}
