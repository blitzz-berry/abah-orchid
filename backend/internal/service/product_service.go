package service

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"orchidmart-backend/internal/model"
	"orchidmart-backend/internal/pkg/appcache"
	"orchidmart-backend/internal/repository"
	"strings"
	"time"
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
	promoSvc    PromotionService
	cache       appcache.Store
}

type cachedProductList struct {
	Products []model.Product `json:"products"`
	Total    int64           `json:"total"`
}

func NewProductService(productRepo repository.ProductRepository, promoSvc PromotionService, stores ...appcache.Store) ProductService {
	store := appcache.Disabled()
	if len(stores) > 0 && stores[0] != nil {
		store = stores[0]
	}
	return &productService{productRepo: productRepo, promoSvc: promoSvc, cache: store}
}

func (s *productService) GetAllProducts(query repository.ProductQuery) ([]model.Product, int64, error) {
	if query.IncludeInactive {
		return s.productRepo.FindAll(query)
	}
	key := productListCacheKey(query)
	var cached cachedProductList
	if s.cache.GetJSON(key, &cached) {
		return cached.Products, cached.Total, nil
	}
	products, total, err := s.productRepo.FindAll(query)
	if err == nil {
		s.applyPromotions(products)
		s.cache.SetJSON(key, cachedProductList{Products: products, Total: total}, 2*time.Minute)
	}
	return products, total, err
}

func (s *productService) GetProductByID(id string, includeInactive bool) (*model.Product, error) {
	if includeInactive {
		return s.productRepo.FindByID(id, includeInactive)
	}
	key := fmt.Sprintf("%sproduct:%s", appcache.CatalogPrefix, id)
	var cached model.Product
	if s.cache.GetJSON(key, &cached) {
		return &cached, nil
	}
	product, err := s.productRepo.FindByID(id, false)
	if err == nil && product != nil {
		s.applyPromotions([]model.Product{*product})
		s.cache.SetJSON(key, product, 2*time.Minute)
	}
	return product, err
}

func (s *productService) CreateProduct(product *model.Product) error {
	err := s.productRepo.Create(product)
	if err == nil {
		s.invalidateCatalog()
	}
	return err
}

func (s *productService) UpdateProduct(product *model.Product) error {
	err := s.productRepo.Update(product)
	if err == nil {
		s.invalidateCatalog()
	}
	return err
}

func (s *productService) DeleteProduct(id string) error {
	err := s.productRepo.Delete(id)
	if err == nil {
		s.invalidateCatalog()
	}
	return err
}

func (s *productService) AdjustStock(productID string, newQuantity int, adminID string, note string) error {
	err := s.productRepo.AdjustStock(productID, newQuantity, adminID, note)
	if err == nil {
		s.invalidateCatalog()
	}
	return err
}

func (s *productService) GetAllCategories() ([]model.Category, error) {
	key := appcache.CatalogPrefix + "categories"
	var cached []model.Category
	if s.cache.GetJSON(key, &cached) {
		return cached, nil
	}
	categories, err := s.productRepo.FindAllCategories()
	if err == nil {
		s.cache.SetJSON(key, categories, 10*time.Minute)
	}
	return categories, err
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

func (s *productService) invalidateCatalog() {
	s.cache.DeletePrefix(appcache.CatalogPrefix)
}

func productListCacheKey(query repository.ProductQuery) string {
	raw, _ := json.Marshal(query)
	return fmt.Sprintf("%sproducts:%x", appcache.CatalogPrefix, sha256.Sum256(raw))
}

func (s *productService) applyPromotions(products []model.Product) {
	promos, err := s.promoSvc.GetActivePromotions()
	if err != nil || len(promos) == 0 {
		return
	}
	now := time.Now().Weekday().String()
	for i := range products {
		for _, p := range promos {
			if p.RuleType == "DAY_OF_WEEK" && strings.EqualFold(p.RuleValue, now) {
				products[i].IsDiscounted = true
				if p.DiscountType == "PERCENTAGE" {
					products[i].DiscountedPrice = products[i].Price * (100 - p.DiscountValue) / 100
				} else {
					products[i].DiscountedPrice = products[i].Price - p.DiscountValue
				}
				products[i].DiscountLabel = p.Name
				break
			}
		}
	}
}
