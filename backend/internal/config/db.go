package config

import (
	"fmt"
	"log"
	"net"
	"os"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"orchidmart-backend/internal/model"
)

var DB *gorm.DB

func InitDB() {
	// Construct DSN from environment variables
	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	dbname := os.Getenv("DB_NAME")

	// Default fallback for development
	if host == "" {
		host = "localhost"
		port = "5432"
		user = "orchidmart"
		password = ""
		dbname = "orchidmart"
	}

	dsn, err := postgresDSN(host, port, user, password, dbname)
	if err != nil {
		log.Fatalf("Invalid database configuration: %v", err)
	}

	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: newGORMLogger(),
	})

	if err != nil {
		log.Fatalf("Failed to connect to database. \nError: %v", err)
	}

	log.Println("Database connection established")

	// Enable uuid-ossp extension in PostgreSQL if not exists
	DB.Exec(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`)
	DB.Exec(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`)

	log.Println("Running Auto migrations...")
	err = DB.AutoMigrate(
		&model.User{},
		&model.RefreshToken{},
		&model.PasswordReset{},
		&model.Address{},

		&model.Category{},
		&model.Product{},
		&model.ProductImage{},
		&model.Inventory{},
		&model.StockMovement{},
		&model.Wishlist{},

		&model.Cart{},
		&model.CartItem{},

		&model.Order{},
		&model.OrderItem{},
		&model.OrderStatusHistory{},
		&model.Payment{},

		&model.Review{},
		&model.Coupon{},
		&model.Notification{},
		&model.AdminActivityLog{},
		&model.Promotion{},
	)

	if err != nil {
		log.Fatalf("Failed to auto-migrate. \nError: %v", err)
	}

	dropLegacyCustomerTypeColumn()
	ensureDefaultAdmin()
	log.Println("Auto migrations completed successfully")
}

func dropLegacyCustomerTypeColumn() {
	if DB == nil {
		return
	}
	if !DB.Migrator().HasColumn(&model.User{}, "customer_type") {
		return
	}
	if err := DB.Migrator().DropColumn(&model.User{}, "customer_type"); err != nil {
		log.Printf("Failed to drop legacy users.customer_type column: %v", err)
		return
	}
	log.Println("Dropped legacy users.customer_type column")
}

func postgresDSN(host, port, user, password, dbname string) (string, error) {
	sslmode, err := databaseSSLMode(host)
	if err != nil {
		return "", err
	}

	parts := []string{
		fmt.Sprintf("host=%s", host),
		fmt.Sprintf("user=%s", user),
		fmt.Sprintf("password=%s", password),
		fmt.Sprintf("dbname=%s", dbname),
		fmt.Sprintf("port=%s", port),
		fmt.Sprintf("sslmode=%s", sslmode),
		"TimeZone=Asia/Jakarta",
	}
	if sslRootCert := strings.TrimSpace(os.Getenv("DB_SSLROOTCERT")); sslRootCert != "" {
		parts = append(parts, fmt.Sprintf("sslrootcert=%s", sslRootCert))
	}
	if sslCert := strings.TrimSpace(os.Getenv("DB_SSLCERT")); sslCert != "" {
		parts = append(parts, fmt.Sprintf("sslcert=%s", sslCert))
	}
	if sslKey := strings.TrimSpace(os.Getenv("DB_SSLKEY")); sslKey != "" {
		parts = append(parts, fmt.Sprintf("sslkey=%s", sslKey))
	}
	return strings.Join(parts, " "), nil
}

func databaseSSLMode(host string) (string, error) {
	sslmode := strings.ToLower(strings.TrimSpace(os.Getenv("DB_SSLMODE")))
	if sslmode == "" {
		if IsProduction() {
			return "", fmt.Errorf("DB_SSLMODE is required in production; use verify-full/require for external DBs or explicit disable only for private Docker networks")
		}
		return "disable", nil
	}

	switch sslmode {
	case "disable", "allow", "prefer", "require", "verify-ca", "verify-full":
	default:
		return "", fmt.Errorf("DB_SSLMODE must be one of disable, allow, prefer, require, verify-ca, verify-full")
	}

	if IsProduction() && sslmode == "disable" && !isPrivateDatabaseHost(host) && os.Getenv("DB_ALLOW_INSECURE_TLS") != "true" {
		return "", fmt.Errorf("DB_SSLMODE=disable is only allowed for local/private DB hosts in production; set DB_SSLMODE=require or verify-full for external DBs")
	}
	return sslmode, nil
}

func isPrivateDatabaseHost(host string) bool {
	host = strings.Trim(strings.ToLower(host), "[]")
	if host == "" || host == "localhost" || host == "postgres" || host == "db" || strings.HasSuffix(host, ".local") {
		return true
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	return ip.IsLoopback() || ip.IsPrivate()
}

func newGORMLogger() logger.Interface {
	return logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             200 * time.Millisecond,
			LogLevel:                  databaseLogLevel(),
			IgnoreRecordNotFoundError: true,
			Colorful:                  !IsProduction(),
			ParameterizedQueries:      true,
		},
	)
}

