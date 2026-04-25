package repository

import (
	"errors"
	"orchidmart-backend/internal/model"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ProductRepository interface {
	FindAll(query ProductQuery) ([]model.Product, int64, error)
	FindByID(id string) (*model.Product, error)
	Create(product *model.Product) error
	Update(product *model.Product) error
	Delete(id string) error
	AdjustStock(productID string, newQuantity int, adminID string, note string) error
	FindAllCategories() ([]model.Category, error)
	ListWishlistByUserID(userID string) ([]model.Wishlist, error)
	IsWishlisted(userID, productID string) (bool, error)
	AddToWishlist(userID, productID string) error
	RemoveFromWishlist(userID, productID string) error
}

type ProductQuery struct {
	Search          string
	Category        string
	Size            string
	InStock         *bool
	MinPrice        *float64
	MaxPrice        *float64
	Sort            string
	Page            int
	PerPage         int
	IncludeInactive bool
}

type productRepository struct {
	db *gorm.DB
}

func NewProductRepository(db *gorm.DB) ProductRepository {
	return &productRepository{db}
}

func (r *productRepository) FindAll(query ProductQuery) ([]model.Product, int64, error) {
	var products []model.Product
	db := r.db.Model(&model.Product{}).
		Preload("Category").
		Preload("Images").
		Preload("Inventory")

	if !query.IncludeInactive {
		db = db.Where("products.status = ?", "active")
	}
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Where("LOWER(products.name) LIKE ? OR LOWER(products.variety_name) LIKE ? OR LOWER(products.description) LIKE ?", like, like, like)
	}
	if query.Category != "" {
		db = db.Joins("LEFT JOIN categories ON categories.id = products.category_id").
			Where("categories.slug = ? OR LOWER(categories.name) = ?", query.Category, strings.ToLower(query.Category))
	}
	if query.Size != "" {
		db = db.Where("products.size = ?", query.Size)
	}
	if query.MinPrice != nil {
		db = db.Where("products.price >= ?", *query.MinPrice)
	}
	if query.MaxPrice != nil {
		db = db.Where("products.price <= ?", *query.MaxPrice)
	}
	if query.InStock != nil {
		db = db.Joins("LEFT JOIN inventories ON inventories.product_id = products.id")
		if *query.InStock {
			db = db.Where("inventories.quantity > 0")
		} else {
			db = db.Where("inventories.quantity <= 0 OR inventories.quantity IS NULL")
		}
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	switch query.Sort {
	case "price_asc":
		db = db.Order("products.price asc")
	case "price_desc":
		db = db.Order("products.price desc")
	case "oldest":
		db = db.Order("products.created_at asc")
	case "bestseller":
		db = db.Order("products.created_at desc")
	default:
		db = db.Order("products.created_at desc")
	}

	if query.Page < 1 {
		query.Page = 1
	}
	if query.PerPage <= 0 || query.PerPage > 100 {
		query.PerPage = 20
	}
	err := db.Offset((query.Page - 1) * query.PerPage).Limit(query.PerPage).Find(&products).Error
	return products, total, err
}

func (r *productRepository) FindByID(id string) (*model.Product, error) {
	var product model.Product
	query := r.db.Preload("Category").Preload("Images").Preload("Inventory")
	if _, err := uuid.Parse(id); err == nil {
		query = query.Where("id = ?", id)
	} else {
		query = query.Where("slug = ?", id)
	}
	err := query.First(&product).Error
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

		initialInventory := product.Inventory
		product.Inventory = nil
		if err := tx.Create(product).Error; err != nil {
			return err
		}
		inv := model.Inventory{
			ProductID:         product.ID,
			Quantity:          0,
			LowStockThreshold: 5,
		}
		if initialInventory != nil {
			inv.Quantity = initialInventory.Quantity
			inv.LowStockThreshold = initialInventory.LowStockThreshold
			if inv.LowStockThreshold <= 0 {
				inv.LowStockThreshold = 5
			}
		}
		if err := tx.Create(&inv).Error; err != nil {
			return err
		}
		product.Inventory = &inv
		return nil
	})
}

