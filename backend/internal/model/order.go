package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Cart struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;uniqueIndex;not null" json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Items []CartItem `gorm:"foreignKey:CartID" json:"items"`
}

type CartItem struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	CartID    uuid.UUID `gorm:"type:uuid;uniqueIndex:idx_cart_items_cart_product;not null" json:"cart_id"`
	ProductID uuid.UUID `gorm:"type:uuid;uniqueIndex:idx_cart_items_cart_product;not null" json:"product_id"`
	Quantity  int       `gorm:"not null;default:1" json:"quantity"`
	Note      string    `gorm:"type:text" json:"note"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Product Product `gorm:"foreignKey:ProductID" json:"product"`
}

type Order struct {
	ID                 uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	OrderNumber        string         `gorm:"type:varchar(50);uniqueIndex;not null" json:"order_number"`
	UserID             uuid.UUID      `gorm:"type:uuid;index;not null" json:"user_id"`
	
	ShippingName       string         `gorm:"type:varchar(255);not null" json:"shipping_name"`
	ShippingPhone      string         `gorm:"type:varchar(20);not null" json:"shipping_phone"`
	ShippingAddress    string         `gorm:"type:text;not null" json:"shipping_address"`
	ShippingCity       string         `gorm:"type:varchar(100);not null" json:"shipping_city"`
	ShippingProvince   string         `gorm:"type:varchar(100);not null" json:"shipping_province"`
	ShippingPostalCode string         `gorm:"type:varchar(10);not null" json:"shipping_postal_code"`
	CourierCode        string         `gorm:"type:varchar(20)" json:"courier_code"`
	CourierService     string         `gorm:"type:varchar(50)" json:"courier_service"`
	ShippingCost       float64        `gorm:"type:numeric(12,2)" json:"shipping_cost"`
	TrackingNumber     string         `gorm:"type:varchar(100)" json:"tracking_number"`
	
	Subtotal           float64        `gorm:"type:numeric(12,2);not null" json:"subtotal"`
	Discount           float64        `gorm:"type:numeric(12,2);default:0" json:"discount"`
	CouponCode         string         `gorm:"type:varchar(50)" json:"coupon_code"`
	Total              float64        `gorm:"type:numeric(12,2);not null" json:"total"`
	Status             string         `gorm:"type:varchar(30);default:'PENDING_PAYMENT';index" json:"status"`
	Note               string         `gorm:"type:text" json:"note"`
	AdminNote          string         `gorm:"type:text" json:"admin_note"`
	
	PaidAt             *time.Time     `json:"paid_at"`
	ShippedAt          *time.Time     `json:"shipped_at"`
	DeliveredAt        *time.Time     `json:"delivered_at"`
	CompletedAt        *time.Time     `json:"completed_at"`
	CancelledAt        *time.Time     `json:"cancelled_at"`
	CreatedAt          time.Time      `gorm:"index" json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`

	Items          []OrderItem          `gorm:"foreignKey:OrderID" json:"items"`
	StatusHistory  []OrderStatusHistory `gorm:"foreignKey:OrderID" json:"status_history"`
	Payments       []Payment            `gorm:"foreignKey:OrderID" json:"payments"`
	User           User                 `gorm:"foreignKey:UserID" json:"user"`
}

type OrderItem struct {
	ID               uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	OrderID          uuid.UUID `gorm:"type:uuid;index;not null" json:"order_id"`
	ProductID        uuid.UUID `gorm:"type:uuid;not null" json:"product_id"`
	ProductName      string    `gorm:"type:varchar(255);not null" json:"product_name"`
	ProductImageURL  string    `gorm:"type:varchar(500)" json:"product_image_url"`
	ProductPrice     float64   `gorm:"type:numeric(12,2);not null" json:"product_price"`
	UnitType         string    `gorm:"type:varchar(20)" json:"unit_type"`
	Quantity         int       `gorm:"not null" json:"quantity"`
	Subtotal         float64   `gorm:"type:numeric(12,2);not null" json:"subtotal"`
	CreatedAt        time.Time `json:"created_at"`
}

type OrderStatusHistory struct {
	ID         uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	OrderID    uuid.UUID `gorm:"type:uuid;index;not null" json:"order_id"`
	FromStatus string    `gorm:"type:varchar(30)" json:"from_status"`
	ToStatus   string    `gorm:"type:varchar(30)" json:"to_status"`
	Note       string    `gorm:"type:text" json:"note"`
	ChangedBy  uuid.UUID `gorm:"type:uuid" json:"changed_by"`
	CreatedAt  time.Time `json:"created_at"`
}

type Payment struct {
	ID              uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	OrderID         uuid.UUID `gorm:"type:uuid;index;not null" json:"order_id"`
	Method          string    `gorm:"type:varchar(30);not null" json:"method"`
	Provider        string    `gorm:"type:varchar(50)" json:"provider"`
	ExternalID      string    `gorm:"type:varchar(255);index" json:"external_id"`
	Amount          float64   `gorm:"type:numeric(12,2);not null" json:"amount"`
	Status          string    `gorm:"type:varchar(20);default:'PENDING';index" json:"status"`
	PaymentURL      string    `gorm:"type:varchar(500)" json:"payment_url"`
	ProofImageURL   string    `gorm:"type:varchar(500)" json:"proof_image_url"`
	FailureReason   string    `gorm:"type:text" json:"failure_reason"`
	PaidAt          *time.Time `json:"paid_at"`
	ExpiredAt       *time.Time `json:"expired_at"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}
