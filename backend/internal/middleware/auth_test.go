package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func TestAuthMiddlewareRequiresAuthorizationHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("JWT_SECRET", uuid.NewString()+uuid.NewString())

	router := gin.New()
	router.GET("/protected", AuthMiddleware(), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusUnauthorized)
	}
	assertMiddlewareError(t, recorder, "Authorization header is required")
}

func TestAuthMiddlewareRejectsInvalidBearerFormat(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("JWT_SECRET", uuid.NewString()+uuid.NewString())

	router := gin.New()
	router.GET("/protected", AuthMiddleware(), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Token abc")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusUnauthorized)
	}
	assertMiddlewareError(t, recorder, "Invalid token format")
}

func TestAuthMiddlewareSetsUserContextOnValidToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	secret := uuid.NewString() + uuid.NewString()
	t.Setenv("JWT_SECRET", secret)

	token := mustSignMiddlewareToken(t, secret, "user-1", "admin", time.Now().Unix())

	router := gin.New()
	router.GET("/protected", AuthMiddleware(), func(c *gin.Context) {
		if c.GetString("userID") != "user-1" {
			t.Fatalf("userID = %q, want user-1", c.GetString("userID"))
		}
		if c.GetString("userRole") != "admin" {
			t.Fatalf("userRole = %q, want admin", c.GetString("userRole"))
		}
		if c.GetInt64("tokenIssuedAt") <= 0 {
			t.Fatal("tokenIssuedAt was not set")
		}
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
}

func TestAdminMiddlewareRejectsNonAdmin(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.GET("/admin", func(c *gin.Context) {
		c.Set("userRole", "customer")
		AdminMiddleware()(c)
	}, func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusForbidden)
	}
	assertMiddlewareError(t, recorder, "Admin access required")
}

func TestCustomerMiddlewareRejectsAdmin(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.GET("/cart", func(c *gin.Context) {
		c.Set("userRole", "admin")
		CustomerMiddleware()(c)
	}, func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/cart", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusForbidden)
	}
	assertMiddlewareError(t, recorder, "Customer access required")
}

func TestCustomerMiddlewareAllowsCustomer(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.GET("/cart", func(c *gin.Context) {
		c.Set("userRole", "customer")
		CustomerMiddleware()(c)
	}, func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/cart", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
}

func TestAdminIPAllowlistRejectsIPOutsideAllowlist(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("ADMIN_IP_ALLOWLIST", "10.0.0.1,192.168.1.0/24")

	router := gin.New()
	router.GET("/admin", AdminIPAllowlist(), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	req.RemoteAddr = "203.0.113.10:1234"
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusForbidden)
	}
	assertMiddlewareError(t, recorder, "admin IP is not allowed")
}

func TestAdminIPAllowlistAllowsCIDRMatch(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("ADMIN_IP_ALLOWLIST", "10.0.0.1,192.168.1.0/24")

	router := gin.New()
	router.GET("/admin", AdminIPAllowlist(), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	req.RemoteAddr = "192.168.1.44:5555"
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
}

func TestRequireAdminStepUpRejectsMissingConfirmationHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.POST("/admin/action", func(c *gin.Context) {
		c.Set("tokenIssuedAt", time.Now().Unix())
		RequireAdminStepUp("refund_order")(c)
	}, func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/action", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusForbidden)
	}
	assertMiddlewareError(t, recorder, "admin step-up confirmation required")
}

func TestRequireAdminStepUpRejectsStaleSession(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("ADMIN_STEP_UP_MAX_AGE", "10m")

	router := gin.New()
	router.POST("/admin/action", func(c *gin.Context) {
		c.Set("tokenIssuedAt", time.Now().Add(-11*time.Minute).Unix())
		RequireAdminStepUp("refund_order")(c)
	}, func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/action", nil)
	req.Header.Set("X-Admin-Step-Up", "confirm")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusForbidden)
	}
	assertMiddlewareError(t, recorder, "fresh admin session required")
}

func TestRequireAdminStepUpAllowsFreshConfirmedSession(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("ADMIN_STEP_UP_MAX_AGE", "10m")

	router := gin.New()
	router.POST("/admin/action", func(c *gin.Context) {
		c.Set("tokenIssuedAt", time.Now().Add(-2*time.Minute).Unix())
		RequireAdminStepUp("refund_order")(c)
	}, func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/action", nil)
	req.Header.Set("X-Admin-Step-Up", "confirm")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
}

func mustSignMiddlewareToken(t *testing.T, secret, sub, role string, iat int64) string {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  sub,
		"role": role,
		"iat":  iat,
		"exp":  time.Now().Add(time.Hour).Unix(),
	})
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("SignedString() error = %v", err)
	}
	return signed
}