func databaseLogLevel() logger.LogLevel {
	level := strings.ToLower(strings.TrimSpace(os.Getenv("DB_LOG_LEVEL")))
	if level == "" {
		if IsProduction() {
			return logger.Warn
		}
		return logger.Info
	}

	switch level {
	case "silent":
		return logger.Silent
	case "error":
		return logger.Error
	case "warn", "warning":
		return logger.Warn
	case "info", "debug":
		return logger.Info
	default:
		log.Printf("Invalid DB_LOG_LEVEL=%q; using safe default", level)
		if IsProduction() {
			return logger.Warn
		}
		return logger.Info
	}
}

func ensureDefaultAdmin() {
	adminEmail, _ := os.LookupEnv("ADMIN_EMAIL")
	if adminEmail == "" {
		adminEmail = "admin@orchidmart.local"
	}

	adminPassword, hasAdminPassword := os.LookupEnv("ADMIN_PASSWORD")
	if adminPassword == "" {
		if IsProduction() {
			log.Fatal("ADMIN_PASSWORD is required in production")
		}
		adminPassword = "Admin123!"
	}

	adminName, hasAdminName := os.LookupEnv("ADMIN_NAME")
	if adminName == "" {
		adminName = "OrchidMart Admin"
	}

	var user model.User
	err := DB.Where("email = ?", adminEmail).First(&user).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		log.Fatalf("Failed to check default admin. \nError: %v", err)
	}

	hashedPassword, hashErr := bcrypt.GenerateFromPassword([]byte(adminPassword), 12)
	if hashErr != nil {
		log.Fatalf("Failed to hash default admin password. \nError: %v", hashErr)
	}

	if err == gorm.ErrRecordNotFound {
		admin := model.User{
			Email:        adminEmail,
			PasswordHash: string(hashedPassword),
			FullName:     adminName,
			Role:         "admin",
			IsActive:     true,
		}

		if createErr := DB.Create(&admin).Error; createErr != nil {
			log.Fatalf("Failed to create default admin. \nError: %v", createErr)
		}

		log.Printf("Default admin created: %s", adminEmail)
		enforceExclusiveAdmin(adminEmail)
		return
	}

	updates := map[string]any{}
	needsUpdate := false

	if user.Role != "admin" {
		updates["role"] = "admin"
		needsUpdate = true
	}
	if !user.IsActive {
		updates["is_active"] = true
		needsUpdate = true
	}
	if hasAdminName && user.FullName != adminName {
		updates["full_name"] = adminName
		needsUpdate = true
	}

	if hasAdminPassword || !looksLikeBcryptHash(user.PasswordHash) {
		updates["password_hash"] = string(hashedPassword)
		needsUpdate = true
		log.Printf("Default admin password reset for %s", adminEmail)
	}

	if needsUpdate {
		if updateErr := DB.Model(&model.User{}).Where("id = ?", user.ID).Updates(updates).Error; updateErr != nil {
			log.Fatalf("Failed to update default admin. \nError: %v", updateErr)
		}
	}

	enforceExclusiveAdmin(adminEmail)
}

func enforceExclusiveAdmin(adminEmail string) {
	if !strings.EqualFold(strings.TrimSpace(os.Getenv("ADMIN_EXCLUSIVE")), "true") {
		return
	}

	adminEmail = strings.ToLower(strings.TrimSpace(adminEmail))
	if adminEmail == "" {
		return
	}

	var oldAdmins []model.User
	if err := DB.Where("role = ? AND LOWER(email) <> ?", "admin", adminEmail).Find(&oldAdmins).Error; err != nil {
		log.Fatalf("Failed to check old admin accounts. \nError: %v", err)
	}
	if len(oldAdmins) == 0 {
		return
	}

	oldAdminIDs := make([]string, 0, len(oldAdmins))
	for _, oldAdmin := range oldAdmins {
		oldAdminIDs = append(oldAdminIDs, oldAdmin.ID.String())
	}

	if err := DB.Model(&model.User{}).
		Where("id IN ?", oldAdminIDs).
		Updates(map[string]any{
			"role": "customer",
		}).Error; err != nil {
		log.Fatalf("Failed to demote old admin accounts. \nError: %v", err)
	}

	if err := DB.Model(&model.RefreshToken{}).
		Where("user_id IN ?", oldAdminIDs).
		Update("is_revoked", true).Error; err != nil {
		log.Fatalf("Failed to revoke old admin sessions. \nError: %v", err)
	}

	log.Printf("Demoted %d old admin account(s); ADMIN_EXCLUSIVE=true keeps %s as the only admin", len(oldAdmins), adminEmail)
}

func looksLikeBcryptHash(value string) bool {
	return len(value) >= 4 && (value[:4] == "$2a$" || value[:4] == "$2b$" || value[:4] == "$2y$")
}
