package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

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
	GetOrderByID(orderID, userID string) (*model.Order, error)
	UpdateOrderStatus(orderID string, status string) error
	ConfirmDelivery(orderID, userID string) error
	InitiatePayment(orderID, userID string) (*model.Payment, error)
	GetPaymentStatus(orderID, userID string) (*model.Payment, error)
	UploadPaymentProof(orderID, userID, proofImageURL string) (*model.Payment, error)
	ConfirmManualPayment(orderID string) error
	ExpirePendingPayments() (int64, error)
	RequestReturn(orderID, userID, reason string) error
	RefundOrder(orderID, reason string, amount float64) error
	HandleMidtransWebhook(payload map[string]interface{}) error
}

type orderService struct {
	orderRepo repository.OrderRepository
	cartRepo  repository.CartRepository
	db        *gorm.DB
}

func NewOrderService(orderRepo repository.OrderRepository, cartRepo repository.CartRepository) OrderService {
	return &orderService{orderRepo: orderRepo, cartRepo: cartRepo}
}

func NewOrderServiceWithDB(orderRepo repository.OrderRepository, cartRepo repository.CartRepository, db *gorm.DB) OrderService {
	return &orderService{orderRepo: orderRepo, cartRepo: cartRepo, db: db}
}

func (s *orderService) Checkout(userID string, req request.CheckoutRequest) (*model.Order, string, error) {
	cart, err := s.cartRepo.GetCartByUserID(userID)
	if err != nil || len(cart.Items) == 0 {
		return nil, "", errors.New("cart is empty or not found")
	}

	var subtotal float64
	var orderItems []model.OrderItem
	selectedItemIDs := normalizeIDSet(req.CartItemIDs)

	for _, item := range cart.Items {
		if len(selectedItemIDs) > 0 {
			if _, ok := selectedItemIDs[item.ID.String()]; !ok {
				continue
			}
		}
		itemSubtotal := item.Product.Price * float64(item.Quantity)
		subtotal += itemSubtotal

		orderItems = append(orderItems, model.OrderItem{
			ProductID:       item.ProductID,
			ProductName:     item.Product.Name,
			ProductImageURL: primaryProductImageURL(item.Product.Images),
			ProductPrice:    item.Product.Price,
			UnitType:        item.Product.UnitType,
			Quantity:        item.Quantity,
			Subtotal:        itemSubtotal,
		})
	}
	if len(orderItems) == 0 {
		return nil, "", errors.New("no selected cart items found")
	}

	discount, err := s.calculateDiscount(req.CouponCode, subtotal)
	if err != nil {
		return nil, "", err
	}
	total := subtotal + req.ShippingCost + req.InsuranceCost + req.PackingCost - discount
	if total < 0 {
		total = 0
	}
	expiredAt := time.Now().Add(24 * time.Hour)
	paymentMethod := normalizePaymentMethod(req.PaymentMethod)
	if paymentMethod == "" {
		paymentMethod = "midtrans"
	}
	if !isSupportedPaymentMethod(paymentMethod) {
		return nil, "", errors.New("unsupported payment method")
	}
	packingType := req.PackingType
	if packingType == "" {
		packingType = "standard"
	}

	parsedUserID, _ := uuid.Parse(userID)
	order := &model.Order{
		ID:                 uuid.New(),
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
		ShippingInsurance:  req.ShippingInsurance,
		InsuranceCost:      req.InsuranceCost,
		PackingType:        packingType,
		PackingCost:        req.PackingCost,
		LivePlantNote:      req.LivePlantNote,
		Subtotal:           subtotal,
		Discount:           discount,
		CouponCode:         req.CouponCode,
		Total:              total,
		Status:             "PENDING_PAYMENT",
		Note:               req.Note,
		Items:              orderItems,
	}

	if err := s.orderRepo.CreateOrderFromCartItemsWithTx(order, cart.ID.String(), req.CartItemIDs); err != nil {
		return nil, "", err
	}

	if paymentMethod == "manual_bank_transfer" {
		payment := model.Payment{
			OrderID:    order.ID,
			Method:     "manual_bank_transfer",
			Provider:   "manual",
			Amount:     total,
			Status:     "WAITING_PROOF",
			ExternalID: order.ID.String(),
			ExpiredAt:  &expiredAt,
		}
		if err := s.orderRepo.CreateOrUpdatePayment(&payment); err != nil {
			return nil, "", err
		}
		return order, "", nil
	}

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
		EnabledPayments: enabledSnapPayments(paymentMethod),
		Expiry: &snap.ExpiryDetails{
			Unit:     "hours",
			Duration: 24,
		},
	}

	snapResp, err := midtransPkg.SnapClient.CreateTransaction(snapReq)
	if err != nil {
		return nil, "", err
	}

	// Insert Payment record
	payment := model.Payment{
		OrderID:    order.ID,
		Method:     paymentMethod,
		Provider:   "midtrans",
		Amount:     total,
		Status:     "PENDING",
		PaymentURL: snapResp.RedirectURL,
		ExternalID: order.ID.String(),
		ExpiredAt:  &expiredAt,
	}
	if err := s.orderRepo.CreateOrUpdatePayment(&payment); err != nil {
		return nil, "", err
	}

	return order, snapResp.RedirectURL, nil
}

