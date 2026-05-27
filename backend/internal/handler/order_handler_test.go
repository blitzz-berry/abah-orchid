package handler

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"orchidmart-backend/internal/dto/request"
	"orchidmart-backend/internal/model"
)

type fakeOrderService struct {
	getOrderByIDFn        func(string, string) (*model.Order, error)
	cancelOrderFn         func(string, string, string) (string, error)
	requestReturnFn       func(string, string, string) error
	adminCancelOrderFn    func(string, string) (string, error)
	approveCancellationFn func(string, string) (string, error)
	rejectCancellationFn  func(string, string) (string, error)
	approveReturnFn       func(string, string) (string, error)
	rejectReturnFn        func(string, string) (string, error)
	refundOrderFn         func(string, string, float64) error
}

func (f *fakeOrderService) Checkout(string, request.CheckoutRequest) (*model.Order, string, error) {
	return nil, "", errors.New("not implemented")
}
func (f *fakeOrderService) GetOrders(string) ([]model.Order, error) { return nil, errors.New("not implemented") }
func (f *fakeOrderService) GetOrderByID(orderID, userID string) (*model.Order, error) {
	return f.getOrderByIDFn(orderID, userID)
}
func (f *fakeOrderService) UpdateOrderStatus(string, string) error { return errors.New("not implemented") }
func (f *fakeOrderService) ConfirmDelivery(string, string) error   { return errors.New("not implemented") }
func (f *fakeOrderService) CancelOrder(orderID, userID, reason string) (string, error) {
	return f.cancelOrderFn(orderID, userID, reason)
}
func (f *fakeOrderService) AdminCancelOrder(orderID, reason string) (string, error) {
	return f.adminCancelOrderFn(orderID, reason)
}
func (f *fakeOrderService) ApproveCancellation(orderID, reason string) (string, error) {
	return f.approveCancellationFn(orderID, reason)
}
func (f *fakeOrderService) RejectCancellation(orderID, reason string) (string, error) {
	return f.rejectCancellationFn(orderID, reason)
}
func (f *fakeOrderService) ApproveReturn(orderID, reason string) (string, error) {
	return f.approveReturnFn(orderID, reason)
}
func (f *fakeOrderService) RejectReturn(orderID, reason string) (string, error) {
	return f.rejectReturnFn(orderID, reason)
}
func (f *fakeOrderService) InitiatePayment(string, string) (*model.Payment, error) {
	return nil, errors.New("not implemented")
}
func (f *fakeOrderService) GetPaymentStatus(string, string) (*model.Payment, error) {
	return nil, errors.New("not implemented")
}
func (f *fakeOrderService) UploadPaymentProof(string, string, string) (*model.Payment, error) {
	return nil, errors.New("not implemented")
}
func (f *fakeOrderService) ConfirmManualPayment(string) error { return errors.New("not implemented") }
func (f *fakeOrderService) ExpirePendingPayments() (int64, error) {
	return 0, errors.New("not implemented")
}
func (f *fakeOrderService) RequestReturn(orderID, userID, reason string) error {
	return f.requestReturnFn(orderID, userID, reason)
}
func (f *fakeOrderService) RefundOrder(orderID, reason string, amount float64) error {
	return f.refundOrderFn(orderID, reason, amount)
}
func (f *fakeOrderService) HandleMidtransWebhook(map[string]interface{}) error {
	return errors.New("not implemented")
}

func TestOrderHandlerCancelOrderRequiresAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewOrderHandler(&fakeOrderService{
		getOrderByIDFn:  func(string, string) (*model.Order, error) { return nil, nil },
		cancelOrderFn:   func(string, string, string) (string, error) { return "", nil },
		requestReturnFn: func(string, string, string) error { return nil },
	}, nil)
	router := gin.New()
	router.POST("/orders/:id/cancel", handler.CancelOrder)

	req := newOrderJSONRequest(t, http.MethodPost, "/orders/order-1/cancel", map[string]string{"reason": "Salah pilih"})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusUnauthorized)
	}
}

