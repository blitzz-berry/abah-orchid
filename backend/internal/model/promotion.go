package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Promotion struct {
	ID            uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name          string         `gorm:"type:varchar(255);not null" json:"name"`
	Description   string         `gorm:"type:text" json:"description"`
	DiscountType  string         `gorm:"type:varchar(50);not null" json:"discount_type"`
	DiscountValue float64        `gorm:"type:numeric(12,2);not null" json:"discount_value"`
	RuleType      string         `gorm:"type:varchar(50);not null" json:"rule_type"`
	RuleValue     string         `gorm:"type:varchar(255)" json:"rule_value"`
	IsActive      bool           `gorm:"default:true;index" json:"is_active"`
	StartDate     *time.Time     `json:"start_date"`
	EndDate       *time.Time     `json:"end_date"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}
