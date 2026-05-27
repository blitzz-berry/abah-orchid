package appcache

import (
	"context"
	"encoding/json"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

const CatalogPrefix = "catalog:"

type Store interface {
	GetJSON(key string, target interface{}) bool
	SetJSON(key string, value interface{}, ttl time.Duration)
	DeletePrefix(prefix string)
}

type entry struct {
	data      []byte
	expiresAt time.Time
}

type store struct {
	mu           sync.RWMutex
	items        map[string]entry
	redis        *redis.Client
	redisRetryAt time.Time
	prefix       string
}

type noopStore struct{}

func Disabled() Store {
	return noopStore{}
}

func NewFromEnv() Store {
	s := &store{
		items:  make(map[string]entry),
		prefix: "orchidmart:",
	}
	host := strings.TrimSpace(os.Getenv("REDIS_HOST"))
	if host == "" {
		return s
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
	s.redis = redis.NewClient(&redis.Options{
		Addr:     host + ":" + port,
		Password: os.Getenv("REDIS_PASSWORD"),
		DB:       db,
	})
	return s
}

func NewMemory() Store {
	return &store{items: make(map[string]entry)}
}

func (s *store) GetJSON(key string, target interface{}) bool {
	if s.canTryRedis() {
		ctx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
		data, err := s.redis.Get(ctx, s.redisKey(key)).Bytes()
		cancel()
		if err == nil {
			return json.Unmarshal(data, target) == nil
		}
		if err == redis.Nil {
			return false
		}
		s.deferRedisRetry()
	}

	s.mu.RLock()
	item, ok := s.items[key]
	s.mu.RUnlock()
	if !ok {
		return false
	}
	if time.Now().After(item.expiresAt) {
		s.mu.Lock()
		delete(s.items, key)
		s.mu.Unlock()
		return false
	}
	return json.Unmarshal(item.data, target) == nil
}

func (s *store) SetJSON(key string, value interface{}, ttl time.Duration) {
	if ttl <= 0 {
		return
	}
	data, err := json.Marshal(value)
	if err != nil {
		return
	}

	s.mu.Lock()
	s.items[key] = entry{data: data, expiresAt: time.Now().Add(ttl)}
	s.mu.Unlock()

	if s.canTryRedis() {
		ctx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
		if err := s.redis.Set(ctx, s.redisKey(key), data, ttl).Err(); err != nil {
			s.deferRedisRetry()
		}
		cancel()
	}
}

func (s *store) DeletePrefix(prefix string) {
	s.mu.Lock()
	for key := range s.items {
		if strings.HasPrefix(key, prefix) {
			delete(s.items, key)
		}
	}
	s.mu.Unlock()

	if !s.canTryRedis() {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	var cursor uint64
	for {
		keys, next, err := s.redis.Scan(ctx, cursor, s.redisKey(prefix)+"*", 100).Result()
		if err != nil {
			s.deferRedisRetry()
			return
		}
		if len(keys) > 0 {
			if err := s.redis.Del(ctx, keys...).Err(); err != nil {
				s.deferRedisRetry()
				return
			}
		}
		cursor = next
		if cursor == 0 {
			return
		}
	}
}

func (s *store) redisKey(key string) string {
	return s.prefix + key
}

func (s *store) canTryRedis() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.redis != nil && !time.Now().Before(s.redisRetryAt)
}

func (s *store) deferRedisRetry() {
	s.mu.Lock()
	s.redisRetryAt = time.Now().Add(5 * time.Second)
	s.mu.Unlock()
}

func (noopStore) GetJSON(string, interface{}) bool           { return false }
func (noopStore) SetJSON(string, interface{}, time.Duration) {}
func (noopStore) DeletePrefix(string)                        {}
