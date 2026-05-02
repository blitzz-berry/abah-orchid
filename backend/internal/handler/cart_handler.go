package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"orchidmart-backend/internal/dto/request"
	"orchidmart-backend/internal/model"
	"orchidmart-backend/internal/service"
)

type CartHandler struct {
	cartService service.CartService
}

func NewCartHandler(cartService service.CartService) *CartHandler {
	return &CartHandler{cartService}
}

func (h *CartHandler) GetCart(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	cart, err := h.cartService.GetCart(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Cart fetched successfully",
		"data":    cart,
	})
}

func (h *CartHandler) AddToCart(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req request.AddToCartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cartItem := &model.CartItem{
		ProductID: req.ProductID,
		Quantity:  req.Quantity,
		Note:      req.Note,
	}

	if err := h.cartService.AddToCart(userID, cartItem); err != nil {
		respondCartError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Item added to cart"})
}

func (h *CartHandler) UpdateCartItem(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	cartItemID := c.Param("id")
	var req struct {
		Quantity int `json:"quantity" binding:"required,min=1"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.cartService.UpdateCartItemQuantity(userID, cartItemID, req.Quantity); err != nil {
		respondCartError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Cart item updated"})
}

func (h *CartHandler) RemoveFromCart(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	cartItemID := c.Param("id")

	if err := h.cartService.RemoveFromCart(userID, cartItemID); err != nil {
		respondCartError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Item removed from cart"})
}

func (h *CartHandler) ClearCart(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	if err := h.cartService.ClearCart(userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Cart cleared"})
}

func respondCartError(c *gin.Context, err error) {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "cart item not found"})
		return
	}

	switch err.Error() {
	case "invalid user id", "invalid cart item id", "product id is required", "cart id is required", "quantity must be at least 1", "product is not available", "product inventory is not available", "requested quantity exceeds available stock":
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	}
}
