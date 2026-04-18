package config

import (
	"fmt"
	"log"
	"os"

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

	log.Println("Auto migrations completed successfully")
}
