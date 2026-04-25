package service

import (
	"errors"
	"orchidmart-backend/internal/model"
	"orchidmart-backend/internal/repository"

	"github.com/google/uuid"
)

type ReviewService interface {
	ListByProductID(productID string) ([]model.Review, error)
	Create(userID, orderID, productID string, rating int, comment string) error
}

type reviewService struct {
	reviewRepo repository.ReviewRepository
	orderRepo  repository.OrderRepository
}

func NewReviewService(reviewRepo repository.ReviewRepository, orderRepo repository.OrderRepository) ReviewService {
	return &reviewService{reviewRepo: reviewRepo, orderRepo: orderRepo}
}

func (s *reviewService) ListByProductID(productID string) ([]model.Review, error) {
	return s.reviewRepo.ListByProductID(productID)
}

func (s *reviewService) Create(userID, orderID, productID string, rating int, comment string) error {
	order, err := s.orderRepo.GetOrderByID(orderID)
	if err != nil {
		return err
	}
	if order.UserID.String() != userID {
		return errors.New("order does not belong to the current user")
	}
	if order.Status != "COMPLETED" {
		return errors.New("review can only be submitted for completed orders")
	}

	hasProduct := false
	for _, item := range order.Items {
		if item.ProductID.String() == productID {
			hasProduct = true
			break
		}
	}
	if !hasProduct {
		return errors.New("product is not part of the order")
	}

	existing, err := s.reviewRepo.FindByOrderUserAndProduct(orderID, userID, productID)
	if err != nil {
		return err
	}
	if existing != nil {
		return errors.New("review already exists for this product")
	}

	review := &model.Review{
		ProductID: parseUUID(productID),
		UserID:    parseUUID(userID),
		OrderID:   parseUUID(orderID),
		Rating:    rating,
		Comment:   comment,
	}

	return s.reviewRepo.Create(review)
}

func parseUUID(value string) uuid.UUID {
	parsed, err := uuid.Parse(value)
	if err != nil {
		return uuid.Nil
	}
	return parsed
}
