package handler

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"orchidmart-backend/internal/model"
	"orchidmart-backend/internal/service"
)

type fakeAuthService struct {
	loginWithGoogleFn      func(string) (*model.User, string, string, error)
	requestPasswordResetFn func(string) (*service.PasswordResetRequestResult, error)
	resetPasswordFn        func(string, string) error
}

func (f *fakeAuthService) Register(string, string, string, string) (*model.User, error) {
	return nil, errors.New("not implemented")
}

func (f *fakeAuthService) Login(string, string) (*model.User, string, string, error) {
	return nil, "", "", errors.New("not implemented")
}

func (f *fakeAuthService) LoginWithGoogle(token string) (*model.User, string, string, error) {
	return f.loginWithGoogleFn(token)
}

func (f *fakeAuthService) Refresh(string) (*model.User, string, string, error) {
	return nil, "", "", errors.New("not implemented")
}

func (f *fakeAuthService) Logout(string) error { return nil }

func (f *fakeAuthService) GetUserByID(string) (*model.User, error) {
	return nil, errors.New("not implemented")
}

func (f *fakeAuthService) UpdateProfile(string, string, string) (*model.User, error) {
	return nil, errors.New("not implemented")
}

func (f *fakeAuthService) GetAddresses(string) ([]model.Address, error) { return nil, nil }

func (f *fakeAuthService) CreateAddress(string, *model.Address) error { return nil }

func (f *fakeAuthService) UpdateAddress(string, string, *model.Address) (*model.Address, error) {
	return nil, nil
}

func (f *fakeAuthService) DeleteAddress(string, string) error { return nil }

func (f *fakeAuthService) SetDefaultAddress(string, string) error { return nil }

func (f *fakeAuthService) RequestPasswordReset(email string) (*service.PasswordResetRequestResult, error) {
	return f.requestPasswordResetFn(email)
}

func (f *fakeAuthService) ResetPassword(token, password string) error {
	return f.resetPasswordFn(token, password)
}

func TestAuthHandlerGoogleLoginRejectsInvalidJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)

	serviceStub := &fakeAuthService{
		loginWithGoogleFn: func(string) (*model.User, string, string, error) {
			t.Fatal("LoginWithGoogle() should not be called on invalid payload")
			return nil, "", "", nil
		},
		requestPasswordResetFn: func(string) (*service.PasswordResetRequestResult, error) { return nil, nil },
		resetPasswordFn:        func(string, string) error { return nil },
	}
	router := gin.New()
	router.POST("/auth/google", NewAuthHandler(serviceStub).GoogleLogin)

	req := httptest.NewRequest(http.MethodPost, "/auth/google", bytes.NewBufferString(`{"credential":`))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusBadRequest)
	}
	assertJSONErrorContains(t, recorder.Body.Bytes(), "Token Google tidak valid.")
}

func TestAuthHandlerGoogleLoginReturnsUnauthorizedWhenServiceFails(t *testing.T) {
	gin.SetMode(gin.TestMode)

	serviceStub := &fakeAuthService{
		loginWithGoogleFn: func(token string) (*model.User, string, string, error) {
			if token != "google-token" {
				t.Fatalf("LoginWithGoogle() token = %q, want google-token", token)
			}
			return nil, "", "", errors.New("audience token Google tidak sesuai")
		},
		requestPasswordResetFn: func(string) (*service.PasswordResetRequestResult, error) { return nil, nil },
		resetPasswordFn:        func(string, string) error { return nil },
	}
	router := gin.New()
	router.POST("/auth/google", NewAuthHandler(serviceStub).GoogleLogin)

	req := newJSONRequest(t, http.MethodPost, "/auth/google", map[string]string{"credential": "google-token"})
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusUnauthorized)
	}
	assertJSONErrorContains(t, recorder.Body.Bytes(), "audience token Google tidak sesuai")
}

func TestAuthHandlerGoogleLoginSetsRefreshCookieOnSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)

	now := time.Now()
	serviceStub := &fakeAuthService{
		loginWithGoogleFn: func(token string) (*model.User, string, string, error) {
			if token != "google-token" {
				t.Fatalf("LoginWithGoogle() token = %q, want google-token", token)
			}
			return &model.User{
				ID:        uuid.New(),
				Email:     "buyer@example.com",
				FullName:  "Buyer",
				Phone:     "08123",
				Role:      "customer",
				CreatedAt: now,
			}, "access-123", "refresh-123", nil
		},
		requestPasswordResetFn: func(string) (*service.PasswordResetRequestResult, error) { return nil, nil },
		resetPasswordFn:        func(string, string) error { return nil },
	}
	router := gin.New()
	router.POST("/auth/google", NewAuthHandler(serviceStub).GoogleLogin)

	req := newJSONRequest(t, http.MethodPost, "/auth/google", map[string]string{"credential": "google-token"})
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	if setCookie := recorder.Header().Get("Set-Cookie"); setCookie == "" || !bytes.Contains([]byte(setCookie), []byte(refreshTokenCookieName+"=refresh-123")) {
		t.Fatalf("Set-Cookie = %q, want refresh token cookie", setCookie)
	}
}

