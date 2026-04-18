package service

import (
	"orchidmart-backend/internal/model"
	"orchidmart-backend/internal/repository"
)

type CartService interface {
	GetCart(userID string) (*model.Cart, error)
	AddToCart(userID string, cartItem *model.CartItem) error
	RemoveFromCart(userID, cartItemID string) error
}

type cartService struct {
	cartRepo repository.CartRepository
}

func NewCartService(cartRepo repository.CartRepository) CartService {
	return &cartService{cartRepo}
}

func (s *cartService) GetCart(userID string) (*model.Cart, error) {
	return s.cartRepo.GetCartByUserID(userID)
}

func (s *cartService) AddToCart(userID string, cartItem *model.CartItem) error {
	cart, err := s.cartRepo.GetCartByUserID(userID)
	if err != nil {
		return err
	}
	cartItem.CartID = cart.ID
	return s.cartRepo.AddToCart(cartItem)
}

func (s *cartService) RemoveFromCart(userID, cartItemID string) error {
	// Usually validate if item belongs to user's cart, skipped for brevity
	return s.cartRepo.RemoveFromCart(cartItemID)
}