func normalizeIDSet(ids []string) map[string]struct{} {
	result := map[string]struct{}{}
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id != "" {
			result[id] = struct{}{}
		}
	}
	return result
}

func primaryProductImageURL(images []model.ProductImage) string {
	if len(images) == 0 {
		return ""
	}
	for _, image := range images {
		if image.IsPrimary && image.ImageURL != "" {
			return image.ImageURL
		}
	}
	return images[0].ImageURL
}

func (s *orderService) GetOrders(userID string) ([]model.Order, error) {
	return s.orderRepo.GetOrdersByUserID(userID)
}

func (s *orderService) GetOrderByID(orderID, userID string) (*model.Order, error) {
	return s.orderRepo.GetOrderByIDForUser(orderID, userID)
}

func (s *orderService) UpdateOrderStatus(orderID string, status string) error {
	if status == "CANCELLED" {
		return s.orderRepo.CancelOrderWithTx(orderID, "Order cancelled")
	}
	return s.orderRepo.UpdateOrderStatus(orderID, status)
}

func (s *orderService) ConfirmDelivery(orderID, userID string) error {
	return s.orderRepo.ConfirmDelivery(orderID, userID)
}

func (s *orderService) InitiatePayment(orderID, userID string) (*model.Payment, error) {
	order, err := s.orderRepo.GetOrderByIDForUser(orderID, userID)
	if err != nil {
		return nil, err
	}
	if order.Status != "PENDING_PAYMENT" {
		return nil, errors.New("payment can only be initiated for pending orders")
	}

	if existing, err := s.orderRepo.GetPaymentByOrderID(orderID); err == nil && existing.PaymentURL != "" && existing.Status == "PENDING" {
		return existing, nil
	}

	expiredAt := time.Now().Add(24 * time.Hour)
	paymentMethod := "midtrans"
	if existing, err := s.orderRepo.GetPaymentByOrderID(orderID); err == nil && existing.Method != "" {
		paymentMethod = normalizePaymentMethod(existing.Method)
	}
	if !isSupportedPaymentMethod(paymentMethod) {
		return nil, errors.New("unsupported payment method")
	}
	if paymentMethod == "manual_bank_transfer" {
		return nil, errors.New("selected payment method does not use Midtrans payment link")
	}

	snapReq := &snap.Request{
		TransactionDetails: midtrans.TransactionDetails{
			OrderID:  order.ID.String(),
			GrossAmt: int64(order.Total),
		},
		CustomerDetail: &midtrans.CustomerDetails{
			FName: order.ShippingName,
			Email: order.User.Email,
			Phone: order.ShippingPhone,
		},
		EnabledPayments: enabledSnapPayments(paymentMethod),
		Expiry: &snap.ExpiryDetails{
			Unit:     "hours",
			Duration: 24,
		},
	}

	snapResp, err := midtransPkg.SnapClient.CreateTransaction(snapReq)
	if err != nil {
		return nil, err
	}

	payment := &model.Payment{
		OrderID:    order.ID,
		Method:     paymentMethod,
		Provider:   "midtrans",
		ExternalID: order.ID.String(),
		Amount:     order.Total,
		Status:     "PENDING",
		PaymentURL: snapResp.RedirectURL,
		ExpiredAt:  &expiredAt,
	}
	if err := s.orderRepo.CreateOrUpdatePayment(payment); err != nil {
		return nil, err
	}

	return payment, nil
}

