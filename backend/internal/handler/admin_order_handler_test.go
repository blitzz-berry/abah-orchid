package handler

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestAdminHandlerRefundOrderRequiresReason(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewAdminHandler(nil, &fakeOrderService{
		refundOrderFn: func(string, string, float64) error {
			t.Fatal("RefundOrder() should not be called on invalid payload")
			return nil
		},
	})
	router := gin.New()
	router.POST("/admin/orders/:id/refund", handler.RefundOrder)

	req := newOrderJSONRequest(t, http.MethodPost, "/admin/orders/order-1/refund", map[string]any{"amount": 10000})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusBadRequest)
	}
}

func TestAdminHandlerRefundOrderCallsServiceOnSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewAdminHandler(nil, &fakeOrderService{
		refundOrderFn: func(orderID, reason string, amount float64) error {
			if orderID != "order-1" || reason != "Tanaman rusak" || amount != 25000 {
				t.Fatalf("RefundOrder() args = %q %q %v", orderID, reason, amount)
			}
			return nil
		},
	})
	router := gin.New()
	router.POST("/admin/orders/:id/refund", func(c *gin.Context) {
		c.Set("userID", "not-a-uuid")
		handler.RefundOrder(c)
	})

	req := newOrderJSONRequest(t, http.MethodPost, "/admin/orders/order-1/refund", map[string]any{"reason": "Tanaman rusak", "amount": 25000})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
}

func TestAdminHandlerCancelOrderPassesReasonToService(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewAdminHandler(nil, &fakeOrderService{
		adminCancelOrderFn: func(orderID, reason string) (string, error) {
			if orderID != "order-1" || reason != "Stok rusak" {
				t.Fatalf("AdminCancelOrder() args = %q %q", orderID, reason)
			}
			return "", errors.New("forced stop after service capture")
		},
	})
	router := gin.New()
	router.POST("/admin/orders/:id/cancel", handler.CancelOrder)

	req := newOrderJSONRequest(t, http.MethodPost, "/admin/orders/order-1/cancel", map[string]string{"reason": "Stok rusak"})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusBadRequest)
	}
	assertJSONErrorContains(t, recorder.Body.Bytes(), "forced stop after service capture")
}

func TestAdminHandlerApproveReturnAllowsEmptyJSONBodyAndCallsService(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewAdminHandler(nil, &fakeOrderService{
		approveReturnFn: func(orderID, reason string) (string, error) {
			if orderID != "order-1" || reason != "" {
				t.Fatalf("ApproveReturn() args = %q %q", orderID, reason)
			}
			return "", errors.New("forced stop after service capture")
		},
	})
	router := gin.New()
	router.POST("/admin/orders/:id/approve-return", handler.ApproveReturn)

	req := httptest.NewRequest(http.MethodPost, "/admin/orders/order-1/approve-return", nil)
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusBadRequest)
	}
	assertJSONErrorContains(t, recorder.Body.Bytes(), "forced stop after service capture")
}

func TestAdminHandlerRejectReturnRequiresJSONBody(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewAdminHandler(nil, &fakeOrderService{
		rejectReturnFn: func(string, string) (string, error) {
			t.Fatal("RejectReturn() should not be called on EOF body")
			return "", nil
		},
	})
	router := gin.New()
	router.POST("/admin/orders/:id/reject-return", handler.RejectReturn)

	req := httptest.NewRequest(http.MethodPost, "/admin/orders/order-1/reject-return", nil)
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusBadRequest)
	}
}

func TestAdminHandlerRejectCancellationRequiresJSONBody(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewAdminHandler(nil, &fakeOrderService{
		rejectCancellationFn: func(string, string) (string, error) {
			t.Fatal("RejectCancellation() should not be called on EOF body")
			return "", nil
		},
	})
	router := gin.New()
	router.POST("/admin/orders/:id/reject-cancel", handler.RejectCancellation)

	req := httptest.NewRequest(http.MethodPost, "/admin/orders/order-1/reject-cancel", nil)
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusBadRequest)
	}
}
