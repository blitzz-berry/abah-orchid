package config

import (
	"reflect"
	"testing"
)

func TestCORSAllowedOriginsUsesDevelopmentDefault(t *testing.T) {
	t.Setenv("APP_ENV", "")
	t.Setenv("ENV", "")
	t.Setenv("CORS_ALLOWED_ORIGINS", "")

	origins, err := CORSAllowedOrigins()
	if err != nil {
		t.Fatalf("CORSAllowedOrigins() error = %v", err)
	}

	want := []string{"http://localhost:3000"}
	if !reflect.DeepEqual(origins, want) {
		t.Fatalf("CORSAllowedOrigins() = %v, want %v", origins, want)
	}
}

func TestCORSAllowedOriginsRequiresProductionValue(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("CORS_ALLOWED_ORIGINS", "")

	if _, err := CORSAllowedOrigins(); err == nil {
		t.Fatal("CORSAllowedOrigins() error = nil, want error")
	}
}

func TestCORSAllowedOriginsRejectsWildcards(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://*.example.com")

	if _, err := CORSAllowedOrigins(); err == nil {
		t.Fatal("CORSAllowedOrigins() error = nil, want error")
	}
}

func TestCORSAllowedOriginsRequiresHTTPSInProduction(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("CORS_ALLOWED_ORIGINS", "http://orchidmart.example.com")

	if _, err := CORSAllowedOrigins(); err == nil {
		t.Fatal("CORSAllowedOrigins() error = nil, want error")
	}
}

func TestCORSAllowedOriginsTrimsAndDeduplicates(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("CORS_ALLOWED_ORIGINS", " https://orchidmart.example.com,https://admin.orchidmart.example.com,https://orchidmart.example.com ")

	origins, err := CORSAllowedOrigins()
	if err != nil {
		t.Fatalf("CORSAllowedOrigins() error = %v", err)
	}

	want := []string{"https://orchidmart.example.com", "https://admin.orchidmart.example.com"}
	if !reflect.DeepEqual(origins, want) {
		t.Fatalf("CORSAllowedOrigins() = %v, want %v", origins, want)
	}
}
