package service

import (
	"orchidmart-backend/internal/model"
	"orchidmart-backend/internal/repository"
)

type CartService interface {
	GetCart(userID string) (*model.Cart, error)
	AddToCart(userID string, cartItem *model.CartItem) error
	UpdateCartItemQuantity(userID, cartItemID string, quantity int) error
	RemoveFromCart(userID, cartItemID string) error
	ClearCart(userID string) error
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

func (s *cartService) UpdateCartItemQuantity(userID, cartItemID string, quantity int) error {
	return s.cartRepo.UpdateCartItemQuantity(userID, cartItemID, quantity)
}

func (s *cartService) RemoveFromCart(userID, cartItemID string) error {
	return s.cartRepo.RemoveFromCart(userID, cartItemID)
}

func (s *cartService) ClearCart(userID string) error {
	cart, err := s.cartRepo.GetCartByUserID(userID)
	if err != nil {
		return err
	}
	return s.cartRepo.ClearCart(cart.ID.String())
}
