package service

import (
	"orchidmart-backend/internal/model"
	"orchidmart-backend/internal/repository"
)

type ProductService interface {
	GetAllProducts(query repository.ProductQuery) ([]model.Product, int64, error)
	GetProductByID(id string, includeInactive bool) (*model.Product, error)
	CreateProduct(product *model.Product) error
	UpdateProduct(product *model.Product) error
	DeleteProduct(id string) error
	AdjustStock(productID string, newQuantity int, adminID string, note string) error
	GetAllCategories() ([]model.Category, error)
	GetWishlist(userID string) ([]model.Wishlist, error)
	IsWishlisted(userID, productID string) (bool, error)
	AddToWishlist(userID, productID string) error
	RemoveFromWishlist(userID, productID string) error
}

type productService struct {
	productRepo repository.ProductRepository
}

func NewProductService(productRepo repository.ProductRepository) ProductService {
	return &productService{productRepo}
}

func (s *productService) GetAllProducts(query repository.ProductQuery) ([]model.Product, int64, error) {
	return s.productRepo.FindAll(query)
}

func (s *productService) GetProductByID(id string, includeInactive bool) (*model.Product, error) {
	return s.productRepo.FindByID(id, includeInactive)
}

func (s *productService) CreateProduct(product *model.Product) error {
	return s.productRepo.Create(product)
}

func (s *productService) UpdateProduct(product *model.Product) error {
	return s.productRepo.Update(product)
}

func (s *productService) DeleteProduct(id string) error {
	return s.productRepo.Delete(id)
}

func (s *productService) AdjustStock(productID string, newQuantity int, adminID string, note string) error {
	return s.productRepo.AdjustStock(productID, newQuantity, adminID, note)
}

func (s *productService) GetAllCategories() ([]model.Category, error) {
	return s.productRepo.FindAllCategories()
}

func (s *productService) GetWishlist(userID string) ([]model.Wishlist, error) {
	return s.productRepo.ListWishlistByUserID(userID)
}

func (s *productService) IsWishlisted(userID, productID string) (bool, error) {
	return s.productRepo.IsWishlisted(userID, productID)
}

func (s *productService) AddToWishlist(userID, productID string) error {
	return s.productRepo.AddToWishlist(userID, productID)
}

func (s *productService) RemoveFromWishlist(userID, productID string) error {
	return s.productRepo.RemoveFromWishlist(userID, productID)
}
