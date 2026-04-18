package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type Review struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProductID uuid.UUID `gorm:"type:uuid;index;not null" json:"product_id"`
	UserID    uuid.UUID `gorm:"type:uuid;index;not null" json:"user_id"`
	OrderID   uuid.UUID `gorm:"type:uuid;not null" json:"order_id"`
	Rating    int       `gorm:"type:int;not null;check:rating >= 1 AND rating <= 5" json:"rating"`
	Comment   string    `gorm:"type:text" json:"comment"`
	CreatedAt time.Time `json:"created_at"`

	User User `gorm:"foreignKey:UserID" json:"user"`
}

type Coupon struct {
	ID            uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Code          string    `gorm:"type:varchar(50);uniqueIndex;not null" json:"code"`
	Description   string    `gorm:"type:text" json:"description"`
	DiscountType  string    `gorm:"type:varchar(20);not null" json:"discount_type"` // 'percentage' | 'fixed'
	DiscountValue float64   `gorm:"type:numeric(12,2);not null" json:"discount_value"`
	MinPurchase   float64   `gorm:"type:numeric(12,2);default:0" json:"min_purchase"`
	MaxDiscount   float64   `gorm:"type:numeric(12,2)" json:"max_discount"`
	UsageLimit    int       `gorm:"type:int" json:"usage_limit"`
	UsedCount     int       `gorm:"type:int;default:0" json:"used_count"`
	ValidFrom     time.Time `gorm:"not null" json:"valid_from"`
	ValidUntil    time.Time `gorm:"not null" json:"valid_until"`
	IsActive      bool      `gorm:"default:true" json:"is_active"`
	CreatedAt     time.Time `json:"created_at"`
}

type Notification struct {
	ID            uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID        uuid.UUID `gorm:"type:uuid;index;not null" json:"user_id"`
	Type          string    `gorm:"type:varchar(30);not null" json:"type"` // order_status | payment | promo | stock_alert
	Title         string    `gorm:"type:varchar(255);not null" json:"title"`
	Message       string    `gorm:"type:text;not null" json:"message"`
	ReferenceType string    `gorm:"type:varchar(50)" json:"reference_type"` // order | product | payment
	ReferenceID   uuid.UUID `gorm:"type:uuid" json:"reference_id"`
	IsRead        bool      `gorm:"default:false;index" json:"is_read"`
	ReadAt        *time.Time `json:"read_at"`
	CreatedAt     time.Time  `gorm:"index" json:"created_at"`
}

type AdminActivityLog struct {
	ID         uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	AdminID    uuid.UUID      `gorm:"type:uuid;index;not null" json:"admin_id"`
	Action     string         `gorm:"type:varchar(50);not null" json:"action"`
	EntityType string         `gorm:"type:varchar(50);index" json:"entity_type"`
	EntityID   uuid.UUID      `gorm:"type:uuid;index" json:"entity_id"`
	OldValues  datatypes.JSON `gorm:"type:jsonb" json:"old_values"`
	NewValues  datatypes.JSON `gorm:"type:jsonb" json:"new_values"`
	IPAddress  string         `gorm:"type:varchar(50)" json:"ip_address"`
	CreatedAt  time.Time      `gorm:"index" json:"created_at"`

	AdminUser User `gorm:"foreignKey:AdminID" json:"admin_user"`
}