func (s *orderService) GetPaymentStatus(orderID, userID string) (*model.Payment, error) {
	if _, err := s.orderRepo.GetOrderByIDForUser(orderID, userID); err != nil {
		return nil, err
	}
	return s.orderRepo.GetPaymentByOrderID(orderID)
}

func (s *orderService) UploadPaymentProof(orderID, userID, proofImageURL string) (*model.Payment, error) {
	if !isTrustedPaymentProofURL(proofImageURL) {
		return nil, errors.New("payment proof must be uploaded through the file upload endpoint")
	}

	order, err := s.orderRepo.GetOrderByIDForUser(orderID, userID)
	if err != nil {
		return nil, err
	}
	if order.Status != "PENDING_PAYMENT" {
		return nil, errors.New("payment proof can only be uploaded for pending orders")
	}

	payment := &model.Payment{
		OrderID:       order.ID,
		Method:        "manual_bank_transfer",
		Provider:      "manual",
		ExternalID:    order.ID.String(),
		Amount:        order.Total,
		Status:        "WAITING_CONFIRMATION",
		ProofImageURL: proofImageURL,
	}
	if err := s.orderRepo.CreateOrUpdatePayment(payment); err != nil {
		return nil, err
	}
	return payment, nil
}

func isTrustedPaymentProofURL(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return false
	}
	if strings.HasPrefix(value, "/api/v1/payments/") && strings.Contains(value, "/proof-file/") {
		return true
	}
	return false
}

func (s *orderService) ConfirmManualPayment(orderID string) error {
	order, err := s.orderRepo.GetOrderByID(orderID)
	if err != nil {
		return err
	}

	now := time.Now()
	payment := &model.Payment{
		OrderID:    order.ID,
		Method:     "manual_bank_transfer",
		Provider:   "manual",
		ExternalID: order.ID.String(),
		Amount:     order.Total,
		Status:     "PAID",
		PaidAt:     &now,
	}
	if err := s.orderRepo.CreateOrUpdatePayment(payment); err != nil {
		return err
	}
	return s.orderRepo.CompletePaymentWithTx(payment)
}

func (s *orderService) ExpirePendingPayments() (int64, error) {
	return s.orderRepo.ExpirePendingPayments(time.Now())
}

func (s *orderService) RequestReturn(orderID, userID, reason string) error {
	if strings.TrimSpace(reason) == "" {
		return errors.New("return reason is required")
	}
	return s.orderRepo.RequestReturn(orderID, userID, reason)
}

func (s *orderService) RefundOrder(orderID, reason string, amount float64) error {
	if strings.TrimSpace(reason) == "" {
		return errors.New("refund reason is required")
	}
	return s.orderRepo.RefundOrder(orderID, reason, amount)
}

func normalizePaymentMethod(method string) string {
	method = strings.ToLower(strings.TrimSpace(method))
	switch method {
	case "", "midtrans", "midtrans_all":
		return "midtrans"
	case "bank_transfer", "manual_transfer", "manual_bank", "bank_transfer_manual":
		return "manual_bank_transfer"
	case "midtrans_va", "virtual_account", "va":
		return "midtrans_bank_transfer"
	case "ewallet", "e-wallet", "midtrans_wallet":
		return "midtrans_ewallet"
	case "card", "credit_card", "debit_card":
		return "midtrans_card"
	default:
		return method
	}
}

