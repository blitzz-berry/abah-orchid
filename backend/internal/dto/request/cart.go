package request

import "github.com/google/uuid"

type AddToCartRequest struct {
	ProductID uuid.UUID `json:"product_id" binding:"required"`
	Quantity  int       `json:"quantity" binding:"required,min=1"`
	Note      string    `json:"note"`
}
