package service

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"orchidmart-backend/internal/model"
)

type fakeReturnOrderRepo struct {
	order *model.Order
	err   error

	approveReturnOrderID string
	approveReturnReason  string
	approveReturnStatus  string
	approveReturnErr     error

	rejectReturnOrderID string
	rejectReturnReason  string
	rejectReturnStatus  string
	rejectReturnErr     error

	refundOrderID string
	refundReason  string
	refundAmount  float64
	refundErr     error
}

func (r *fakeReturnOrderRepo) CreateOrderWithTx(*model.Order, string) error { return nil }
func (r *fakeReturnOrderRepo) CreateOrderFromCartItemsWithTx(*model.Order, string, []string) error {
	return nil
}
func (r *fakeReturnOrderRepo) GetOrderByID(string) (*model.Order, error) { return r.order, r.err }
func (r *fakeReturnOrderRepo) GetOrderByIDForUser(string, string) (*model.Order, error) {
	return r.order, r.err
}
func (r *fakeReturnOrderRepo) GetOrdersByUserID(string) ([]model.Order, error)   { return nil, nil }
func (r *fakeReturnOrderRepo) UpdateOrderStatus(string, string) error            { return nil }
func (r *fakeReturnOrderRepo) ConfirmDelivery(string, string) error              { return nil }
func (r *fakeReturnOrderRepo) RequestCancellation(string, string, string) error  { return nil }
func (r *fakeReturnOrderRepo) RejectCancellation(string, string) (string, error) { return "", nil }
func (r *fakeReturnOrderRepo) CreateOrUpdatePayment(*model.Payment) error        { return nil }
func (r *fakeReturnOrderRepo) GetPaymentByOrderID(string) (*model.Payment, error) {
	return nil, errors.New("not implemented")
}
func (r *fakeReturnOrderRepo) CompletePaymentWithTx(*model.Payment) error { return nil }
func (r *fakeReturnOrderRepo) CancelOrderWithTx(string, string) error     { return nil }
func (r *fakeReturnOrderRepo) ExpirePendingPayments(time.Time) ([]string, error) {
	return nil, nil
}
func (r *fakeReturnOrderRepo) RequestReturn(string, string, string) error { return nil }
func (r *fakeReturnOrderRepo) RefundOrder(orderID, reason string, amount float64) error {
	r.refundOrderID = orderID
	r.refundReason = reason
	r.refundAmount = amount
	return r.refundErr
}
func (r *fakeReturnOrderRepo) ApproveReturn(orderID, reason string) (string, error) {
	r.approveReturnOrderID = orderID
	r.approveReturnReason = reason
	return r.approveReturnStatus, r.approveReturnErr
}
func (r *fakeReturnOrderRepo) RejectReturn(orderID, reason string) (string, error) {
	r.rejectReturnOrderID = orderID
	r.rejectReturnReason = reason
	return r.rejectReturnStatus, r.rejectReturnErr
}

type fakeReturnCartRepo struct{}

func (r *fakeReturnCartRepo) GetCartByUserID(string) (*model.Cart, error) { return nil, nil }
func (r *fakeReturnCartRepo) AddToCart(*model.CartItem) error             { return nil }
func (r *fakeReturnCartRepo) UpdateCartItemQuantity(string, string, int) error {
	return nil
}
func (r *fakeReturnCartRepo) RemoveFromCart(string, string) error { return nil }
func (r *fakeReturnCartRepo) ClearCart(string) error              { return nil }

type fakeOrderEventPublisher struct {
	userID  string
	orderID string
	status  string
}

func (p *fakeOrderEventPublisher) OrderChanged(userID, orderID, status string) {
	p.userID = userID
	p.orderID = orderID
	p.status = status
}

func (p *fakeOrderEventPublisher) PaymentChanged(string, string, string) {}

func TestApproveReturnRequiresRequestStatus(t *testing.T) {
	repo := &fakeReturnOrderRepo{order: &model.Order{Status: "COMPLETED"}}
	svc := NewOrderService(repo, &fakeReturnCartRepo{})

	if _, err := svc.ApproveReturn("order-1", "oke"); err == nil {
		t.Fatal("ApproveReturn() expected validation error")
	}
}

func TestApproveReturnDelegatesToRepository(t *testing.T) {
	userID := uuid.New()
	repo := &fakeReturnOrderRepo{
		order:               &model.Order{Status: "RETURN_REQUESTED", UserID: userID},
		approveReturnStatus: "RETURN_APPROVED",
	}
	events := &fakeOrderEventPublisher{}
	svc := NewRealtimeOrderServiceWithDB(repo, &fakeReturnCartRepo{}, nil, events)

	status, err := svc.ApproveReturn("order-2", "Produk memenuhi syarat retur")
	if err != nil {
		t.Fatalf("ApproveReturn() error = %v", err)
	}
	if status != "RETURN_APPROVED" {
		t.Fatalf("ApproveReturn() status = %s, want RETURN_APPROVED", status)
	}
	if repo.approveReturnOrderID != "order-2" || repo.approveReturnReason != "Produk memenuhi syarat retur" {
		t.Fatalf("ApproveReturn() payload incorrect: %+v", repo)
	}
	if events.userID != userID.String() || events.orderID != "order-2" || events.status != "RETURN_APPROVED" {
		t.Fatalf("ApproveReturn() realtime event = %+v", events)
	}
}

func TestRejectReturnRequiresReason(t *testing.T) {
	repo := &fakeReturnOrderRepo{order: &model.Order{Status: "RETURN_REQUESTED"}}
	svc := NewOrderService(repo, &fakeReturnCartRepo{})

	if _, err := svc.RejectReturn("order-3", " "); err == nil {
		t.Fatal("RejectReturn() expected validation error")
	}
}

func TestRejectReturnDelegatesToRepository(t *testing.T) {
	userID := uuid.New()
	repo := &fakeReturnOrderRepo{
		order:              &model.Order{Status: "RETURN_REQUESTED", UserID: userID},
		rejectReturnStatus: "COMPLETED",
	}
	events := &fakeOrderEventPublisher{}
	svc := NewRealtimeOrderServiceWithDB(repo, &fakeReturnCartRepo{}, nil, events)

	status, err := svc.RejectReturn("order-4", "Tanaman masih sesuai deskripsi")
	if err != nil {
		t.Fatalf("RejectReturn() error = %v", err)
	}
	if status != "COMPLETED" {
		t.Fatalf("RejectReturn() status = %s, want COMPLETED", status)
	}
	if repo.rejectReturnOrderID != "order-4" || repo.rejectReturnReason != "Tanaman masih sesuai deskripsi" {
		t.Fatalf("RejectReturn() payload incorrect: %+v", repo)
	}
	if events.userID != userID.String() || events.orderID != "order-4" || events.status != "COMPLETED" {
		t.Fatalf("RejectReturn() realtime event = %+v", events)
	}
}
