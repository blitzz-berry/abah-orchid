package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID            uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Email         string         `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	PasswordHash  string         `gorm:"type:varchar(255);not null" json:"-"`
	FullName      string         `gorm:"type:varchar(255);not null" json:"full_name"`
	Phone         string         `gorm:"type:varchar(20)" json:"phone"`
	Role          string         `gorm:"type:varchar(20);default:'customer'" json:"role"`
	CustomerType  string         `gorm:"type:varchar(10);default:'B2C'" json:"customer_type"`
	IsActive      bool           `gorm:"default:true" json:"is_active"`
	AvatarURL     string         `gorm:"type:varchar(500)" json:"avatar_url"`
	LastLoginAt   *time.Time     `json:"last_login_at"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
	
	Addresses     []Address       `gorm:"foreignKey:UserID" json:"addresses,omitempty"`
	RefreshTokens []RefreshToken  `gorm:"foreignKey:UserID" json:"-"`
}

type RefreshToken struct {
	ID         uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	UserID     uuid.UUID `gorm:"type:uuid;index;not null"`
	Token      string    `gorm:"type:varchar(255);uniqueIndex;not null"`
	IPAddress  string    `gorm:"type:varchar(50)"`
	UserAgent  string    `gorm:"type:text"`
	IsRevoked  bool      `gorm:"default:false"`
	ExpiresAt  time.Time `gorm:"not null"`
	CreatedAt  time.Time
}

type PasswordReset struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	UserID    uuid.UUID `gorm:"type:uuid;index;not null"`
	Token     string    `gorm:"type:varchar(255);uniqueIndex;not null"`
	IsUsed    bool      `gorm:"default:false"`
	ExpiresAt time.Time `gorm:"not null"`
	CreatedAt time.Time
}

type Address struct {
	ID             uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID         uuid.UUID `gorm:"type:uuid;index;not null" json:"user_id"`
	Label          string    `gorm:"type:varchar(50)" json:"label"`
	RecipientName  string    `gorm:"type:varchar(255);not null" json:"recipient_name"`
	Phone          string    `gorm:"type:varchar(20);not null" json:"phone"`
	Province       string    `gorm:"type:varchar(100);not null" json:"province"`
	ProvinceID     string    `gorm:"type:varchar(50)" json:"province_id"`
	City           string    `gorm:"type:varchar(100);not null" json:"city"`
	CityID         string    `gorm:"type:varchar(50)" json:"city_id"`
	District       string    `gorm:"type:varchar(100)" json:"district"`
	PostalCode     string    `gorm:"type:varchar(10);not null" json:"postal_code"`
	FullAddress    string    `gorm:"type:text;not null" json:"full_address"`
	IsDefault      bool      `gorm:"default:false" json:"is_default"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
