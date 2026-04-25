package config

import (
	"fmt"
	"log"
	"os"

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
		password = "secretpassword"
		dbname = "orchidmart"
	}

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Jakarta",
		host, user, password, dbname, port)

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
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
	)

	if err != nil {
		log.Fatalf("Failed to auto-migrate. \nError: %v", err)
	}

	ensureDefaultAdmin()
	log.Println("Auto migrations completed successfully")
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
			CustomerType: "B2B",
			IsActive:     true,
		}

		if createErr := DB.Create(&admin).Error; createErr != nil {
			log.Fatalf("Failed to create default admin. \nError: %v", createErr)
		}

		log.Printf("Default admin created: %s / %s", adminEmail, adminPassword)
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
	if user.CustomerType != "B2B" {
		updates["customer_type"] = "B2B"
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
}

func looksLikeBcryptHash(value string) bool {
	return len(value) >= 4 && (value[:4] == "$2a$" || value[:4] == "$2b$" || value[:4] == "$2y$")
}
