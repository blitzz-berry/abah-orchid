package repository

import (
	"errors"
	"orchidmart-backend/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CartRepository interface {
	GetCartByUserID(userID string) (*model.Cart, error)
	AddToCart(cartItem *model.CartItem) error
	RemoveFromCart(cartItemID string) error
	ClearCart(cartID string) error
}

type cartRepository struct {
	db *gorm.DB
}

func NewCartRepository(db *gorm.DB) CartRepository {
	return &cartRepository{db}
}

func (r *cartRepository) GetCartByUserID(userID string) (*model.Cart, error) {
	var cart model.Cart
	// Find or create cart
	err := r.db.Where("user_id = ?", userID).Preload("Items.Product").First(&cart).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			parsedUUID, _ := uuid.Parse(userID)
			cart.UserID = parsedUUID
			r.db.Create(&cart)
			return &cart, nil
		}
		return nil, err
	}
	return &cart, nil
}

func (r *cartRepository) AddToCart(cartItem *model.CartItem) error {
	// Check if already exists in cart, if yes then update quantity
	var existingItem model.CartItem
	err := r.db.Where("cart_id = ? AND product_id = ?", cartItem.CartID, cartItem.ProductID).First(&existingItem).Error
	if err == nil {
		existingItem.Quantity += cartItem.Quantity
		return r.db.Save(&existingItem).Error
	}
	return r.db.Create(cartItem).Error
}

func (r *cartRepository) RemoveFromCart(cartItemID string) error {
	return r.db.Where("id = ?", cartItemID).Delete(&model.CartItem{}).Error
}

func (r *cartRepository) ClearCart(cartID string) error {
	return r.db.Where("cart_id = ?", cartID).Delete(&model.CartItem{}).Error
}
