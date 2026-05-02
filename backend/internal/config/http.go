package config

import (
	"log"
	"net/http"
	"os"
	"strconv"
	"time"
)

type HTTPServerConfig struct {
	ReadHeaderTimeout time.Duration
	ReadTimeout       time.Duration
	WriteTimeout      time.Duration
	IdleTimeout       time.Duration
	MaxHeaderBytes    int
}

func HTTPServer() HTTPServerConfig {
	return HTTPServerConfig{
		ReadHeaderTimeout: durationEnv("HTTP_READ_HEADER_TIMEOUT", 5*time.Second),
		ReadTimeout:       durationEnv("HTTP_READ_TIMEOUT", 15*time.Second),
		WriteTimeout:      durationEnv("HTTP_WRITE_TIMEOUT", 30*time.Second),
		IdleTimeout:       durationEnv("HTTP_IDLE_TIMEOUT", 60*time.Second),
		MaxHeaderBytes:    intEnv("HTTP_MAX_HEADER_BYTES", 1<<20),
	}
}

func NewHTTPServer(addr string, handler http.Handler) *http.Server {
	cfg := HTTPServer()
	return &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: cfg.ReadHeaderTimeout,
		ReadTimeout:       cfg.ReadTimeout,
		WriteTimeout:      cfg.WriteTimeout,
		IdleTimeout:       cfg.IdleTimeout,
		MaxHeaderBytes:    cfg.MaxHeaderBytes,
	}
}

func durationEnv(key string, fallback time.Duration) time.Duration {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	duration, err := time.ParseDuration(value)
	if err != nil || duration <= 0 {
		log.Printf("Invalid %s=%q; using %s", key, value, fallback)
		return fallback
	}
	return duration
}

func intEnv(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		log.Printf("Invalid %s=%q; using %d", key, value, fallback)
		return fallback
	}
	return parsed
}
