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
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Silakan masuk terlebih dahulu untuk mengakses keranjang."})
		return
	}

	cart, err := h.cartService.GetCart(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Keranjang berhasil dimuat.",
		"data":    cart,
	})
}

func (h *CartHandler) AddToCart(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Silakan masuk terlebih dahulu untuk menambahkan produk ke keranjang."})
		return
	}

	var req request.AddToCartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data produk yang dikirim tidak valid."})
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

	c.JSON(http.StatusOK, gin.H{"message": "Produk berhasil dimasukkan ke keranjang."})
}

func (h *CartHandler) UpdateCartItem(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Silakan masuk terlebih dahulu untuk memperbarui keranjang."})
		return
	}

	cartItemID := c.Param("id")
	var req struct {
		Quantity int `json:"quantity" binding:"required,min=1"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Jumlah produk harus minimal 1."})
		return
	}

	if err := h.cartService.UpdateCartItemQuantity(userID, cartItemID, req.Quantity); err != nil {
		respondCartError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Item keranjang berhasil diperbarui."})
}

func (h *CartHandler) RemoveFromCart(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Silakan masuk terlebih dahulu untuk mengubah keranjang."})
		return
	}
	cartItemID := c.Param("id")

	if err := h.cartService.RemoveFromCart(userID, cartItemID); err != nil {
		respondCartError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Item berhasil dihapus dari keranjang."})
}

func (h *CartHandler) ClearCart(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Silakan masuk terlebih dahulu untuk mengosongkan keranjang."})
		return
	}

	if err := h.cartService.ClearCart(userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Keranjang berhasil dikosongkan."})
}

func respondCartError(c *gin.Context, err error) {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item keranjang tidak ditemukan."})
		return
	}

	switch err.Error() {
	case "invalid user id":
		c.JSON(http.StatusBadRequest, gin.H{"error": "Sesi pengguna tidak valid. Silakan masuk kembali."})
	case "invalid cart item id":
		c.JSON(http.StatusBadRequest, gin.H{"error": "Item keranjang tidak valid."})
	case "product id is required":
		c.JSON(http.StatusBadRequest, gin.H{"error": "Produk belum dipilih."})
	case "cart id is required":
		c.JSON(http.StatusBadRequest, gin.H{"error": "Keranjang tidak valid. Silakan muat ulang halaman."})
	case "quantity must be at least 1":
		c.JSON(http.StatusBadRequest, gin.H{"error": "Jumlah produk harus minimal 1."})
	case "product is not available":
		c.JSON(http.StatusBadRequest, gin.H{"error": "Produk tidak tersedia atau sudah tidak aktif."})
	case "product inventory is not available":
		c.JSON(http.StatusBadRequest, gin.H{"error": "Informasi stok produk belum tersedia."})
	case "requested quantity exceeds available stock":
		c.JSON(http.StatusBadRequest, gin.H{"error": "Jumlah produk melebihi stok yang tersedia."})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Terjadi kendala saat memproses keranjang. Silakan coba lagi."})
	}
}
