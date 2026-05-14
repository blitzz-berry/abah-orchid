package middleware

import (
	"context"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

type rateBucket struct {
	count    int
	resetAt  time.Time
	lastSeen time.Time
}

var (
	rateBuckets = map[string]*rateBucket{}
	rateMu      sync.Mutex
	redisOnce   sync.Once
	redisClient *redis.Client
)

func RateLimit(limit int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		if limit <= 0 {
			c.Next()
			return
		}

		key := c.ClientIP() + ":" + c.FullPath()
		if allowed, retryAfter, ok := allowWithRedis(key, limit, window); ok {
			if !allowed {
				c.Header("Retry-After", retryAfter.Round(time.Second).String())
				c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
				return
			}
			c.Next()
			return
		}

		now := time.Now()
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

func allowWithRedis(key string, limit int, window time.Duration) (bool, time.Duration, bool) {
	client := rateRedisClient()
	if client == nil {
		return false, 0, false
	}

	ctx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
	defer cancel()

	redisKey := "rate_limit:" + key
	count, err := client.Incr(ctx, redisKey).Result()
	if err != nil {
		return false, 0, false
	}
	if count == 1 {
		if err := client.Expire(ctx, redisKey, window).Err(); err != nil {
			return false, 0, false
		}
	}

	if count <= int64(limit) {
		return true, 0, true
	}
	ttl, err := client.TTL(ctx, redisKey).Result()
	if err != nil || ttl <= 0 {
		ttl = window
	}
	return false, ttl, true
}

func rateRedisClient() *redis.Client {
	redisOnce.Do(func() {
		host := strings.TrimSpace(os.Getenv("REDIS_HOST"))
		if host == "" {
			return
		}
		port := strings.TrimSpace(os.Getenv("REDIS_PORT"))
		if port == "" {
			port = "6379"
		}
		db := 0
		if rawDB := strings.TrimSpace(os.Getenv("REDIS_DB")); rawDB != "" {
			if parsed, err := strconv.Atoi(rawDB); err == nil && parsed >= 0 {
				db = parsed
			}
		}
		redisClient = redis.NewClient(&redis.Options{
			Addr:     host + ":" + port,
			Password: os.Getenv("REDIS_PASSWORD"),
			DB:       db,
		})
	})
	return redisClient
}

func cleanupRateBuckets(now time.Time) {
	for key, bucket := range rateBuckets {
		if now.Sub(bucket.lastSeen) > 30*time.Minute {
			delete(rateBuckets, key)
		}
	}
}
