package config

import (
	"fmt"
	"os"
	"strings"
)

func RequiredSecret(key string, minLength int) (string, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return "", fmt.Errorf("%s is required", key)
	}
	if len(value) < minLength {
		return "", fmt.Errorf("%s must be at least %d characters", key, minLength)
	}
	return value, nil
}
