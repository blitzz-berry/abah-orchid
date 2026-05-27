package service

import (
	"errors"
	"fmt"
	"log"
	"math"
	"reflect"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/google/uuid"
	"github.com/midtrans/midtrans-go"
	"github.com/midtrans/midtrans-go/snap"

	"orchidmart-backend/internal/dto/request"
	"orchidmart-backend/internal/model"
	"orchidmart-backend/internal/pkg/appcache"
	mailerPkg "orchidmart-backend/internal/pkg/mailer"
	midtransPkg "orchidmart-backend/internal/pkg/midtrans"
	"orchidmart-backend/internal/pkg/rajaongkir"
	"orchidmart-backend/internal/repository"
)

type OrderService interface {
	Checkout(userID string, req request.CheckoutRequest) (*model.Order, string, error)
	GetOrders(userID string) ([]model.Order, error)
	GetOrderByID(orderID, userID string) (*model.Order, error)
	UpdateOrderStatus(orderID string, status string) error
	ConfirmDelivery(orderID, userID string) error
	CancelOrder(orderID, userID, reason string) (string, error)
	AdminCancelOrder(orderID, reason string) (string, error)
	ApproveCancellation(orderID, reason string) (string, error)
	RejectCancellation(orderID, reason string) (string, error)
	ApproveReturn(orderID, reason string) (string, error)
	RejectReturn(orderID, reason string) (string, error)
	InitiatePayment(orderID, userID string) (*model.Payment, error)
	GetPaymentStatus(orderID, userID string) (*model.Payment, error)
	UploadPaymentProof(orderID, userID, proofImageURL string) (*model.Payment, error)
	ConfirmManualPayment(orderID string) error
	ExpirePendingPayments() (int64, error)
	RequestReturn(orderID, userID, reason string) error
	RefundOrder(orderID, reason string, amount float64) error
	HandleMidtransWebhook(payload map[string]interface{}) error
}

type OrderEventPublisher interface {
	OrderChanged(userID, orderID, status string)
	PaymentChanged(userID, orderID, status string)
}

type orderService struct {
	orderRepo repository.OrderRepository
	cartRepo  repository.CartRepository
	db        *gorm.DB
	cache     appcache.Store
	events    OrderEventPublisher
}

func NewOrderService(orderRepo repository.OrderRepository, cartRepo repository.CartRepository, stores ...appcache.Store) OrderService {
	return &orderService{orderRepo: orderRepo, cartRepo: cartRepo, cache: optionalCache(stores)}
}

func NewOrderServiceWithDB(orderRepo repository.OrderRepository, cartRepo repository.CartRepository, db *gorm.DB, stores ...appcache.Store) OrderService {
	return &orderService{orderRepo: orderRepo, cartRepo: cartRepo, db: db, cache: optionalCache(stores)}
}

func NewRealtimeOrderServiceWithDB(orderRepo repository.OrderRepository, cartRepo repository.CartRepository, db *gorm.DB, events OrderEventPublisher, stores ...appcache.Store) OrderService {
	return &orderService{orderRepo: orderRepo, cartRepo: cartRepo, db: db, cache: optionalCache(stores), events: events}
}