func isSupportedPaymentMethod(method string) bool {
	switch normalizePaymentMethod(method) {
	case "midtrans", "manual_bank_transfer", "midtrans_bank_transfer", "midtrans_ewallet", "midtrans_card":
		return true
	default:
		return false
	}
}

func enabledSnapPayments(method string) []snap.SnapPaymentType {
	switch normalizePaymentMethod(method) {
	case "midtrans_bank_transfer":
		return []snap.SnapPaymentType{
			snap.PaymentTypeBankTransfer,
			snap.PaymentTypeBCAVA,
			snap.PaymentTypeBNIVA,
			snap.PaymentTypeBRIVA,
			snap.PaymentTypePermataVA,
			snap.PaymentTypeEChannel,
		}
	case "midtrans_ewallet":
		return []snap.SnapPaymentType{
			snap.PaymentTypeGopay,
			snap.PaymentTypeShopeepay,
		}
	case "midtrans_card":
		return []snap.SnapPaymentType{
			snap.PaymentTypeCreditCard,
		}
	default:
		return snap.AllSnapPaymentType
	}
}

func (s *orderService) calculateDiscount(code string, subtotal float64) (float64, error) {
	if code == "" || s.db == nil {
		return 0, nil
	}
	var coupon model.Coupon
	err := s.db.Where("LOWER(code) = LOWER(?) AND is_active = ? AND valid_from <= ? AND valid_until >= ?", code, true, time.Now(), time.Now()).First(&coupon).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, errors.New("coupon is invalid or expired")
		}
		return 0, err
	}
	if coupon.MinPurchase > 0 && subtotal < coupon.MinPurchase {
		return 0, errors.New("subtotal does not meet coupon minimum purchase")
	}
	if coupon.UsageLimit > 0 && coupon.UsedCount >= coupon.UsageLimit {
		return 0, errors.New("coupon usage limit reached")
	}

	discount := coupon.DiscountValue
	if coupon.DiscountType == "percentage" {
		discount = subtotal * coupon.DiscountValue / 100
	}
	if coupon.MaxDiscount > 0 && discount > coupon.MaxDiscount {
		discount = coupon.MaxDiscount
	}
	if discount > subtotal {
		discount = subtotal
	}
	if err := s.db.Model(&model.Coupon{}).Where("id = ?", coupon.ID).UpdateColumn("used_count", gorm.Expr("used_count + 1")).Error; err != nil {
		return 0, err
	}
	return discount, nil
}

func (s *orderService) HandleMidtransWebhook(payload map[string]interface{}) error {
	orderID, ok := payload["order_id"].(string)
	if !ok {
		return errors.New("invalid order_id in webhook")
	}

	transactionStatus, _ := payload["transaction_status"].(string)
	statusCode, _ := payload["status_code"].(string)
	grossAmount, _ := payload["gross_amount"].(string)

	if transactionStatus == "settlement" || transactionStatus == "capture" {
		order, err := s.orderRepo.GetOrderByID(orderID)
		if err != nil {
			return err
		}

		// In a real app we'd fetch the payment row, here we just construct one for the TX
		now := time.Now()
		payment := &model.Payment{
			OrderID:    order.ID,
			Status:     "PAID",
			PaidAt:     &now,
			ExternalID: orderID,
		}

		return s.orderRepo.CompletePaymentWithTx(payment)
	} else if transactionStatus == "cancel" || transactionStatus == "deny" || transactionStatus == "expire" {
		payment := &model.Payment{
			OrderID:       orderUUID(orderID),
			Method:        "midtrans",
			Provider:      "midtrans",
			Status:        "EXPIRED",
			ExternalID:    orderID,
			FailureReason: transactionStatus,
		}
		if statusCode != "" || grossAmount != "" {
			_ = s.orderRepo.CreateOrUpdatePayment(payment)
		}
		return s.orderRepo.CancelOrderWithTx(orderID, transactionStatus)
	}

	return nil
}

func orderUUID(value string) uuid.UUID {
	parsed, err := uuid.Parse(value)
	if err != nil {
		return uuid.Nil
	}
	return parsed
}
