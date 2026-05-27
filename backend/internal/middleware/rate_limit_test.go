package middleware

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestRateLimitBlocksRequestsOverLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	resetRateLimiterState()

	router := gin.New()
	router.GET("/limited", RateLimit(1, time.Minute), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	firstReq := httptest.NewRequest(http.MethodGet, "/limited", nil)
	firstReq.RemoteAddr = "198.51.100.10:1234"
	firstRecorder := httptest.NewRecorder()
	router.ServeHTTP(firstRecorder, firstReq)

	if firstRecorder.Code != http.StatusOK {
		t.Fatalf("first status = %d, want %d", firstRecorder.Code, http.StatusOK)
	}

	secondReq := httptest.NewRequest(http.MethodGet, "/limited", nil)
	secondReq.RemoteAddr = "198.51.100.10:1234"
	secondRecorder := httptest.NewRecorder()
	router.ServeHTTP(secondRecorder, secondReq)

	if secondRecorder.Code != http.StatusTooManyRequests {
		t.Fatalf("second status = %d, want %d", secondRecorder.Code, http.StatusTooManyRequests)
	}
	assertMiddlewareError(t, secondRecorder, "rate limit exceeded")
	if secondRecorder.Header().Get("Retry-After") == "" {
		t.Fatal("Retry-After header should be set when request is rate limited")
	}
}

func TestRateLimitUsesSeparateBucketPerPath(t *testing.T) {
	gin.SetMode(gin.TestMode)
	resetRateLimiterState()

	router := gin.New()
	router.GET("/limited-a", RateLimit(1, time.Minute), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	router.GET("/limited-b", RateLimit(1, time.Minute), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	reqA := httptest.NewRequest(http.MethodGet, "/limited-a", nil)
	reqA.RemoteAddr = "198.51.100.20:4444"
	recA := httptest.NewRecorder()
	router.ServeHTTP(recA, reqA)

	reqB := httptest.NewRequest(http.MethodGet, "/limited-b", nil)
	reqB.RemoteAddr = "198.51.100.20:4444"
	recB := httptest.NewRecorder()
	router.ServeHTTP(recB, reqB)

	if recA.Code != http.StatusOK || recB.Code != http.StatusOK {
		t.Fatalf("statuses = %d and %d, want both 200", recA.Code, recB.Code)
	}
}

func TestCleanupRateBucketsRemovesStaleEntries(t *testing.T) {
	resetRateLimiterState()

	now := time.Now()
	rateBuckets["stale"] = &rateBucket{
		count:    5,
		resetAt:  now.Add(-time.Minute),
		lastSeen: now.Add(-31 * time.Minute),
	}
	rateBuckets["fresh"] = &rateBucket{
		count:    1,
		resetAt:  now.Add(time.Minute),
		lastSeen: now.Add(-5 * time.Minute),
	}

	cleanupRateBuckets(now)

	if _, ok := rateBuckets["stale"]; ok {
		t.Fatal("stale bucket should be deleted")
	}
	if _, ok := rateBuckets["fresh"]; !ok {
		t.Fatal("fresh bucket should remain")
	}
}

func resetRateLimiterState() {
	rateMu.Lock()
	defer rateMu.Unlock()
	rateBuckets = map[string]*rateBucket{}
	redisClient = nil
	redisOnce = sync.Once{}
}
