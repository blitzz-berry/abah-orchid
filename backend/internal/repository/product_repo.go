package repository

import (
	"orchidmart-backend/internal/model"

	"gorm.io/gorm"
)

type ProductRepository interface {
	FindAll() ([]model.Product, error)
	FindByID(id string) (*model.Product, error)
	Create(product *model.Product) error
	Update(product *model.Product) error
	Delete(id string) error
	AdjustStock(productID string, newQuantity int, adminID string, note string) error
	FindAllCategories() ([]model.Category, error)
}

type productRepository struct {
	db *gorm.DB
}

func NewProductRepository(db *gorm.DB) ProductRepository {
	return &productRepository{db}
}

func (r *productRepository) FindAll() ([]model.Product, error) {
	var products []model.Product
	err := r.db.Preload("Category").Preload("Images").Preload("Inventory").Find(&products).Error
	return products, err
}

func (r *productRepository) FindByID(id string) (*model.Product, error) {
	var product model.Product
	err := r.db.Preload("Category").Preload("Images").Preload("Inventory").Where("id = ?", id).First(&product).Error
	if err != nil {
		return nil, err
	}
	return &product, nil
}

func (r *productRepository) Create(product *model.Product) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// Mock Category to avoid foreign key violations since we don't have a UI for Categories yet
		if product.CategoryID.String() == "00000000-0000-0000-0000-000000000000" {
			var cat model.Category
			if err := tx.Where("slug = ?", "default-category").First(&cat).Error; err != nil {
				cat = model.Category{
					Name: "Default Category",
					Slug: "default-category",
				}
				if err := tx.Create(&cat).Error; err != nil {
					return err
				}
			}
			product.CategoryID = cat.ID
		}

		if err := tx.Create(product).Error; err != nil {
			return err
		}
		// Create default inventory if not exists
		if product.Inventory == nil {
			inv := model.Inventory{
				ProductID: product.ID,
				Quantity:  0,
			}
			if err := tx.Create(&inv).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *productRepository) Update(product *model.Product) error {
	return r.db.Save(product).Error
}

func (r *productRepository) Delete(id string) error {
	// GORM will soft delete if DeletedAt is present
	return r.db.Where("id = ?", id).Delete(&model.Product{}).Error
}

func (r *productRepository) AdjustStock(productID string, newQuantity int, adminID string, note string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var inv model.Inventory
		if err := tx.Where("product_id = ?", productID).First(&inv).Error; err != nil {
			return err
		}

		diff := newQuantity - inv.Quantity
		inv.Quantity = newQuantity

		if err := tx.Save(&inv).Error; err != nil {
			return err
		}

		// Insert stock movement
		movementType := "STOCK_IN"
		if diff < 0 {
			movementType = "STOCK_OUT"
			diff = -diff
		}

		// Simplified inserting a movement string parsed properly later
		sm := model.StockMovement{
			ProductID:     inv.ProductID,
			MovementType:  movementType,
			Quantity:      diff,
			ReferenceType: "OPNAME",
			Note:          note,
		}
		
		return nil
	})
}

func (r *productRepository) FindAllCategories() ([]model.Category, error) {
	var categories []model.Category
	err := r.db.Order("sort_order asc").Find(&categories).Error
	return categories, err
}
