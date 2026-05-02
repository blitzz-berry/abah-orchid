package model

import (
	"time"

	"github.com/google/uuid"
)

type Inventory struct {
	ID                uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProductID         uuid.UUID `gorm:"type:uuid;uniqueIndex;not null" json:"product_id"`
	Quantity          int       `gorm:"not null;default:0;index" json:"quantity"`
	LowStockThreshold int       `gorm:"default:5" json:"low_stock_threshold"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type StockMovement struct {
	ID            uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProductID     uuid.UUID  `gorm:"type:uuid;index;not null" json:"product_id"`
	MovementType  string     `gorm:"type:varchar(20);index;not null" json:"movement_type"`
	Quantity      int        `gorm:"not null" json:"quantity"`
	ReferenceType string     `gorm:"type:varchar(50)" json:"reference_type"`
	ReferenceID   string     `gorm:"type:varchar(100)" json:"reference_id"`
	Note          string     `gorm:"type:text" json:"note"`
	PerformedBy   *uuid.UUID `gorm:"type:uuid" json:"performed_by,omitempty"`
	CreatedAt     time.Time  `gorm:"index" json:"created_at"`

	Product   *Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	AdminUser *User    `gorm:"foreignKey:PerformedBy" json:"admin_user,omitempty"`
}
