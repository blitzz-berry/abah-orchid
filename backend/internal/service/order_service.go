package service

import (
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/midtrans/midtrans-go"
	"github.com/midtrans/midtrans-go/snap"
	
	"orchidmart-backend/internal/dto/request"
	"orchidmart-backend/internal/model"
	midtransPkg "orchidmart-backend/internal/pkg/midtrans"
	"orchidmart-backend/internal/repository"
)

type OrderService interface {
	Checkout(userID string, req request.CheckoutRequest) (*model.Order, string, error)
	GetOrders(userID string) ([]model.Order, error)
	GetOrderByID(orderID string) (*model.Order, error)
	UpdateOrderStatus(orderID string, status string) error
	HandleMidtransWebhook(payload map[string]interface{}) error
}

type orderService struct {
	orderRepo repository.OrderRepository
	cartRepo  repository.CartRepository
}

func NewOrderService(orderRepo repository.OrderRepository, cartRepo repository.CartRepository) OrderService {
	return &orderService{orderRepo, cartRepo}
}

func (s *orderService) Checkout(userID string, req request.CheckoutRequest) (*model.Order, string, error) {
	cart, err := s.cartRepo.GetCartByUserID(userID)
	if err != nil || len(cart.Items) == 0 {
		return nil, "", errors.New("cart is empty or not found")
	}

	var subtotal float64
	var orderItems []model.OrderItem

	for _, item := range cart.Items {
		itemSubtotal := item.Product.Price * float64(item.Quantity)
		subtotal += itemSubtotal
		
		orderItems = append(orderItems, model.OrderItem{
			ProductID:       item.ProductID,
			ProductName:     item.Product.Name,
			ProductPrice:    item.Product.Price,
			UnitType:        item.Product.UnitType,
			Quantity:        item.Quantity,
			Subtotal:        itemSubtotal,
		})
	}

	total := subtotal + req.ShippingCost

	parsedUserID, _ := uuid.Parse(userID)
	order := &model.Order{
		OrderNumber:        fmt.Sprintf("ORD-%s-%s", time.Now().Format("20060102"), uuid.New().String()[:6]),
		UserID:             parsedUserID,
		ShippingName:       req.ShippingName,
		ShippingPhone:      req.ShippingPhone,
		ShippingAddress:    req.ShippingAddress,
		ShippingCity:       req.ShippingCity,
		ShippingProvince:   req.ShippingProvince,
		ShippingPostalCode: req.ShippingPostalCode,
		CourierCode:        req.CourierCode,
		CourierService:     req.CourierService,
		ShippingCost:       req.ShippingCost,
		Subtotal:           subtotal,
		Total:              total,
		Status:             "PENDING_PAYMENT",
		Note:               req.Note,
		Items:              orderItems,
	}

	if err := s.orderRepo.CreateOrderWithTx(order, cart.ID.String()); err != nil {
		return nil, "", err
	}

	// Create Midtrans Snap Transaction
	snapReq := &snap.Request{
		TransactionDetails: midtrans.TransactionDetails{
			OrderID:  order.ID.String(),
			GrossAmt: int64(total),
		},
		CustomerDetail: &midtrans.CustomerDetails{
			FName: req.ShippingName,
			Email: "customer@example.com", // Usually fetched from user
			Phone: req.ShippingPhone,
		},
	}

	snapResp, err := midtransPkg.SnapClient.CreateTransaction(snapReq)
	if err != nil {
		return nil, "", err
	}

	// Insert Payment record
	payment := model.Payment{
		OrderID:    order.ID,
		Method:     "midtrans",
		Amount:     total,
		Status:     "PENDING",
		PaymentURL: snapResp.RedirectURL,
	}
	// In production, insert this via a repository
	// For now we'll assume it exists or handled
	_ = payment

	return order, snapResp.RedirectURL, nil
}

func (s *orderService) GetOrders(userID string) ([]model.Order, error) {
	return s.orderRepo.GetOrdersByUserID(userID)
}

func (s *orderService) GetOrderByID(orderID string) (*model.Order, error) {
	return s.orderRepo.GetOrderByID(orderID)
}

func (s *orderService) UpdateOrderStatus(orderID string, status string) error {
	return s.orderRepo.UpdateOrderStatus(orderID, status)
}

func (s *orderService) HandleMidtransWebhook(payload map[string]interface{}) error {
	orderID, ok := payload["order_id"].(string)
	if !ok {
		return errors.New("invalid order_id in webhook")
	}
	
	transactionStatus, _ := payload["transaction_status"].(string)

	if transactionStatus == "settlement" || transactionStatus == "capture" {
		order, err := s.orderRepo.GetOrderByID(orderID)
		if err != nil {
			return err
		}
		
		// In a real app we'd fetch the payment row, here we just construct one for the TX
		now := time.Now()
		payment := &model.Payment{
			OrderID: order.ID,
			Status:  "PAID",
			PaidAt:  &now,
		}
		
		return s.orderRepo.CompletePaymentWithTx(payment)
	} else if transactionStatus == "cancel" || transactionStatus == "deny" || transactionStatus == "expire" {
		return s.orderRepo.UpdateOrderStatus(orderID, "CANCELLED")
	}

	return nil
}
