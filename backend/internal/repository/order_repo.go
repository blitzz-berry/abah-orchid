package repository

import (
	"errors"
	"fmt"
	"orchidmart-backend/internal/model"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type OrderRepository interface {
	CreateOrderWithTx(order *model.Order, cartID string) error
	CreateOrderFromCartItemsWithTx(order *model.Order, cartID string, cartItemIDs []string) error
	GetOrderByID(id string) (*model.Order, error)
	GetOrderByIDForUser(id, userID string) (*model.Order, error)
	GetOrdersByUserID(userID string) ([]model.Order, error)
	UpdateOrderStatus(orderID, status string) error
	ConfirmDelivery(orderID, userID string) error
	RequestCancellation(orderID, userID, reason string) error
	RejectCancellation(orderID, reason string) (string, error)
	ApproveReturn(orderID, reason string) (string, error)
	RejectReturn(orderID, reason string) (string, error)
	CreateOrUpdatePayment(payment *model.Payment) error
	GetPaymentByOrderID(orderID string) (*model.Payment, error)
	CompletePaymentWithTx(payment *model.Payment) error
	CancelOrderWithTx(orderID, reason string) error
	ExpirePendingPayments(now time.Time) ([]string, error)
	RequestReturn(orderID, userID, reason string) error
	RefundOrder(orderID, reason string, amount float64) error
}

type orderRepository struct {
	db *gorm.DB
}

func NewOrderRepository(db *gorm.DB) OrderRepository {
	return &orderRepository{db}
}

func (r *orderRepository) CreateOrderWithTx(order *model.Order, cartID string) error {
	return r.CreateOrderFromCartItemsWithTx(order, cartID, nil)
}

func (r *orderRepository) CreateOrderFromCartItemsWithTx(order *model.Order, cartID string, cartItemIDs []string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		for _, item := range order.Items {
			result := tx.Model(&model.Inventory{}).
				Where("product_id = ? AND quantity >= ?", item.ProductID, item.Quantity).
				UpdateColumns(map[string]interface{}{
					"quantity":   gorm.Expr("quantity - ?", item.Quantity),
					"updated_at": time.Now(),
				})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return fmt.Errorf("insufficient stock for %s", item.ProductName)
			}
			if err := tx.Create(&model.StockMovement{
				ProductID:     item.ProductID,
				MovementType:  "STOCK_OUT",
				Quantity:      item.Quantity,
				ReferenceType: "ORDER_RESERVE",
				ReferenceID:   order.ID.String(),
				Note:          "Stock reserved when order was created",
			}).Error; err != nil {
				return err
			}
		}

		if err := tx.Create(order).Error; err != nil {
			return err
		}
		if strings.TrimSpace(order.CouponCode) != "" {
			update := tx.Model(&model.Coupon{}).
				Where("LOWER(code) = LOWER(?) AND is_active = ? AND valid_from <= ? AND valid_until >= ?", order.CouponCode, true, time.Now(), time.Now())
			update = update.Where("usage_limit = 0 OR used_count < usage_limit")
			result := update.UpdateColumn("used_count", gorm.Expr("used_count + 1"))
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return errors.New("coupon usage limit reached")
			}
		}

		history := model.OrderStatusHistory{
			OrderID:    order.ID,
			FromStatus: "",
			ToStatus:   order.Status,
			Note:       "System Order Creation",
		}
		if err := tx.Create(&history).Error; err != nil {
			return err
		}

		deleteQuery := tx.Where("cart_id = ?", cartID)
		if len(cartItemIDs) > 0 {
			deleteQuery = deleteQuery.Where("id IN ?", cartItemIDs)
		}
		if err := deleteQuery.Delete(&model.CartItem{}).Error; err != nil {
			return err
		}

		return nil
	})
}

func (r *orderRepository) GetOrderByID(id string) (*model.Order, error) {
	var order model.Order
	err := r.db.Preload("Items").Preload("Payments").Preload("StatusHistory").Preload("User").Where("id = ?", id).First(&order).Error
	if err == nil {
		err = r.hydrateOrderItemImages([]*model.Order{&order})
	}
	return &order, err
}

func (r *orderRepository) GetOrderByIDForUser(id, userID string) (*model.Order, error) {
	var order model.Order
	err := r.db.Preload("Items").Preload("Payments").Preload("StatusHistory").Preload("User").Where("id = ? AND user_id = ?", id, userID).First(&order).Error
	if err == nil {
		err = r.hydrateOrderItemImages([]*model.Order{&order})
	}
	return &order, err
}

