package service

import (
	"errors"
	"testing"
	"time"

	"orchidmart-backend/internal/model"
)

type fakeCancellationOrderRepo struct {
	orderForUser *model.Order
	order        *model.Order
	err          error

	cancelledOrderID string
	cancelReason     string

	requestCancelOrderID string
	requestCancelUserID  string
	requestCancelReason  string

	refundOrderID string
	refundReason  string
	refundAmount  float64

	rejectOrderID string
	rejectReason  string
	rejectStatus  string

	cancelErr  error
	requestErr error
	refundErr  error
	rejectErr  error
}

func (r *fakeCancellationOrderRepo) CreateOrderWithTx(*model.Order, string) error {
	return nil
}

func (r *fakeCancellationOrderRepo) CreateOrderFromCartItemsWithTx(*model.Order, string, []string) error {
	return nil
}

func (r *fakeCancellationOrderRepo) GetOrderByID(string) (*model.Order, error) {
	return r.order, r.err
}

func (r *fakeCancellationOrderRepo) GetOrderByIDForUser(string, string) (*model.Order, error) {
	return r.orderForUser, r.err
}

func (r *fakeCancellationOrderRepo) GetOrdersByUserID(string) ([]model.Order, error) {
	return nil, nil
}

func (r *fakeCancellationOrderRepo) UpdateOrderStatus(string, string) error {
	return nil
}

func (r *fakeCancellationOrderRepo) ConfirmDelivery(string, string) error {
	return nil
}

func (r *fakeCancellationOrderRepo) RequestCancellation(orderID, userID, reason string) error {
	r.requestCancelOrderID = orderID
	r.requestCancelUserID = userID
	r.requestCancelReason = reason
	return r.requestErr
}

func (r *fakeCancellationOrderRepo) RejectCancellation(orderID, reason string) (string, error) {
	r.rejectOrderID = orderID
	r.rejectReason = reason
	return r.rejectStatus, r.rejectErr
}

func (r *fakeCancellationOrderRepo) ApproveReturn(string, string) (string, error) {
	return "", nil
}

func (r *fakeCancellationOrderRepo) RejectReturn(string, string) (string, error) {
	return "", nil
}

func (r *fakeCancellationOrderRepo) CreateOrUpdatePayment(*model.Payment) error {
	return nil
}

func (r *fakeCancellationOrderRepo) GetPaymentByOrderID(string) (*model.Payment, error) {
	return nil, errors.New("not implemented")
}

func (r *fakeCancellationOrderRepo) CompletePaymentWithTx(*model.Payment) error {
	return nil
}

func (r *fakeCancellationOrderRepo) CancelOrderWithTx(orderID, reason string) error {
	r.cancelledOrderID = orderID
	r.cancelReason = reason
	return r.cancelErr
}

func (r *fakeCancellationOrderRepo) ExpirePendingPayments(_ time.Time) (int64, error) {
	return 0, nil
}

func (r *fakeCancellationOrderRepo) RequestReturn(string, string, string) error {
	return nil
}

func (r *fakeCancellationOrderRepo) RefundOrder(orderID, reason string, amount float64) error {
	r.refundOrderID = orderID
	r.refundReason = reason
	r.refundAmount = amount
	return r.refundErr
}

type fakeCancellationCartRepo struct{}

func (r *fakeCancellationCartRepo) GetCartByUserID(string) (*model.Cart, error) { return nil, nil }
func (r *fakeCancellationCartRepo) AddToCart(*model.CartItem) error              { return nil }
func (r *fakeCancellationCartRepo) UpdateCartItemQuantity(string, string, int) error {
	return nil
}
func (r *fakeCancellationCartRepo) RemoveFromCart(string, string) error { return nil }
func (r *fakeCancellationCartRepo) ClearCart(string) error              { return nil }

func TestCancelOrderPendingPaymentCancelsDirectly(t *testing.T) {
	repo := &fakeCancellationOrderRepo{
		orderForUser: &model.Order{Status: "PENDING_PAYMENT"},
	}
	svc := NewOrderService(repo, &fakeCancellationCartRepo{})

	status, err := svc.CancelOrder("order-1", "user-1", "")
	if err != nil {
		t.Fatalf("CancelOrder() error = %v", err)
	}
	if status != "CANCELLED" {
		t.Fatalf("CancelOrder() status = %s, want CANCELLED", status)
	}
	if repo.cancelledOrderID != "order-1" {
		t.Fatalf("CancelOrder() cancelled order id = %s", repo.cancelledOrderID)
	}
	if repo.cancelReason != "Customer cancelled pending order" {
		t.Fatalf("CancelOrder() reason = %q", repo.cancelReason)
	}
}

