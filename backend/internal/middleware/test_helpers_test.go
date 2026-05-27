package middleware

import (
	"encoding/json"
	"net/http/httptest"
	"testing"
)

func assertMiddlewareError(t *testing.T, recorder *httptest.ResponseRecorder, want string) {
	t.Helper()

	var payload map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}
	got, _ := payload["error"].(string)
	if got != want {
		t.Fatalf("error = %q, want %q", got, want)
	}
}