func (r *orderRepository) GetOrdersByUserID(userID string) ([]model.Order, error) {
	var orders []model.Order
	err := r.db.Where("user_id = ?", userID).
		Order("created_at desc").
		Preload("Items").
		Preload("Payments").
		Find(&orders).Error
	if err == nil {
		orderRefs := make([]*model.Order, 0, len(orders))
		for i := range orders {
			orderRefs = append(orderRefs, &orders[i])
		}
		err = r.hydrateOrderItemImages(orderRefs)
	}
	return orders, err
}

func (r *orderRepository) hydrateOrderItemImages(orders []*model.Order) error {
	productIDs := make(map[string]struct{})
	for _, order := range orders {
		if order == nil {
			continue
		}
		for _, item := range order.Items {
			if item.ProductImageURL == "" {
				productIDs[item.ProductID.String()] = struct{}{}
			}
		}
	}
	if len(productIDs) == 0 {
		return nil
	}

	ids := make([]string, 0, len(productIDs))
	for id := range productIDs {
		ids = append(ids, id)
	}

	var images []model.ProductImage
	if err := r.db.
		Where("product_id IN ?", ids).
		Order("is_primary desc, sort_order asc, created_at asc").
		Find(&images).Error; err != nil {
		return err
	}

	imageByProductID := make(map[string]string, len(images))
	for _, image := range images {
		productID := image.ProductID.String()
		if image.ImageURL != "" {
			if _, exists := imageByProductID[productID]; !exists {
				imageByProductID[productID] = image.ImageURL
			}
		}
	}

	for _, order := range orders {
		if order == nil {
			continue
		}
		for i := range order.Items {
			if order.Items[i].ProductImageURL == "" {
				order.Items[i].ProductImageURL = imageByProductID[order.Items[i].ProductID.String()]
			}
		}
	}

	return nil
}

func (r *orderRepository) UpdateOrderStatus(orderID, status string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var order model.Order
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", orderID).First(&order).Error; err != nil {
			return err
		}

		updates := map[string]interface{}{"status": status}
		now := time.Now()
		switch status {
		case "PAID":
			updates["paid_at"] = &now
		case "PROCESSING":
		case "SHIPPED":
			updates["shipped_at"] = &now
		case "DELIVERED":
			updates["delivered_at"] = &now
		case "COMPLETED":
			updates["completed_at"] = &now
		case "CANCELLED":
			updates["cancelled_at"] = &now
		}

		if err := tx.Model(&model.Order{}).Where("id = ?", orderID).Updates(updates).Error; err != nil {
			return err
		}

		return tx.Create(&model.OrderStatusHistory{
			OrderID:    order.ID,
			FromStatus: order.Status,
			ToStatus:   status,
			Note:       "Status updated",
		}).Error
	})
}

func (r *orderRepository) ConfirmDelivery(orderID, userID string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var order model.Order
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND user_id = ?", orderID, userID).
			First(&order).Error; err != nil {
			return err
		}
		if order.Status != "SHIPPED" && order.Status != "DELIVERED" {
			return errors.New("order is not ready for delivery confirmation")
		}

		now := time.Now()
		if err := tx.Model(&model.Order{}).Where("id = ?", orderID).Updates(map[string]interface{}{
			"status":       "COMPLETED",
			"delivered_at": coalesceTime(order.DeliveredAt, now),
			"completed_at": &now,
		}).Error; err != nil {
			return err
		}

		return tx.Create(&model.OrderStatusHistory{
			OrderID:    order.ID,
			FromStatus: order.Status,
			ToStatus:   "COMPLETED",
			Note:       "Buyer confirmed delivery",
		}).Error
	})
}

func (r *orderRepository) RequestCancellation(orderID, userID, reason string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var order model.Order
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND user_id = ?", orderID, userID).
			First(&order).Error; err != nil {
			return err
		}
		if order.Status != "PAID" && order.Status != "PROCESSING" {
			return errors.New("cancellation request is only available for paid or processing orders")
		}

		now := time.Now()
		if err := tx.Model(&model.Order{}).Where("id = ?", order.ID).Updates(map[string]interface{}{
			"status":                             "CANCELLATION_REQUESTED",
			"cancellation_reason":                reason,
			"cancellation_source":                "customer",
			"cancellation_requested_at":          &now,
			"cancellation_requested_from_status": order.Status,
			"cancellation_rejected_reason":       "",
		}).Error; err != nil {
			return err
		}

		return tx.Create(&model.OrderStatusHistory{
			OrderID:    order.ID,
			FromStatus: order.Status,
			ToStatus:   "CANCELLATION_REQUESTED",
			Note:       reason,
		}).Error
	})
}

