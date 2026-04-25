package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type rateBucket struct {
	count    int
	resetAt  time.Time
	lastSeen time.Time
}

var (
	rateBuckets = map[string]*rateBucket{}
	rateMu      sync.Mutex
)

func RateLimit(limit int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		if limit <= 0 {
			c.Next()
			return
		}

		now := time.Now()
		key := c.ClientIP() + ":" + c.FullPath()

		rateMu.Lock()
		cleanupRateBuckets(now)
		bucket, ok := rateBuckets[key]
		if !ok || now.After(bucket.resetAt) {
			bucket = &rateBucket{resetAt: now.Add(window)}
			rateBuckets[key] = bucket
		}
		bucket.count++
		bucket.lastSeen = now
		allowed := bucket.count <= limit
		resetAt := bucket.resetAt
		rateMu.Unlock()

		if !allowed {
			c.Header("Retry-After", resetAt.Sub(now).Round(time.Second).String())
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
			return
		}

		c.Next()
	}
}

func cleanupRateBuckets(now time.Time) {
	for key, bucket := range rateBuckets {
		if now.Sub(bucket.lastSeen) > 30*time.Minute {
			delete(rateBuckets, key)
		}
	}
}