func (r *productRepository) Update(product *model.Product) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var existing model.Product
		if err := tx.Where("id = ?", product.ID).First(&existing).Error; err != nil {
			return err
		}

		updates := map[string]interface{}{
			"category_id":    product.CategoryID,
			"name":           product.Name,
			"slug":           product.Slug,
			"variety_name":   product.VarietyName,
			"description":    product.Description,
			"price":          product.Price,
			"weight_gram":    product.WeightGram,
			"size":           product.Size,
			"condition":      product.Condition,
			"unit_type":      product.UnitType,
			"batch_quantity": product.BatchQuantity,
			"care_tips":      product.CareTips,
			"tags":           product.Tags,
			"status":         product.Status,
			"updated_at":     time.Now(),
		}
		if err := tx.Model(&model.Product{}).Where("id = ?", product.ID).Updates(updates).Error; err != nil {
			return err
		}

		if product.Inventory != nil {
			invUpdates := map[string]interface{}{
				"quantity":            product.Inventory.Quantity,
				"low_stock_threshold": product.Inventory.LowStockThreshold,
				"updated_at":          time.Now(),
			}
			if product.Inventory.LowStockThreshold <= 0 {
				invUpdates["low_stock_threshold"] = 5
			}
			if err := tx.Model(&model.Inventory{}).Where("product_id = ?", product.ID).Updates(invUpdates).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

func (r *productRepository) Delete(id string) error {
	// GORM will soft delete if DeletedAt is present
	return r.db.Where("id = ?", id).Delete(&model.Product{}).Error
}

func (r *productRepository) AdjustStock(productID string, newQuantity int, adminID string, note string) error {
	if newQuantity < 0 {
		return errors.New("stock quantity cannot be negative")
	}
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

		var performedBy uuid.UUID
		if adminID != "" {
			parsedID, err := uuid.Parse(adminID)
			if err != nil {
				return err
			}
			performedBy = parsedID
		}

		// Simplified inserting a movement string parsed properly later
		sm := model.StockMovement{
			ProductID:     inv.ProductID,
			MovementType:  movementType,
			Quantity:      diff,
			ReferenceType: "OPNAME",
			Note:          note,
			PerformedBy:   performedBy,
		}

		return tx.Create(&sm).Error
	})
}

func (r *productRepository) FindAllCategories() ([]model.Category, error) {
	var categories []model.Category
	err := r.db.Order("sort_order asc").Find(&categories).Error
	return categories, err
}

func (r *productRepository) ListWishlistByUserID(userID string) ([]model.Wishlist, error) {
	var items []model.Wishlist
	err := r.db.Preload("Product.Category").Preload("Product.Images").Preload("Product.Inventory").
		Where("user_id = ?", userID).
		Order("created_at desc").
		Find(&items).Error
	return items, err
}

func (r *productRepository) IsWishlisted(userID, productID string) (bool, error) {
	var count int64
	err := r.db.Model(&model.Wishlist{}).Where("user_id = ? AND product_id = ?", userID, productID).Count(&count).Error
	return count > 0, err
}

func (r *productRepository) AddToWishlist(userID, productID string) error {
	exists, err := r.IsWishlisted(userID, productID)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}

	return r.db.Create(&model.Wishlist{
		UserID:    mustUUID(userID),
		ProductID: mustUUID(productID),
	}).Error
}

func (r *productRepository) RemoveFromWishlist(userID, productID string) error {
	return r.db.Where("user_id = ? AND product_id = ?", userID, productID).Delete(&model.Wishlist{}).Error
}

func mustUUID(value string) uuid.UUID {
	parsed, err := uuid.Parse(value)
	if err != nil {
		return uuid.Nil
	}
	return parsed
}