func (r *orderRepository) RejectCancellation(orderID, reason string) (string, error) {
	var restoredStatus string
	err := r.db.Transaction(func(tx *gorm.DB) error {
		var order model.Order
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", orderID).
			First(&order).Error; err != nil {
			return err
		}
		if order.Status != "CANCELLATION_REQUESTED" {
			return errors.New("order is not waiting for cancellation review")
		}

		restoredStatus = strings.TrimSpace(order.CancellationRequestedFromStatus)
		if restoredStatus == "" {
			restoredStatus = "PAID"
		}

		if err := tx.Model(&model.Order{}).Where("id = ?", order.ID).Updates(map[string]interface{}{
			"status":                             restoredStatus,
			"cancellation_rejected_reason":       reason,
			"cancellation_requested_from_status": "",
		}).Error; err != nil {
			return err
		}

		return tx.Create(&model.OrderStatusHistory{
			OrderID:    order.ID,
			FromStatus: order.Status,
			ToStatus:   restoredStatus,
			Note:       "Cancellation rejected: " + reason,
		}).Error
	})
	return restoredStatus, err
}

func (r *orderRepository) CreateOrUpdatePayment(payment *model.Payment) error {
	var existing model.Payment
	err := r.db.Where("order_id = ?", payment.OrderID).First(&existing).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return r.db.Create(payment).Error
		}
		return err
	}

	updates := map[string]interface{}{}
	if payment.Method != "" {
		updates["method"] = payment.Method
	}
	if payment.Provider != "" {
		updates["provider"] = payment.Provider
	}
	if payment.ExternalID != "" {
		updates["external_id"] = payment.ExternalID
	}
	if payment.Amount > 0 {
		updates["amount"] = payment.Amount
	}
	if payment.Status != "" {
		updates["status"] = payment.Status
	}
	if payment.PaymentURL != "" {
		updates["payment_url"] = payment.PaymentURL
	}
	if payment.ProofImageURL != "" {
		updates["proof_image_url"] = payment.ProofImageURL
	}
	if payment.FailureReason != "" {
		updates["failure_reason"] = payment.FailureReason
	}
	if payment.PaidAt != nil {
		updates["paid_at"] = payment.PaidAt
	}
	if payment.ExpiredAt != nil {
		updates["expired_at"] = payment.ExpiredAt
	}

	return r.db.Model(&existing).Updates(updates).Error
}

func (r *orderRepository) GetPaymentByOrderID(orderID string) (*model.Payment, error) {
	var payment model.Payment
	err := r.db.Where("order_id = ?", orderID).Order("created_at desc").First(&payment).Error
	if err != nil {
		return nil, err
	}
	return &payment, nil
}

func (r *orderRepository) CompletePaymentWithTx(payment *model.Payment) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var order model.Order
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Preload("Items").
			Where("id = ?", payment.OrderID).
			First(&order).Error; err != nil {
			return err
		}

		paymentUpdates := map[string]interface{}{
			"status": "PAID",
		}
		if payment.ExternalID != "" {
			paymentUpdates["external_id"] = payment.ExternalID
		}
		if payment.PaidAt != nil {
			paymentUpdates["paid_at"] = payment.PaidAt
		}
		if err := tx.Model(&model.Payment{}).Where("order_id = ?", payment.OrderID).Updates(paymentUpdates).Error; err != nil {
			return err
		}

		if order.Status == "PAID" || order.Status == "PROCESSING" || order.Status == "SHIPPED" || order.Status == "DELIVERED" || order.Status == "COMPLETED" {
			return nil
		}
		if order.Status == "CANCELLED" {
			return errors.New("cannot complete payment for cancelled order")
		}

		if err := tx.Model(&model.Order{}).Where("id = ?", payment.OrderID).Update("status", "PAID").Error; err != nil {
			return err
		}

		return tx.Create(&model.OrderStatusHistory{
			OrderID:    order.ID,
			FromStatus: order.Status,
			ToStatus:   "PAID",
			Note:       "Payment confirmed",
		}).Error
	})
}

