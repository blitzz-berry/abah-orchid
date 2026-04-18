package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Category struct {
	ID          uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name        string         `gorm:"type:varchar(100);not null" json:"name"`
	Slug        string         `gorm:"type:varchar(100);uniqueIndex;not null" json:"slug"`
	Description string         `gorm:"type:text" json:"description"`
	ImageURL    string         `gorm:"type:varchar(500)" json:"image_url"`
	ParentID    *uuid.UUID     `gorm:"type:uuid" json:"parent_id"`
	SortOrder   int            `gorm:"default:0" json:"sort_order"`
	IsActive    bool           `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	SubCategories []Category `gorm:"foreignKey:ParentID" json:"sub_categories,omitempty"`
	Products      []Product  `gorm:"foreignKey:CategoryID" json:"products,omitempty"`
}

type Product struct {
	ID            uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	CategoryID    uuid.UUID      `gorm:"type:uuid;index;not null" json:"category_id"`
	Name          string         `gorm:"type:varchar(255);not null" json:"name"`
	Slug          string         `gorm:"type:varchar(255);uniqueIndex;not null" json:"slug"`
	VarietyName   string         `gorm:"type:varchar(255)" json:"variety_name"`
	Description   string         `gorm:"type:text" json:"description"`
	Price         float64        `gorm:"type:numeric(12,2);not null" json:"price"`
	WeightGram    int            `gorm:"default:500;not null" json:"weight_gram"`
	Size          string         `gorm:"type:varchar(50)" json:"size"`
	Condition     string         `gorm:"type:varchar(50)" json:"condition"`
	UnitType      string         `gorm:"type:varchar(20);not null" json:"unit_type"`
	BatchQuantity int            `gorm:"default:1" json:"batch_quantity"`
	CareTips      string         `gorm:"type:text" json:"care_tips"`
	Tags          string         `gorm:"type:text" json:"tags"` // JSON string or comma separated
	Status        string         `gorm:"type:varchar(20);default:'active'" json:"status"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

	Category Category       `gorm:"foreignKey:CategoryID" json:"category"`
	Images   []ProductImage `gorm:"foreignKey:ProductID" json:"images"`
	Inventory *Inventory    `gorm:"foreignKey:ProductID" json:"inventory,omitempty"`
}

type ProductImage struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProductID uuid.UUID `gorm:"type:uuid;index;not null" json:"product_id"`
	ImageURL  string    `gorm:"type:varchar(500);not null" json:"image_url"`
	AltText   string    `gorm:"type:varchar(255)" json:"alt_text"`
	SortOrder int       `gorm:"default:0" json:"sort_order"`
	IsPrimary bool      `gorm:"default:false" json:"is_primary"`
	CreatedAt time.Time `json:"created_at"`
}

type Wishlist struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;uniqueIndex:idx_wishlists_user_product;not null" json:"user_id"`
	ProductID uuid.UUID `gorm:"type:uuid;uniqueIndex:idx_wishlists_user_product;not null" json:"product_id"`
	CreatedAt time.Time `json:"created_at"`

	Product Product `gorm:"foreignKey:ProductID" json:"product"`
}
