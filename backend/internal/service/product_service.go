package service

import (
	"orchidmart-backend/internal/model"
	"orchidmart-backend/internal/repository"
)

type ProductService interface {
	GetAllProducts() ([]model.Product, error)
	GetProductByID(id string) (*model.Product, error)
	CreateProduct(product *model.Product) error
	UpdateProduct(product *model.Product) error
	DeleteProduct(id string) error
	AdjustStock(productID string, newQuantity int, adminID string, note string) error
	GetAllCategories() ([]model.Category, error)
}

type productService struct {
	productRepo repository.ProductRepository
}

func NewProductService(productRepo repository.ProductRepository) ProductService {
	return &productService{productRepo}
}

func (s *productService) GetAllProducts() ([]model.Product, error) {
	return s.productRepo.FindAll()
}

func (s *productService) GetProductByID(id string) (*model.Product, error) {
	return s.productRepo.FindByID(id)
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
