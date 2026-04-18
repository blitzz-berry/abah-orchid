package repository

import (
	"orchidmart-backend/internal/model"

	"gorm.io/gorm"
)

type OrderRepository interface {
	CreateOrderWithTx(order *model.Order, cartID string) error
	GetOrderByID(id string) (*model.Order, error)
	GetOrdersByUserID(userID string) ([]model.Order, error)
	UpdateOrderStatus(orderID, status string) error
	CompletePaymentWithTx(payment *model.Payment) error
}

type orderRepository struct {
	db *gorm.DB
}

func NewOrderRepository(db *gorm.DB) OrderRepository {
	return &orderRepository{db}
}

func (r *orderRepository) CreateOrderWithTx(order *model.Order, cartID string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// Insert Order
		if err := tx.Create(order).Error; err != nil {
			return err
		}

		// Insert Status History
		history := model.OrderStatusHistory{
			OrderID:    order.ID,
			FromStatus: "",
			ToStatus:   "PENDING_PAYMENT",
			Note:       "System Order Creation",
		}
		if err := tx.Create(&history).Error; err != nil {
			return err
		}

		// Clear Cart
		if err := tx.Where("cart_id = ?", cartID).Delete(&model.CartItem{}).Error; err != nil {
			return err
		}

		return nil
	})
}

func (r *orderRepository) GetOrderByID(id string) (*model.Order, error) {
	var order model.Order
	err := r.db.Preload("Items").Preload("Payments").Where("id = ?", id).First(&order).Error
	return &order, err
}

func (r *orderRepository) GetOrdersByUserID(userID string) ([]model.Order, error) {
	var orders []model.Order
	err := r.db.Where("user_id = ?", userID).Order("created_at desc").Preload("Items").Find(&orders).Error
	return orders, err
}

func (r *orderRepository) UpdateOrderStatus(orderID, status string) error {
	return r.db.Model(&model.Order{}).Where("id = ?", orderID).Update("status", status).Error
}

func (r *orderRepository) CompletePaymentWithTx(payment *model.Payment) error {
	// 1. Update Payment Status to PAID
	// 2. Update Order Status to PAID
	// 3. Deduct Inventory for all items in order
	// 4. Create Stock Movements
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(payment).Error; err != nil {
			return err
		}
		
		if err := tx.Model(&model.Order{}).Where("id = ?", payment.OrderID).Update("status", "PAID").Error; err != nil {
			return err
		}

		// Fetch order items to deduct inventory
		var items []model.OrderItem
		if err := tx.Where("order_id = ?", payment.OrderID).Find(&items).Error; err != nil {
			return err
		}

		for _, item := range items {
			// Update Inventory
			if err := tx.Model(&model.Inventory{}).
				Where("product_id = ?", item.ProductID).
				UpdateColumn("quantity", gorm.Expr("quantity - ?", item.Quantity)).Error; err != nil {
				return err
			}

			// Insert Stock Movement
			sm := model.StockMovement{
				ProductID:     item.ProductID,
				MovementType:  "STOCK_OUT",
				Quantity:      item.Quantity,
				ReferenceType: "ORDER",
				ReferenceID:   payment.OrderID.String(),
				Note:          "Automatic stock reduction after payment",
			}
			if err := tx.Create(&sm).Error; err != nil {
				return err
			}
		}

		return nil
	})
}