func TestCancelOrderPaidRequiresReason(t *testing.T) {
	repo := &fakeCancellationOrderRepo{
		orderForUser: &model.Order{Status: "PAID"},
	}
	svc := NewOrderService(repo, &fakeCancellationCartRepo{})

	if _, err := svc.CancelOrder("order-1", "user-1", "   "); err == nil {
		t.Fatal("CancelOrder() expected validation error for empty reason")
	}
	if repo.requestCancelOrderID != "" {
		t.Fatal("CancelOrder() should not request cancellation when reason is empty")
	}
}

func TestCancelOrderPaidRequestsReview(t *testing.T) {
	repo := &fakeCancellationOrderRepo{
		orderForUser: &model.Order{Status: "PAID"},
	}
	svc := NewOrderService(repo, &fakeCancellationCartRepo{})

	status, err := svc.CancelOrder("order-1", "user-1", "Salah pilih produk")
	if err != nil {
		t.Fatalf("CancelOrder() error = %v", err)
	}
	if status != "CANCELLATION_REQUESTED" {
		t.Fatalf("CancelOrder() status = %s, want CANCELLATION_REQUESTED", status)
	}
	if repo.requestCancelOrderID != "order-1" || repo.requestCancelUserID != "user-1" {
		t.Fatalf("CancelOrder() request args not captured correctly: %+v", repo)
	}
	if repo.requestCancelReason != "Salah pilih produk" {
		t.Fatalf("CancelOrder() reason = %q", repo.requestCancelReason)
	}
}

func TestAdminCancelPaidRefundsOrder(t *testing.T) {
	repo := &fakeCancellationOrderRepo{
		order: &model.Order{Status: "PAID", Total: 145000},
	}
	svc := NewOrderService(repo, &fakeCancellationCartRepo{})

	status, err := svc.AdminCancelOrder("order-2", "Stok rusak")
	if err != nil {
		t.Fatalf("AdminCancelOrder() error = %v", err)
	}
	if status != "REFUNDED" {
		t.Fatalf("AdminCancelOrder() status = %s, want REFUNDED", status)
	}
	if repo.refundOrderID != "order-2" {
		t.Fatalf("AdminCancelOrder() refund order id = %s", repo.refundOrderID)
	}
	if repo.refundReason != "Stok rusak" || repo.refundAmount != 145000 {
		t.Fatalf("AdminCancelOrder() refund payload = reason:%q amount:%v", repo.refundReason, repo.refundAmount)
	}
}

func TestApproveCancellationUsesStoredReasonAndRefundsPaidOrder(t *testing.T) {
	repo := &fakeCancellationOrderRepo{
		order: &model.Order{
			Status:                          "CANCELLATION_REQUESTED",
			Total:                           99000,
			CancellationReason:             "Mau ganti warna",
			CancellationRequestedFromStatus: "PAID",
		},
	}
	svc := NewOrderService(repo, &fakeCancellationCartRepo{})

	status, err := svc.ApproveCancellation("order-3", "")
	if err != nil {
		t.Fatalf("ApproveCancellation() error = %v", err)
	}
	if status != "REFUNDED" {
		t.Fatalf("ApproveCancellation() status = %s, want REFUNDED", status)
	}
	if repo.refundOrderID != "order-3" || repo.refundReason != "Mau ganti warna" || repo.refundAmount != 99000 {
		t.Fatalf("ApproveCancellation() refund payload incorrect: %+v", repo)
	}
}

func TestRejectCancellationRequiresReason(t *testing.T) {
	repo := &fakeCancellationOrderRepo{}
	svc := NewOrderService(repo, &fakeCancellationCartRepo{})

	if _, err := svc.RejectCancellation("order-4", " "); err == nil {
		t.Fatal("RejectCancellation() expected validation error for empty reason")
	}
	if repo.rejectOrderID != "" {
		t.Fatal("RejectCancellation() should not call repository when reason is empty")
	}
}
