package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Item added to cart"})
}

func (h *CartHandler) RemoveFromCart(c *gin.Context) {
	userID := c.GetString("userID")
	cartItemID := c.Param("id")

	if err := h.cartService.RemoveFromCart(userID, cartItemID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Item removed from cart"})
}