func (r *orderRepository) CancelOrderWithTx(orderID, reason string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var order model.Order
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Preload("Items").
			Where("id = ?", orderID).
			First(&order).Error; err != nil {
			return err
		}
		if order.Status == "CANCELLED" {
			return nil
		}
		shouldRestore, err := hasStockOutForOrder(tx, order.ID.String())
		if err != nil {
			return err
		}
		if order.Status == "SHIPPED" || order.Status == "DELIVERED" || order.Status == "COMPLETED" || order.Status == "REFUNDED" {
			shouldRestore = false
		}

		now := time.Now()
		if err := tx.Model(&model.Order{}).Where("id = ?", orderID).Updates(map[string]interface{}{
			"status":       "CANCELLED",
			"cancelled_at": &now,
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.Payment{}).Where("order_id = ? AND status IN ?", order.ID, []string{"PENDING", "WAITING_PROOF"}).Updates(map[string]interface{}{
			"status":         "EXPIRED",
			"failure_reason": reason,
			"expired_at":     &now,
		}).Error; err != nil {
			return err
		}
		if order.Status == "PENDING_PAYMENT" {
			if err := releaseCouponUsage(tx, order.CouponCode); err != nil {
				return err
			}
		}

		if shouldRestore {
			for _, item := range order.Items {
				if err := tx.Model(&model.Inventory{}).
					Where("product_id = ?", item.ProductID).
					UpdateColumns(map[string]interface{}{
						"quantity":   gorm.Expr("quantity + ?", item.Quantity),
						"updated_at": time.Now(),
					}).Error; err != nil {
					return err
				}
				if err := tx.Create(&model.StockMovement{
					ProductID:     item.ProductID,
					MovementType:  "STOCK_IN",
					Quantity:      item.Quantity,
					ReferenceType: "ORDER_CANCEL",
					ReferenceID:   order.ID.String(),
					Note:          "Automatic stock restore after order cancellation",
				}).Error; err != nil {
					return err
				}
			}
		}

		return tx.Create(&model.OrderStatusHistory{
			OrderID:    order.ID,
			FromStatus: order.Status,
			ToStatus:   "CANCELLED",
			Note:       reason,
		}).Error
	})
}

func releaseCouponUsage(tx *gorm.DB, code string) error {
	code = strings.TrimSpace(code)
	if code == "" {
		return nil
	}
	return tx.Model(&model.Coupon{}).
		Where("LOWER(code) = LOWER(?) AND used_count > 0", code).
		UpdateColumn("used_count", gorm.Expr("used_count - 1")).Error
}

func (r *orderRepository) ExpirePendingPayments(now time.Time) ([]string, error) {
	var payments []model.Payment
	if err := r.db.Where("status IN ? AND expired_at IS NOT NULL AND expired_at <= ?", []string{"PENDING", "WAITING_PROOF"}, now).Find(&payments).Error; err != nil {
		return nil, err
	}

	expiredOrderIDs := make([]string, 0, len(payments))
	for _, payment := range payments {
		if err := r.CancelOrderWithTx(payment.OrderID.String(), "payment expired after 24 hours"); err != nil {
			return expiredOrderIDs, err
		}
		expiredOrderIDs = append(expiredOrderIDs, payment.OrderID.String())
	}
	return expiredOrderIDs, nil
}

func (r *orderRepository) RequestReturn(orderID, userID, reason string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var order model.Order
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND user_id = ?", orderID, userID).
			First(&order).Error; err != nil {
			return err
		}
		if order.Status != "DELIVERED" && order.Status != "COMPLETED" {
			return errors.New("return can only be requested for delivered or completed orders")
		}
		now := time.Now()
		if err := tx.Model(&model.Order{}).Where("id = ?", order.ID).Updates(map[string]interface{}{
			"status":                       "RETURN_REQUESTED",
			"return_reason":                reason,
			"return_requested_at":          &now,
			"return_requested_from_status": order.Status,
			"return_rejected_reason":       "",
			"return_approved_at":           nil,
		}).Error; err != nil {
			return err
		}
		return tx.Create(&model.OrderStatusHistory{
			OrderID:    order.ID,
			FromStatus: order.Status,
			ToStatus:   "RETURN_REQUESTED",
			Note:       reason,
		}).Error
	})
}

func (r *orderRepository) ApproveReturn(orderID, reason string) (string, error) {
	var nextStatus string
	err := r.db.Transaction(func(tx *gorm.DB) error {
		var order model.Order
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", orderID).
			First(&order).Error; err != nil {
			return err
		}
		if order.Status != "RETURN_REQUESTED" {
			return errors.New("order is not waiting for return review")
		}

		now := time.Now()
		nextStatus = "RETURN_APPROVED"
		if err := tx.Model(&model.Order{}).Where("id = ?", order.ID).Updates(map[string]interface{}{
			"status":                 nextStatus,
			"return_approved_at":     &now,
			"return_rejected_reason": "",
		}).Error; err != nil {
			return err
		}

		note := strings.TrimSpace(reason)
		if note == "" {
			note = "Return approved by admin"
		}
		return tx.Create(&model.OrderStatusHistory{
			OrderID:    order.ID,
			FromStatus: order.Status,
			ToStatus:   nextStatus,
			Note:       note,
		}).Error
	})
	return nextStatus, err
}

