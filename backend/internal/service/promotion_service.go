package service

import (
	"orchidmart-backend/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PromotionService interface {
	CreatePromotion(promo *model.Promotion) error
	GetAllPromotions() ([]model.Promotion, error)
	GetActivePromotions() ([]model.Promotion, error)
	TogglePromotionStatus(id uuid.UUID) error
	DeletePromotion(id uuid.UUID) error
}

type promotionService struct {
	db *gorm.DB
}

func NewPromotionService(db *gorm.DB) PromotionService {
	return &promotionService{db: db}
}

func (s *promotionService) CreatePromotion(promo *model.Promotion) error {
	return s.db.Create(promo).Error
}

func (s *promotionService) GetAllPromotions() ([]model.Promotion, error) {
	var promos []model.Promotion
	err := s.db.Order("created_at desc").Find(&promos).Error
	return promos, err
}

func (s *promotionService) GetActivePromotions() ([]model.Promotion, error) {
	var promos []model.Promotion
	err := s.db.Where("is_active = ?", true).Find(&promos).Error
	return promos, err
}

func (s *promotionService) TogglePromotionStatus(id uuid.UUID) error {
	return s.db.Model(&model.Promotion{}).Where("id = ?", id).Update("is_active", gorm.Expr("NOT is_active")).Error
}

func (s *promotionService) DeletePromotion(id uuid.UUID) error {
	return s.db.Delete(&model.Promotion{}, id).Error
}
