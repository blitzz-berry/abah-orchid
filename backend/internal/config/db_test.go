package config

import (
	"strings"
	"testing"

	"gorm.io/gorm/logger"
)

func TestDatabaseLogLevelDefaultsToWarnInProduction(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DB_LOG_LEVEL", "")

	if got := databaseLogLevel(); got != logger.Warn {
		t.Fatalf("databaseLogLevel() = %v, want %v", got, logger.Warn)
	}
}

func TestDatabaseLogLevelDefaultsToInfoOutsideProduction(t *testing.T) {
	t.Setenv("APP_ENV", "")
	t.Setenv("ENV", "")
	t.Setenv("DB_LOG_LEVEL", "")

	if got := databaseLogLevel(); got != logger.Info {
		t.Fatalf("databaseLogLevel() = %v, want %v", got, logger.Info)
	}
}

func TestDatabaseLogLevelSupportsExplicitSafeLevels(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DB_LOG_LEVEL", "error")

	if got := databaseLogLevel(); got != logger.Error {
		t.Fatalf("databaseLogLevel() = %v, want %v", got, logger.Error)
	}
}

func TestDatabaseLogLevelFallsBackSafely(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DB_LOG_LEVEL", "verbose")

	if got := databaseLogLevel(); got != logger.Warn {
		t.Fatalf("databaseLogLevel() = %v, want %v", got, logger.Warn)
	}
}

func TestDatabaseSSLModeDefaultsToDisableOutsideProduction(t *testing.T) {
	t.Setenv("APP_ENV", "")
	t.Setenv("ENV", "")
	t.Setenv("DB_SSLMODE", "")

	got, err := databaseSSLMode("localhost")
	if err != nil {
		t.Fatalf("databaseSSLMode() error = %v", err)
	}
	if got != "disable" {
		t.Fatalf("databaseSSLMode() = %q, want disable", got)
	}
}

func TestDatabaseSSLModeRequiredInProduction(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DB_SSLMODE", "")

	if _, err := databaseSSLMode("postgres"); err == nil {
		t.Fatal("databaseSSLMode() error = nil, want error")
	}
}

func TestDatabaseSSLModeRejectsInvalidValue(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DB_SSLMODE", "off")

	if _, err := databaseSSLMode("postgres"); err == nil {
		t.Fatal("databaseSSLMode() error = nil, want error")
	}
}

func TestDatabaseSSLModeAllowsDisableForPrivateProductionHost(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DB_SSLMODE", "disable")

	got, err := databaseSSLMode("postgres")
	if err != nil {
		t.Fatalf("databaseSSLMode() error = %v", err)
	}
	if got != "disable" {
		t.Fatalf("databaseSSLMode() = %q, want disable", got)
	}
}

func TestDatabaseSSLModeRejectsDisableForExternalProductionHost(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DB_SSLMODE", "disable")

	if _, err := databaseSSLMode("db.example.com"); err == nil {
		t.Fatal("databaseSSLMode() error = nil, want error")
	}
}

func TestPostgresDSNIncludesTLSOptions(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DB_SSLMODE", "verify-full")
	t.Setenv("DB_SSLROOTCERT", "/etc/ssl/db-ca.pem")

	dsn, err := postgresDSN("db.example.com", "5432", "orchidmart", "secret", "orchidmart")
	if err != nil {
		t.Fatalf("postgresDSN() error = %v", err)
	}
	for _, want := range []string{"sslmode=verify-full", "sslrootcert=/etc/ssl/db-ca.pem"} {
		if !strings.Contains(dsn, want) {
			t.Fatalf("postgresDSN() = %q, want it to contain %q", dsn, want)
		}
	}
}
