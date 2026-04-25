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
	UpdateCartItemQuantity(userID, cartItemID string, quantity int) error
	RemoveFromCart(userID, cartItemID string) error
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
	err := r.db.Where("user_id = ?", userID).
		Preload("Items.Product.Images").
		Preload("Items.Product.Inventory").
		First(&cart).Error
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
	return r.db.Transaction(func(tx *gorm.DB) error {
		var product model.Product
		if err := tx.Preload("Inventory").Where("id = ? AND status = ?", cartItem.ProductID, "active").First(&product).Error; err != nil {
			return err
		}
		if product.Inventory == nil {
			return errors.New("product inventory is not available")
		}

		var existingItem model.CartItem
		err := tx.Where("cart_id = ? AND product_id = ?", cartItem.CartID, cartItem.ProductID).First(&existingItem).Error
		if err == nil {
			nextQuantity := existingItem.Quantity + cartItem.Quantity
			if nextQuantity > product.Inventory.Quantity {
				return errors.New("requested quantity exceeds available stock")
			}
			existingItem.Quantity = nextQuantity
			if cartItem.Note != "" {
				existingItem.Note = cartItem.Note
			}
			return tx.Save(&existingItem).Error
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if cartItem.Quantity > product.Inventory.Quantity {
			return errors.New("requested quantity exceeds available stock")
		}
		return tx.Create(cartItem).Error
	})
}

func (r *cartRepository) UpdateCartItemQuantity(userID, cartItemID string, quantity int) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var cart model.Cart
		if err := tx.Where("user_id = ?", userID).First(&cart).Error; err != nil {
			return err
		}

		var item model.CartItem
		if err := tx.Preload("Product.Inventory").
			Where("id = ? AND cart_id = ?", cartItemID, cart.ID).
			First(&item).Error; err != nil {
			return err
		}
		if item.Product.Inventory == nil {
			return errors.New("product inventory is not available")
		}
		if quantity > item.Product.Inventory.Quantity {
			return errors.New("requested quantity exceeds available stock")
		}

		result := tx.Model(&model.CartItem{}).
			Where("id = ? AND cart_id = ?", cartItemID, cart.ID).
			Update("quantity", quantity)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}

		return nil
	})
}

func (r *cartRepository) RemoveFromCart(userID, cartItemID string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var cart model.Cart
		if err := tx.Where("user_id = ?", userID).First(&cart).Error; err != nil {
			return err
		}

		result := tx.Where("id = ? AND cart_id = ?", cartItemID, cart.ID).Delete(&model.CartItem{})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
}

func (r *cartRepository) ClearCart(cartID string) error {
	return r.db.Where("cart_id = ?", cartID).Delete(&model.CartItem{}).Error
}
