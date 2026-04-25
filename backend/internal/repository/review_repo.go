package repository

import (
	"errors"
	"orchidmart-backend/internal/model"

	"gorm.io/gorm"
)

type ReviewRepository interface {
	ListByProductID(productID string) ([]model.Review, error)
	FindByOrderUserAndProduct(orderID, userID, productID string) (*model.Review, error)
	Create(review *model.Review) error
}

type reviewRepository struct {
	db *gorm.DB
}

func NewReviewRepository(db *gorm.DB) ReviewRepository {
	return &reviewRepository{db: db}
}

func (r *reviewRepository) ListByProductID(productID string) ([]model.Review, error) {
	var reviews []model.Review
	err := r.db.Preload("User").Where("product_id = ?", productID).Order("created_at desc").Find(&reviews).Error
	return reviews, err
}

func (r *reviewRepository) FindByOrderUserAndProduct(orderID, userID, productID string) (*model.Review, error) {
	var review model.Review
	err := r.db.Where("order_id = ? AND user_id = ? AND product_id = ?", orderID, userID, productID).First(&review).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &review, nil
}

func (r *reviewRepository) Create(review *model.Review) error {
	return r.db.Create(review).Error
}
