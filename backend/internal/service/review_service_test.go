package service

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"orchidmart-backend/internal/model"
)

type fakeReviewRepo struct {
	reviewsByProduct map[string][]model.Review
	existingReview   *model.Review
	createdReview    *model.Review
	createErr        error
}

func (r *fakeReviewRepo) ListByProductID(productID string) ([]model.Review, error) {
	return r.reviewsByProduct[productID], nil
}

func (r *fakeReviewRepo) FindByOrderUserAndProduct(string, string, string) (*model.Review, error) {
	return r.existingReview, nil
}

func (r *fakeReviewRepo) Create(review *model.Review) error {
	r.createdReview = review
	return r.createErr
}

type fakeOrderRepo struct {
	order *model.Order
	err   error
}

func (r *fakeOrderRepo) CreateOrderWithTx(*model.Order, string) error {
	return nil
}

func (r *fakeOrderRepo) CreateOrderFromCartItemsWithTx(*model.Order, string, []string) error {
	return nil
}

func (r *fakeOrderRepo) GetOrderByID(string) (*model.Order, error) {
	return r.order, r.err
}

func (r *fakeOrderRepo) GetOrderByIDForUser(string, string) (*model.Order, error) {
	return r.order, r.err
}

func (r *fakeOrderRepo) GetOrdersByUserID(string) ([]model.Order, error) {
	return nil, nil
}

func (r *fakeOrderRepo) UpdateOrderStatus(string, string) error {
	return nil
}

func (r *fakeOrderRepo) ConfirmDelivery(string, string) error {
	return nil
}

func (r *fakeOrderRepo) CreateOrUpdatePayment(*model.Payment) error {
	return nil
}

func (r *fakeOrderRepo) GetPaymentByOrderID(string) (*model.Payment, error) {
	return nil, nil
}

func (r *fakeOrderRepo) CompletePaymentWithTx(*model.Payment) error {
	return nil
}

func (r *fakeOrderRepo) CancelOrderWithTx(string, string) error {
	return nil
}

func (r *fakeOrderRepo) ExpirePendingPayments(time.Time) (int64, error) {
	return 0, nil
}

func (r *fakeOrderRepo) RequestReturn(string, string, string) error {
	return nil
}

func (r *fakeOrderRepo) RefundOrder(string, string, float64) error {
	return nil
}

func TestReviewServiceCreateAllowsCompletedOrderItem(t *testing.T) {
	userID := uuid.New()
	orderID := uuid.New()
	productID := uuid.New()
	reviewRepo := &fakeReviewRepo{}
	orderRepo := &fakeOrderRepo{order: &model.Order{
		ID:     orderID,
		UserID: userID,
		Status: "COMPLETED",
		Items:  []model.OrderItem{{ProductID: productID}},
	}}
	svc := NewReviewService(reviewRepo, orderRepo)

	err := svc.Create(userID.String(), orderID.String(), productID.String(), 5, "Subur dan sehat")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if reviewRepo.createdReview == nil {
		t.Fatal("Create() did not persist review")
	}
	if reviewRepo.createdReview.UserID != userID || reviewRepo.createdReview.OrderID != orderID || reviewRepo.createdReview.ProductID != productID {
		t.Fatalf("Create() persisted wrong review: %+v", reviewRepo.createdReview)
	}
}

func TestReviewServiceCreateRejectsInvalidOrderStatesAndOwnership(t *testing.T) {
	userID := uuid.New()
	orderID := uuid.New()
	productID := uuid.New()

	tests := []struct {
		name  string
		order *model.Order
	}{
		{
			name: "order belongs to another user",
			order: &model.Order{
				ID:     orderID,
				UserID: uuid.New(),
				Status: "COMPLETED",
				Items:  []model.OrderItem{{ProductID: productID}},
			},
		},
		{
			name: "order is not completed",
			order: &model.Order{
				ID:     orderID,
				UserID: userID,
				Status: "SHIPPED",
				Items:  []model.OrderItem{{ProductID: productID}},
			},
		},
		{
			name: "product is not in order",
			order: &model.Order{
				ID:     orderID,
				UserID: userID,
				Status: "COMPLETED",
				Items:  []model.OrderItem{{ProductID: uuid.New()}},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reviewRepo := &fakeReviewRepo{}
			orderRepo := &fakeOrderRepo{order: tt.order}
			svc := NewReviewService(reviewRepo, orderRepo)

			if err := svc.Create(userID.String(), orderID.String(), productID.String(), 5, "Review"); err == nil {
				t.Fatal("Create() expected validation error")
			}
			if reviewRepo.createdReview != nil {
				t.Fatal("Create() should not persist invalid review")
			}
		})
	}
}

func TestReviewServiceCreateRejectsDuplicateReview(t *testing.T) {
	userID := uuid.New()
	orderID := uuid.New()
	productID := uuid.New()
	reviewRepo := &fakeReviewRepo{existingReview: &model.Review{ID: uuid.New()}}
	orderRepo := &fakeOrderRepo{order: &model.Order{
		ID:     orderID,
		UserID: userID,
		Status: "COMPLETED",
		Items:  []model.OrderItem{{ProductID: productID}},
	}}
	svc := NewReviewService(reviewRepo, orderRepo)

	if err := svc.Create(userID.String(), orderID.String(), productID.String(), 5, "Review"); err == nil {
		t.Fatal("Create() expected duplicate review error")
	}
	if reviewRepo.createdReview != nil {
		t.Fatal("Create() should not persist duplicate review")
	}
}

func TestReviewServiceCreatePropagatesOrderLookupError(t *testing.T) {
	reviewRepo := &fakeReviewRepo{}
	orderRepo := &fakeOrderRepo{err: errors.New("order not found")}
	svc := NewReviewService(reviewRepo, orderRepo)

	if err := svc.Create(uuid.NewString(), uuid.NewString(), uuid.NewString(), 5, "Review"); err == nil {
		t.Fatal("Create() expected order lookup error")
	}
}
