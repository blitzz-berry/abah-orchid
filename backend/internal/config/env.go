package config

import (
	"bufio"
	"log"
	"os"
	"path/filepath"
	"strings"
)

func IsProduction() bool {
	env := strings.ToLower(os.Getenv("APP_ENV"))
	if env == "" {
		env = strings.ToLower(os.Getenv("ENV"))
	}
	return env == "production"
}

func LoadEnv() {
	for _, path := range candidateEnvPaths() {
		if loadEnvFile(path) {
			log.Printf("Environment loaded from %s", path)
			return
		}
	}
}

func candidateEnvPaths() []string {
	paths := []string{".env"}
	if wd, err := os.Getwd(); err == nil {
		paths = append(paths,
			filepath.Join(wd, ".env"),
			filepath.Join(wd, "backend", ".env"),
		)
	}
	return uniqueStrings(paths)
}

func loadEnvFile(path string) bool {
	file, err := os.Open(path)
	if err != nil {
		return false
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}

		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		if key == "" {
			continue
		}

		if _, exists := os.LookupEnv(key); !exists {
			_ = os.Setenv(key, value)
		}
	}

	return true
}

func uniqueStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}