func (s *orderService) Checkout(userID string, req request.CheckoutRequest) (*model.Order, string, error) {
	cart, err := s.cartRepo.GetCartByUserID(userID)
	if err != nil || len(cart.Items) == 0 {
		return nil, "", errors.New("cart is empty or not found")
	}

	var subtotal float64
	var totalWeightGram int
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
		if item.Product.WeightGram > 0 {
			totalWeightGram += item.Product.WeightGram * item.Quantity
		}

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
	if totalWeightGram <= 0 {
		totalWeightGram = 1000
	}

	discount, err := s.calculateDiscount(req.CouponCode, subtotal)
	if err != nil {
		return nil, "", err
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
	packingCost, err := packingCostForType(packingType)
	if err != nil {
		return nil, "", err
	}

	shippingCost, err := s.calculateShippingCost(req.DestinationCityID, req.CourierCode, req.CourierService, totalWeightGram)
	if err != nil {
		return nil, "", err
	}

	insuranceCost := 0.0
	if req.ShippingInsurance {
		insuranceCost = math.Ceil(subtotal * 0.005)
	}

	total := subtotal + shippingCost + insuranceCost + packingCost - discount
	if total < 0 {
		return nil, "", errors.New("invalid order total")
	}

	parsedUserID, _ := uuid.Parse(userID)
	customerEmail := s.checkoutCustomerEmail(parsedUserID)
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
		ShippingCost:       shippingCost,
		ShippingInsurance:  req.ShippingInsurance,
		InsuranceCost:      insuranceCost,
		PackingType:        packingType,
		PackingCost:        packingCost,
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
	s.invalidateCatalog()

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
		s.publishOrderChanged(order.UserID.String(), order.ID.String(), order.Status)
		s.publishPaymentChanged(order.UserID.String(), order.ID.String(), payment.Status)
		return order, "", nil
	}

	snapReq := &snap.Request{
		TransactionDetails: midtrans.TransactionDetails{
			OrderID:  order.ID.String(),
			GrossAmt: int64(total),
		},
		CustomerDetail: &midtrans.CustomerDetails{
			FName: req.ShippingName,
			Email: customerEmail,
			Phone: req.ShippingPhone,
		},
		EnabledPayments: enabledSnapPayments(paymentMethod),
		Expiry: &snap.ExpiryDetails{
			Unit:     "hours",
			Duration: 24,
		},
	}

	snapResp, err := midtransPkg.SnapClient.CreateTransaction(snapReq)
	if hasSuccessfulMidtransResponse(snapResp) {
		err = nil
	}
	if !isNilLikeError(err) {
		log.Printf("midtrans create transaction failed for order %s method=%s total=%.2f: %v", order.ID.String(), paymentMethod, total, err)
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

	s.publishOrderChanged(order.UserID.String(), order.ID.String(), order.Status)
	s.publishPaymentChanged(order.UserID.String(), order.ID.String(), payment.Status)
	return order, snapResp.RedirectURL, nil
}

func (s *orderService) checkoutCustomerEmail(userID uuid.UUID) string {
	if s.db == nil || userID == uuid.Nil {
		return "customer@example.com"
	}

	var user model.User
	if err := s.db.Select("email").Where("id = ?", userID).First(&user).Error; err != nil {
		return "customer@example.com"
	}

	email := strings.TrimSpace(user.Email)
	if email == "" {
		return "customer@example.com"
	}
	return email
}

func packingCostForType(packingType string) (float64, error) {
	switch strings.ToLower(strings.TrimSpace(packingType)) {
	case "", "standard":
		return 0, nil
	case "premium":
		return 15000, nil
	default:
		return 0, errors.New("invalid packing type")
	}
}

func (s *orderService) calculateShippingCost(destinationCityID, courierCode, courierService string, totalWeightGram int) (float64, error) {
	destinationCityID = strings.TrimSpace(destinationCityID)
	courierCode = strings.ToLower(strings.TrimSpace(courierCode))
	courierService = strings.ToUpper(strings.TrimSpace(courierService))
	if destinationCityID == "" || courierCode == "" || courierService == "" {
		return 0, errors.New("shipping destination and courier are required")
	}

	resp, err := rajaongkir.GetCost(rajaongkir.CostPayload{
		Destination: destinationCityID,
		Weight:      totalWeightGram,
		Courier:     courierCode,
	})
	if err != nil {
		return 0, err
	}

	cost, ok := findRajaOngkirServiceCost(resp, courierService)
	if !ok {
		return 0, errors.New("selected courier service not available")
	}
	if cost < 0 {
		return 0, errors.New("invalid shipping cost")
	}
	return cost, nil
}

func findRajaOngkirServiceCost(payload interface{}, service string) (float64, bool) {
	root, ok := payload.(map[string]interface{})
	if !ok {
		return 0, false
	}
	raja, ok := root["rajaongkir"].(map[string]interface{})
	if !ok {
		return 0, false
	}
	results := normalizeInterfaceSlice(raja["results"])
	if len(results) == 0 {
		return 0, false
	}
	first, ok := results[0].(map[string]interface{})
	if !ok {
		return 0, false
	}
	costs := normalizeInterfaceSlice(first["costs"])
	if len(costs) == 0 {
		return 0, false
	}
	for _, rawCost := range costs {
		costItem, ok := rawCost.(map[string]interface{})
		if !ok {
			continue
		}
		svc, _ := costItem["service"].(string)
		if strings.ToUpper(strings.TrimSpace(svc)) != service {
			continue
		}
		costArr := normalizeInterfaceSlice(costItem["cost"])
		if len(costArr) == 0 {
			continue
		}
		cost0, ok := costArr[0].(map[string]interface{})
		if !ok {
			continue
		}
		value, ok := cost0["value"]
		if !ok {
			continue
		}
		switch v := value.(type) {
		case float64:
			return v, true
		case int:
			return float64(v), true
		case int64:
			return float64(v), true
		case string:
			// RajaOngkir biasanya number, tapi fallback/parsing bisa berubah.
			parsed, err := strconv.ParseFloat(strings.TrimSpace(v), 64)
			if err == nil {
				return parsed, true
			}
		}
	}
	return 0, false
}

func normalizeInterfaceSlice(value interface{}) []interface{} {
	switch v := value.(type) {
	case []interface{}:
		return v
	case []map[string]interface{}:
		result := make([]interface{}, 0, len(v))
		for _, item := range v {
			result = append(result, item)
		}
		return result
	case []map[string]string:
		result := make([]interface{}, 0, len(v))
		for _, item := range v {
			converted := make(map[string]interface{}, len(item))
			for key, raw := range item {
				converted[key] = raw
			}
			result = append(result, converted)
		}
		return result
	default:
		return nil
	}
}

func hasSuccessfulMidtransResponse(resp *snap.Response) bool {
	if resp == nil {
		return false
	}
	return strings.TrimSpace(resp.Token) != "" || strings.TrimSpace(resp.RedirectURL) != ""
}

func isNilLikeError(err error) bool {
	if err == nil {
		return true
	}

	value := reflect.ValueOf(err)
	switch value.Kind() {
	case reflect.Pointer, reflect.Interface, reflect.Map, reflect.Slice, reflect.Func:
		return value.IsNil()
	default:
		return false
	}
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
	status = normalizeOrderStatus(status)
	if status == "" {
		return errors.New("invalid order status")
	}

	order, err := s.orderRepo.GetOrderByID(orderID)
	if err != nil {
		return err
	}
	if !canTransitionOrder(order.Status, status) {
		return fmt.Errorf("invalid order status transition: %s -> %s", order.Status, status)
	}

	if status == "CANCELLED" {
		err := s.orderRepo.CancelOrderWithTx(orderID, "Order cancelled")
		if err == nil {
			s.invalidateCatalog()
			s.publishOrderChanged(order.UserID.String(), orderID, status)
		}
		return err
	}
	if err := s.orderRepo.UpdateOrderStatus(orderID, status); err != nil {
		return err
	}
	s.publishOrderChanged(order.UserID.String(), orderID, status)
	return nil
}

func normalizeOrderStatus(status string) string {
	status = strings.ToUpper(strings.TrimSpace(status))
	status = strings.ReplaceAll(status, " ", "_")
	switch status {
	case "PENDING_PAYMENT", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLATION_REQUESTED", "CANCELLED", "RETURN_REQUESTED", "RETURN_APPROVED", "REFUNDED":
		return status
	default:
		return ""
	}
}

func canTransitionOrder(from, to string) bool {
	from = normalizeOrderStatus(from)
	to = normalizeOrderStatus(to)
	if from == "" || to == "" || from == to {
		return false
	}
	allowed := map[string]map[string]struct{}{
		"PENDING_PAYMENT":        {"CANCELLED": {}},
		"CANCELLATION_REQUESTED": {"CANCELLED": {}, "PAID": {}, "PROCESSING": {}, "REFUNDED": {}},
		"PAID":                   {"PROCESSING": {}, "CANCELLED": {}, "REFUNDED": {}},
		"PROCESSING":             {"SHIPPED": {}, "CANCELLED": {}, "REFUNDED": {}},
		"SHIPPED":                {"DELIVERED": {}},
		"DELIVERED":              {"COMPLETED": {}, "RETURN_REQUESTED": {}},
		"COMPLETED":              {"RETURN_REQUESTED": {}},
		"RETURN_REQUESTED":       {"RETURN_APPROVED": {}, "DELIVERED": {}, "COMPLETED": {}},
		"RETURN_APPROVED":        {"REFUNDED": {}, "COMPLETED": {}},
	}
	_, ok := allowed[from][to]
	return ok
}

func (s *orderService) ConfirmDelivery(orderID, userID string) error {
	if err := s.orderRepo.ConfirmDelivery(orderID, userID); err != nil {
		return err
	}
	s.publishOrderChanged(userID, orderID, "COMPLETED")
	return nil
}

func (s *orderService) CancelOrder(orderID, userID, reason string) (string, error) {
	reason = strings.TrimSpace(reason)
	order, err := s.orderRepo.GetOrderByIDForUser(orderID, userID)
	if err != nil {
		return "", err
	}

	switch order.Status {
	case "PENDING_PAYMENT":
		if reason == "" {
			reason = "Customer cancelled pending order"
		}
		if err := s.orderRepo.CancelOrderWithTx(orderID, reason); err != nil {
			return "", err
		}
		s.invalidateCatalog()
		s.publishOrderChanged(userID, orderID, "CANCELLED")
		return "CANCELLED", nil
	case "PAID", "PROCESSING":
		if reason == "" {
			return "", errors.New("cancellation reason is required")
		}
		if err := s.orderRepo.RequestCancellation(orderID, userID, reason); err != nil {
			return "", err
		}
		s.publishOrderChanged(userID, orderID, "CANCELLATION_REQUESTED")
		return "CANCELLATION_REQUESTED", nil
	case "CANCELLATION_REQUESTED":
		return "", errors.New("cancellation request has already been submitted")
	default:
		return "", errors.New("order can no longer be cancelled")
	}
}

func (s *orderService) AdminCancelOrder(orderID, reason string) (string, error) {
	order, err := s.orderRepo.GetOrderByID(orderID)
	if err != nil {
		return "", err
	}

	if strings.TrimSpace(reason) == "" {
		reason = "Admin cancelled order"
	}

	switch order.Status {
	case "PENDING_PAYMENT":
		if err := s.orderRepo.CancelOrderWithTx(orderID, reason); err != nil {
			return "", err
		}
		s.invalidateCatalog()
		s.publishOrderChanged(order.UserID.String(), orderID, "CANCELLED")
		return "CANCELLED", nil
	case "PAID", "PROCESSING":
		if err := s.orderRepo.RefundOrder(orderID, reason, order.Total); err != nil {
			return "", err
		}
		s.invalidateCatalog()
		s.publishOrderChanged(order.UserID.String(), orderID, "REFUNDED")
		s.publishPaymentChanged(order.UserID.String(), orderID, "REFUNDED")
		return "REFUNDED", nil
	case "CANCELLATION_REQUESTED":
		return s.ApproveCancellation(orderID, reason)
	default:
		return "", errors.New("order is not eligible for admin cancellation")
	}
}

func (s *orderService) ApproveCancellation(orderID, reason string) (string, error) {
	order, err := s.orderRepo.GetOrderByID(orderID)
	if err != nil {
		return "", err
	}
	if order.Status != "CANCELLATION_REQUESTED" {
		return "", errors.New("order is not waiting for cancellation review")
	}

	if strings.TrimSpace(reason) == "" {
		reason = strings.TrimSpace(order.CancellationReason)
	}
	if strings.TrimSpace(reason) == "" {
		reason = "Cancellation approved by admin"
	}

	previousStatus := normalizeOrderStatus(order.CancellationRequestedFromStatus)
	switch previousStatus {
	case "", "PENDING_PAYMENT":
		if err := s.orderRepo.CancelOrderWithTx(orderID, reason); err != nil {
			return "", err
		}
		s.invalidateCatalog()
		s.publishOrderChanged(order.UserID.String(), orderID, "CANCELLED")
		return "CANCELLED", nil
	case "PAID", "PROCESSING":
		if err := s.orderRepo.RefundOrder(orderID, reason, order.Total); err != nil {
			return "", err
		}
		s.invalidateCatalog()
		s.publishOrderChanged(order.UserID.String(), orderID, "REFUNDED")
		s.publishPaymentChanged(order.UserID.String(), orderID, "REFUNDED")
		return "REFUNDED", nil
	default:
		return "", errors.New("cancellation request origin status is invalid")
	}
}

func (s *orderService) RejectCancellation(orderID, reason string) (string, error) {
	if strings.TrimSpace(reason) == "" {
		return "", errors.New("rejection reason is required")
	}
	order, err := s.orderRepo.GetOrderByID(orderID)
	if err != nil {
		return "", err
	}
	status, err := s.orderRepo.RejectCancellation(orderID, reason)
	if err == nil {
		s.publishOrderChanged(order.UserID.String(), orderID, status)
	}
	return status, err
}

func (s *orderService) ApproveReturn(orderID, reason string) (string, error) {
	order, err := s.orderRepo.GetOrderByID(orderID)
	if err != nil {
		return "", err
	}
	if order.Status != "RETURN_REQUESTED" {
		return "", errors.New("order is not waiting for return review")
	}
	status, err := s.orderRepo.ApproveReturn(orderID, reason)
	if err == nil {
		s.publishOrderChanged(order.UserID.String(), orderID, status)
	}
	return status, err
}

func (s *orderService) RejectReturn(orderID, reason string) (string, error) {
	if strings.TrimSpace(reason) == "" {
		return "", errors.New("rejection reason is required")
	}
	order, err := s.orderRepo.GetOrderByID(orderID)
	if err != nil {
		return "", err
	}
	if order.Status != "RETURN_REQUESTED" {
		return "", errors.New("order is not waiting for return review")
	}
	status, err := s.orderRepo.RejectReturn(orderID, reason)
	if err == nil {
		s.publishOrderChanged(order.UserID.String(), orderID, status)
	}
	return status, err
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
	if hasSuccessfulMidtransResponse(snapResp) {
		err = nil
	}
	if !isNilLikeError(err) {
		log.Printf("midtrans initiate payment failed for order %s method=%s total=%.2f: %v", order.ID.String(), paymentMethod, order.Total, err)
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

	s.publishPaymentChanged(order.UserID.String(), orderID, payment.Status)
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
	s.publishPaymentChanged(order.UserID.String(), orderID, payment.Status)
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
	shouldSendPaymentEmail := !hasConfirmedPaymentStatus(order.Status)

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
	if err := s.orderRepo.CompletePaymentWithTx(payment); err != nil {
		return err
	}
	s.publishOrderChanged(order.UserID.String(), orderID, "PAID")
	s.publishPaymentChanged(order.UserID.String(), orderID, "PAID")
	if shouldSendPaymentEmail {
		s.sendPaymentConfirmedEmail(order)
	}
	return nil
}

func (s *orderService) ExpirePendingPayments() (int64, error) {
	orderIDs, err := s.orderRepo.ExpirePendingPayments(time.Now())
	if len(orderIDs) > 0 {
		s.invalidateCatalog()
		for _, orderID := range orderIDs {
			s.publishChangedForOrder(orderID, "CANCELLED", "EXPIRED")
		}
	}
	return int64(len(orderIDs)), err
}

func (s *orderService) RequestReturn(orderID, userID, reason string) error {
	if strings.TrimSpace(reason) == "" {
		return errors.New("return reason is required")
	}
	if err := s.orderRepo.RequestReturn(orderID, userID, reason); err != nil {
		return err
	}
	s.publishOrderChanged(userID, orderID, "RETURN_REQUESTED")
	return nil
}

func (s *orderService) RefundOrder(orderID, reason string, amount float64) error {
	if strings.TrimSpace(reason) == "" {
		return errors.New("refund reason is required")
	}
	err := s.orderRepo.RefundOrder(orderID, reason, amount)
	if err == nil {
		s.invalidateCatalog()
		s.publishChangedForOrder(orderID, "REFUNDED", "REFUNDED")
	}
	return err
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
	switch strings.ToLower(coupon.DiscountType) {
	case "percentage":
		discount = subtotal * coupon.DiscountValue / 100
	case "fixed":
	default:
		return 0, errors.New("coupon discount type is invalid")
	}
	if coupon.MaxDiscount > 0 && discount > coupon.MaxDiscount {
		discount = coupon.MaxDiscount
	}
	if discount > subtotal {
		discount = subtotal
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
		shouldSendPaymentEmail := !hasConfirmedPaymentStatus(order.Status)
		if grossAmount == "" {
			return errors.New("invalid gross_amount in webhook")
		}
		paidAmount, err := strconv.ParseFloat(strings.TrimSpace(grossAmount), 64)
		if err != nil {
			return errors.New("invalid gross_amount format")
		}
		if math.Abs(paidAmount-order.Total) > 0.01 {
			return errors.New("payment amount mismatch")
		}

		// In a real app we'd fetch the payment row, here we just construct one for the TX
		now := time.Now()
		payment := &model.Payment{
			OrderID:    order.ID,
			Status:     "PAID",
			PaidAt:     &now,
			ExternalID: orderID,
		}

		if err := s.orderRepo.CompletePaymentWithTx(payment); err != nil {
			return err
		}
		s.publishOrderChanged(order.UserID.String(), orderID, "PAID")
		s.publishPaymentChanged(order.UserID.String(), orderID, "PAID")
		if shouldSendPaymentEmail {
			s.sendPaymentConfirmedEmail(order)
		}
		return nil
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
		err := s.orderRepo.CancelOrderWithTx(orderID, transactionStatus)
		if err == nil {
			s.invalidateCatalog()
			s.publishChangedForOrder(orderID, "CANCELLED", "EXPIRED")
		}
		return err
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

func optionalCache(stores []appcache.Store) appcache.Store {
	if len(stores) > 0 && stores[0] != nil {
		return stores[0]
	}
	return appcache.Disabled()
}

func (s *orderService) invalidateCatalog() {
	s.cache.DeletePrefix(appcache.CatalogPrefix)
}

func (s *orderService) publishOrderChanged(userID, orderID, status string) {
	if s.events != nil {
		s.events.OrderChanged(userID, orderID, status)
	}
}

func (s *orderService) publishPaymentChanged(userID, orderID, status string) {
	if s.events != nil {
		s.events.PaymentChanged(userID, orderID, status)
	}
}

func (s *orderService) publishChangedForOrder(orderID, orderStatus, paymentStatus string) {
	if s.events == nil {
		return
	}
	order, err := s.orderRepo.GetOrderByID(orderID)
	if err != nil {
		return
	}
	if orderStatus != "" {
		s.publishOrderChanged(order.UserID.String(), orderID, orderStatus)
	}
	if paymentStatus != "" {
		s.publishPaymentChanged(order.UserID.String(), orderID, paymentStatus)
	}
}

func hasConfirmedPaymentStatus(status string) bool {
	switch normalizeOrderStatus(status) {
	case "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED", "RETURN_REQUESTED", "RETURN_APPROVED", "REFUNDED":
		return true
	default:
		return false
	}
}

func (s *orderService) sendPaymentConfirmedEmail(order *model.Order) {
	if order == nil || strings.TrimSpace(order.User.Email) == "" {
		return
	}
	orderCopy := *order
	go func() {
		err := mailerPkg.SendPaymentConfirmedEmail(orderCopy.User.Email, orderCopy.User.FullName, orderCopy.OrderNumber, orderCopy.Total)
		if err != nil && !errors.Is(err, mailerPkg.ErrMailerNotConfigured) {
			log.Printf("payment confirmation email failed for order %s: %v", orderCopy.ID.String(), err)
		}
	}()
}
