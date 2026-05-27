package service

import (
	"testing"

	"github.com/google/uuid"

	"orchidmart-backend/internal/model"
	"orchidmart-backend/internal/pkg/appcache"
	"orchidmart-backend/internal/repository"
)

type fakeProductRepo struct {
	findAllCalls int
	createCalls  int
	products     []model.Product
}

func (r *fakeProductRepo) FindAll(repository.ProductQuery) ([]model.Product, int64, error) {
	r.findAllCalls++
	return r.products, int64(len(r.products)), nil
}

func (r *fakeProductRepo) FindByID(string, bool) (*model.Product, error) {
	return &r.products[0], nil
}

func (r *fakeProductRepo) Create(*model.Product) error {
	r.createCalls++
	return nil
}

func (r *fakeProductRepo) Update(*model.Product) error { return nil }
func (r *fakeProductRepo) Delete(string) error         { return nil }
func (r *fakeProductRepo) AdjustStock(string, int, string, string) error {
	return nil
}
func (r *fakeProductRepo) FindAllCategories() ([]model.Category, error) {
	return []model.Category{{Name: "Cattleya"}}, nil
}
func (r *fakeProductRepo) ListWishlistByUserID(string) ([]model.Wishlist, error) {
	return nil, nil
}
func (r *fakeProductRepo) IsWishlisted(string, string) (bool, error) { return false, nil }
func (r *fakeProductRepo) AddToWishlist(string, string) error        { return nil }
func (r *fakeProductRepo) RemoveFromWishlist(string, string) error   { return nil }

func TestProductServiceCachesPublicListReads(t *testing.T) {
	repo := &fakeProductRepo{
		products: []model.Product{{ID: uuid.New(), Name: "Anggrek"}},
	}
	svc := NewProductService(repo, appcache.NewMemory())
	query := repository.ProductQuery{Page: 1, PerPage: 20}

	if _, _, err := svc.GetAllProducts(query); err != nil {
		t.Fatalf("GetAllProducts() first read error = %v", err)
	}
	if _, _, err := svc.GetAllProducts(query); err != nil {
		t.Fatalf("GetAllProducts() cached read error = %v", err)
	}
	if repo.findAllCalls != 1 {
		t.Fatalf("FindAll() calls = %d, want 1 after cached read", repo.findAllCalls)
	}
}

func TestProductServiceInvalidatesCatalogAfterMutation(t *testing.T) {
	repo := &fakeProductRepo{
		products: []model.Product{{ID: uuid.New(), Name: "Anggrek"}},
	}
	svc := NewProductService(repo, appcache.NewMemory())
	query := repository.ProductQuery{Page: 1, PerPage: 20}

	_, _, _ = svc.GetAllProducts(query)
	if err := svc.CreateProduct(&model.Product{Name: "Anggrek Baru"}); err != nil {
		t.Fatalf("CreateProduct() error = %v", err)
	}
	_, _, _ = svc.GetAllProducts(query)

	if repo.createCalls != 1 {
		t.Fatalf("Create() calls = %d, want 1", repo.createCalls)
	}
	if repo.findAllCalls != 2 {
		t.Fatalf("FindAll() calls = %d, want 2 after invalidation", repo.findAllCalls)
	}
}