func TestAuthHandlerForgotPasswordReturnsResetURLOutsideProduction(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("APP_ENV", "development")

	serviceStub := &fakeAuthService{
		loginWithGoogleFn: func(string) (*model.User, string, string, error) { return nil, "", "", nil },
		requestPasswordResetFn: func(email string) (*service.PasswordResetRequestResult, error) {
			if email != "buyer@example.com" {
				t.Fatalf("RequestPasswordReset() email = %q, want buyer@example.com", email)
			}
			return &service.PasswordResetRequestResult{
				EmailSent: false,
				ResetURL:  "https://orchidmart.test/reset-password?token=abc",
			}, nil
		},
		resetPasswordFn: func(string, string) error { return nil },
	}
	router := gin.New()
	router.POST("/auth/forgot-password", NewAuthHandler(serviceStub).ForgotPassword)

	req := newJSONRequest(t, http.MethodPost, "/auth/forgot-password", map[string]string{"email": "buyer@example.com"})
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	assertJSONFieldEquals(t, recorder.Body.Bytes(), "data.reset_url", "https://orchidmart.test/reset-password?token=abc")
}

func TestAuthHandlerForgotPasswordHidesResetURLInProduction(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("APP_ENV", "production")

	serviceStub := &fakeAuthService{
		loginWithGoogleFn: func(string) (*model.User, string, string, error) { return nil, "", "", nil },
		requestPasswordResetFn: func(string) (*service.PasswordResetRequestResult, error) {
			return &service.PasswordResetRequestResult{
				EmailSent: false,
				ResetURL:  "https://orchidmart.test/reset-password?token=abc",
			}, nil
		},
		resetPasswordFn: func(string, string) error { return nil },
	}
	router := gin.New()
	router.POST("/auth/forgot-password", NewAuthHandler(serviceStub).ForgotPassword)

	req := newJSONRequest(t, http.MethodPost, "/auth/forgot-password", map[string]string{"email": "buyer@example.com"})
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}

	var payload map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}
	data, _ := payload["data"].(map[string]any)
	if _, exists := data["reset_url"]; exists {
		t.Fatalf("reset_url should be hidden in production payload: %v", data)
	}
}

func TestAuthHandlerResetPasswordRejectsShortPassword(t *testing.T) {
	gin.SetMode(gin.TestMode)

	serviceStub := &fakeAuthService{
		loginWithGoogleFn:      func(string) (*model.User, string, string, error) { return nil, "", "", nil },
		requestPasswordResetFn: func(string) (*service.PasswordResetRequestResult, error) { return nil, nil },
		resetPasswordFn: func(string, string) error {
			t.Fatal("ResetPassword() should not be called when payload validation fails")
			return nil
		},
	}
	router := gin.New()
	router.POST("/auth/reset-password", NewAuthHandler(serviceStub).ResetPassword)

	req := newJSONRequest(t, http.MethodPost, "/auth/reset-password", map[string]string{"token": "abc", "password": "short"})
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusBadRequest)
	}
}

func TestAuthHandlerResetPasswordReturnsBadRequestOnServiceError(t *testing.T) {
	gin.SetMode(gin.TestMode)

	serviceStub := &fakeAuthService{
		loginWithGoogleFn:      func(string) (*model.User, string, string, error) { return nil, "", "", nil },
		requestPasswordResetFn: func(string) (*service.PasswordResetRequestResult, error) { return nil, nil },
		resetPasswordFn: func(token, password string) error {
			if token != "abc" || password != "password123" {
				t.Fatalf("ResetPassword() args = %q %q", token, password)
			}
			return errors.New("reset token is invalid or expired")
		},
	}
	router := gin.New()
	router.POST("/auth/reset-password", NewAuthHandler(serviceStub).ResetPassword)

	req := newJSONRequest(t, http.MethodPost, "/auth/reset-password", map[string]string{"token": "abc", "password": "password123"})
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusBadRequest)
	}
	assertJSONErrorContains(t, recorder.Body.Bytes(), "reset token is invalid or expired")
}

func newJSONRequest(t *testing.T, method, path string, payload any) *http.Request {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("Marshal() error = %v", err)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	return req
}

func assertJSONErrorContains(t *testing.T, body []byte, want string) {
	t.Helper()
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}
	got, _ := payload["error"].(string)
	if got != want {
		t.Fatalf("error = %q, want %q", got, want)
	}
}

func assertJSONFieldEquals(t *testing.T, body []byte, path string, want string) {
	t.Helper()
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}

	current := any(payload)
	for _, part := range bytes.Split([]byte(path), []byte(".")) {
		asMap, ok := current.(map[string]any)
		if !ok {
			t.Fatalf("field path %q missing in payload %v", path, payload)
		}
		current = asMap[string(part)]
	}

	got, _ := current.(string)
	if got != want {
		t.Fatalf("%s = %q, want %q", path, got, want)
	}
}