func TestOrderHandlerCancelOrderMapsUnknownServiceErrorToGenericMessage(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewOrderHandler(&fakeOrderService{
		getOrderByIDFn: func(string, string) (*model.Order, error) { return nil, nil },
		cancelOrderFn: func(orderID, userID, reason string) (string, error) {
			return "", errors.New("database exploded")
		},
		requestReturnFn: func(string, string, string) error { return nil },
	}, nil)
	router := gin.New()
	router.POST("/orders/:id/cancel", func(c *gin.Context) {
		c.Set("userID", "user-1")
		handler.CancelOrder(c)
	})

	req := newOrderJSONRequest(t, http.MethodPost, "/orders/order-1/cancel", map[string]string{"reason": "Salah pilih"})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusBadRequest)
	}
	assertJSONErrorContains(t, recorder.Body.Bytes(), "Gagal memproses pembatalan pesanan. Silakan coba lagi.")
}

func TestOrderHandlerCancelOrderReturnsStatusOnSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewOrderHandler(&fakeOrderService{
		getOrderByIDFn: func(string, string) (*model.Order, error) { return nil, nil },
		cancelOrderFn: func(orderID, userID, reason string) (string, error) {
			if orderID != "order-1" || userID != "user-1" || reason != "Salah pilih produk" {
				t.Fatalf("CancelOrder() args = %q %q %q", orderID, userID, reason)
			}
			return "CANCELLATION_REQUESTED", nil
		},
		requestReturnFn: func(string, string, string) error { return nil },
	}, nil)
	router := gin.New()
	router.POST("/orders/:id/cancel", func(c *gin.Context) {
		c.Set("userID", "user-1")
		handler.CancelOrder(c)
	})

	req := newOrderJSONRequest(t, http.MethodPost, "/orders/order-1/cancel", map[string]string{"reason": "Salah pilih produk"})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	assertJSONFieldEquals(t, recorder.Body.Bytes(), "data.status", "CANCELLATION_REQUESTED")
}

func TestOrderHandlerRequestReturnRequiresReason(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewOrderHandler(&fakeOrderService{
		getOrderByIDFn:  func(string, string) (*model.Order, error) { return nil, nil },
		cancelOrderFn:   func(string, string, string) (string, error) { return "", nil },
		requestReturnFn: func(string, string, string) error { t.Fatal("RequestReturn() should not be called"); return nil },
	}, nil)
	router := gin.New()
	router.POST("/orders/:id/request-return", func(c *gin.Context) {
		c.Set("userID", "user-1")
		handler.RequestReturn(c)
	})

	req := newOrderJSONRequest(t, http.MethodPost, "/orders/order-1/request-return", map[string]string{})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusBadRequest)
	}
}

func TestOrderHandlerRequestReturnCallsServiceOnSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewOrderHandler(&fakeOrderService{
		getOrderByIDFn: func(string, string) (*model.Order, error) { return nil, nil },
		cancelOrderFn:  func(string, string, string) (string, error) { return "", nil },
		requestReturnFn: func(orderID, userID, reason string) error {
			if orderID != "order-1" || userID != "user-1" || reason != "Produk rusak" {
				t.Fatalf("RequestReturn() args = %q %q %q", orderID, userID, reason)
			}
			return nil
		},
	}, nil)
	router := gin.New()
	router.POST("/orders/:id/request-return", func(c *gin.Context) {
		c.Set("userID", "user-1")
		handler.RequestReturn(c)
	})

	req := newOrderJSONRequest(t, http.MethodPost, "/orders/order-1/request-return", map[string]string{"reason": "Produk rusak"})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
}

func newOrderJSONRequest(t *testing.T, method, path string, payload any) *http.Request {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("Marshal() error = %v", err)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	return req
}
