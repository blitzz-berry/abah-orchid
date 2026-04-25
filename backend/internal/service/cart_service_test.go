package service

import (
	"errors"
	"testing"

	"github.com/google/uuid"

	"orchidmart-backend/internal/model"
)

type fakeCartRepo struct {
	cart            *model.Cart
	addedItem       *model.CartItem
	updatedItemID   string
	updatedQuantity int
	removedItemID   string
	clearedCartID   string
	getCartErr      error
	addErr          error
	updateErr       error
	removeErr       error
	clearErr        error
}

func (r *fakeCartRepo) GetCartByUserID(string) (*model.Cart, error) {
	if r.getCartErr != nil {
		return nil, r.getCartErr
	}
	return r.cart, nil
}

func (r *fakeCartRepo) AddToCart(cartItem *model.CartItem) error {
	r.addedItem = cartItem
	return r.addErr
}

func (r *fakeCartRepo) UpdateCartItemQuantity(_ string, cartItemID string, quantity int) error {
	r.updatedItemID = cartItemID
	r.updatedQuantity = quantity
	return r.updateErr
}

func (r *fakeCartRepo) RemoveFromCart(_ string, cartItemID string) error {
	r.removedItemID = cartItemID
	return r.removeErr
}

func (r *fakeCartRepo) ClearCart(cartID string) error {
	r.clearedCartID = cartID
	return r.clearErr
}

func TestCartServiceAddToCartAttachesUserCartID(t *testing.T) {
	cartID := uuid.New()
	productID := uuid.New()
	repo := &fakeCartRepo{cart: &model.Cart{ID: cartID}}
	svc := NewCartService(repo)

	err := svc.AddToCart(uuid.NewString(), &model.CartItem{ProductID: productID, Quantity: 2})
	if err != nil {
		t.Fatalf("AddToCart() error = %v", err)
	}
	if repo.addedItem == nil {
		t.Fatal("AddToCart() did not call repository AddToCart")
	}
	if repo.addedItem.CartID != cartID {
		t.Fatalf("AddToCart() CartID = %s, want %s", repo.addedItem.CartID, cartID)
	}
	if repo.addedItem.ProductID != productID || repo.addedItem.Quantity != 2 {
		t.Fatalf("AddToCart() passed wrong item: %+v", repo.addedItem)
	}
}

func TestCartServiceClearCartClearsCurrentUsersCart(t *testing.T) {
	cartID := uuid.New()
	repo := &fakeCartRepo{cart: &model.Cart{ID: cartID}}
	svc := NewCartService(repo)

	if err := svc.ClearCart(uuid.NewString()); err != nil {
		t.Fatalf("ClearCart() error = %v", err)
	}
	if repo.clearedCartID != cartID.String() {
		t.Fatalf("ClearCart() cartID = %q, want %q", repo.clearedCartID, cartID.String())
	}
}

func TestCartServiceClearCartPropagatesCartLookupError(t *testing.T) {
	repo := &fakeCartRepo{getCartErr: errors.New("database down")}
	svc := NewCartService(repo)

	if err := svc.ClearCart(uuid.NewString()); err == nil {
		t.Fatal("ClearCart() expected cart lookup error")
	}
	if repo.clearedCartID != "" {
		t.Fatal("ClearCart() should not clear cart when lookup fails")
	}
}