func (r *orderRepository) RejectReturn(orderID, reason string) (string, error) {
	var restoredStatus string
	err := r.db.Transaction(func(tx *gorm.DB) error {
		var order model.Order
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", orderID).
			First(&order).Error; err != nil {
			return err
		}
		if order.Status != "RETURN_REQUESTED" {
			return errors.New("order is not waiting for return review")
		}

		restoredStatus = strings.TrimSpace(order.ReturnRequestedFromStatus)
		if restoredStatus == "" {
			restoredStatus = "COMPLETED"
		}

		if err := tx.Model(&model.Order{}).Where("id = ?", order.ID).Updates(map[string]interface{}{
			"status":                       restoredStatus,
			"return_rejected_reason":       reason,
			"return_requested_from_status": "",
		}).Error; err != nil {
			return err
		}

		return tx.Create(&model.OrderStatusHistory{
			OrderID:    order.ID,
			FromStatus: order.Status,
			ToStatus:   restoredStatus,
			Note:       "Return rejected: " + reason,
		}).Error
	})
	return restoredStatus, err
}

func (r *orderRepository) RefundOrder(orderID, reason string, amount float64) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var order model.Order
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Preload("Items").Where("id = ?", orderID).First(&order).Error; err != nil {
			return err
		}
		if order.Status != "RETURN_REQUESTED" && order.Status != "RETURN_APPROVED" && order.Status != "PAID" && order.Status != "PROCESSING" && order.Status != "CANCELLATION_REQUESTED" {
			return errors.New("order is not eligible for refund")
		}
		if amount <= 0 || amount > order.Total {
			amount = order.Total
		}
		now := time.Now()
		if err := tx.Model(&model.Order{}).Where("id = ?", order.ID).Updates(map[string]interface{}{
			"status":        "REFUNDED",
			"refund_reason": reason,
			"refund_amount": amount,
			"refunded_at":   &now,
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.Payment{}).Where("order_id = ?", order.ID).Updates(map[string]interface{}{
			"status":         "REFUNDED",
			"failure_reason": reason,
		}).Error; err != nil {
			return err
		}
		shouldRestore, err := hasStockOutForOrder(tx, order.ID.String())
		if err != nil {
			return err
		}
		if shouldRestore {
			for _, item := range order.Items {
				if err := tx.Model(&model.Inventory{}).Where("product_id = ?", item.ProductID).UpdateColumns(map[string]interface{}{
					"quantity":   gorm.Expr("quantity + ?", item.Quantity),
					"updated_at": time.Now(),
				}).Error; err != nil {
					return err
				}
				if err := tx.Create(&model.StockMovement{
					ProductID:     item.ProductID,
					MovementType:  "STOCK_IN",
					Quantity:      item.Quantity,
					ReferenceType: "REFUND",
					ReferenceID:   order.ID.String(),
					Note:          "Automatic stock restore after refund",
				}).Error; err != nil {
					return err
				}
			}
		}
		return tx.Create(&model.OrderStatusHistory{
			OrderID:    order.ID,
			FromStatus: order.Status,
			ToStatus:   "REFUNDED",
			Note:       reason,
		}).Error
	})
}

func hasStockOutForOrder(tx *gorm.DB, orderID string) (bool, error) {
	var stockOut int64
	err := tx.Model(&model.StockMovement{}).
		Where("reference_id = ? AND movement_type = ?", orderID, "STOCK_OUT").
		Count(&stockOut).Error
	if err != nil {
		return false, err
	}
	var stockIn int64
	err = tx.Model(&model.StockMovement{}).
		Where("reference_id = ? AND movement_type = ? AND reference_type IN ?", orderID, "STOCK_IN", []string{"ORDER_CANCEL", "REFUND"}).
		Count(&stockIn).Error
	if err != nil {
		return false, err
	}
	return stockOut > stockIn, nil
}

func coalesceTime(existing *time.Time, fallback time.Time) *time.Time {
	if existing != nil {
		return existing
	}
	return &fallback
}
