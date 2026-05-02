package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"orchidmart-backend/internal/model"
	"orchidmart-backend/internal/repository"
	"orchidmart-backend/internal/service"
)

type ProductHandler struct {
	productService service.ProductService
}

func NewProductHandler(productService service.ProductService) *ProductHandler {
	return &ProductHandler{productService}
}

func (h *ProductHandler) GetAllProducts(c *gin.Context) {
	includeInactive := c.GetString("userRole") == "admin" && c.Query("include_inactive") == "true"
	query := repository.ProductQuery{
		Search:          c.Query("search"),
		Category:        c.Query("category"),
		Size:            c.Query("size"),
		Sort:            c.DefaultQuery("sort", "newest"),
		Page:            intQuery(c, "page", 1),
		PerPage:         intQuery(c, "per_page", 20),
		IncludeInactive: includeInactive,
	}
	if c.Query("in_stock") != "" {
		value := c.Query("in_stock") == "true"
		query.InStock = &value
	}
	if minPrice, ok := floatQuery(c, "min_price"); ok {
		query.MinPrice = &minPrice
	}
	if maxPrice, ok := floatQuery(c, "max_price"); ok {
		query.MaxPrice = &maxPrice
	}

	products, total, err := h.productService.GetAllProducts(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch products"})
		return
	}

	totalPages := 0
	if query.PerPage > 0 {
		totalPages = int((total + int64(query.PerPage) - 1) / int64(query.PerPage))
	}
	c.JSON(http.StatusOK, gin.H{
		"message": "Products fetched successfully",
		"data":    products,
		"meta": gin.H{
			"page":        query.Page,
			"per_page":    query.PerPage,
			"total":       total,
			"total_pages": totalPages,
		},
	})
}

func (h *ProductHandler) GetProductsByCategory(c *gin.Context) {
	query := repository.ProductQuery{
		Search:   c.Query("search"),
		Category: c.Param("slug"),
		Size:     c.Query("size"),
		Sort:     c.DefaultQuery("sort", "newest"),
		Page:     intQuery(c, "page", 1),
		PerPage:  intQuery(c, "per_page", 20),
	}
	if c.Query("in_stock") != "" {
		value := c.Query("in_stock") == "true"
		query.InStock = &value
	}
	if minPrice, ok := floatQuery(c, "min_price"); ok {
		query.MinPrice = &minPrice
	}
	if maxPrice, ok := floatQuery(c, "max_price"); ok {
		query.MaxPrice = &maxPrice
	}

	products, total, err := h.productService.GetAllProducts(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch products"})
		return
	}

	totalPages := 0
	if query.PerPage > 0 {
		totalPages = int((total + int64(query.PerPage) - 1) / int64(query.PerPage))
	}
	c.JSON(http.StatusOK, gin.H{
		"message": "Category products fetched successfully",
		"data":    products,
		"meta": gin.H{
			"page":        query.Page,
			"per_page":    query.PerPage,
			"total":       total,
			"total_pages": totalPages,
		},
	})
}

func (h *ProductHandler) GetProductByID(c *gin.Context) {
	id := c.Param("id")
	product, err := h.productService.GetProductByID(id, c.GetString("userRole") == "admin")
	if err != nil || product == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Product fetched successfully",
		"data":    product,
	})
}

func (h *ProductHandler) CreateProduct(c *gin.Context) {
	var product model.Product
	if err := c.ShouldBindJSON(&product); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if product.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	if product.Price < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "price cannot be negative"})
		return
	}
	if product.UnitType == "" {
		product.UnitType = "PER_POHON"
	}
	if product.Status == "" {
		product.Status = "active"
	}
	if product.WeightGram <= 0 {
		product.WeightGram = 500
	}
	if product.BatchQuantity <= 0 {
		product.BatchQuantity = 1
	}
	if product.Slug == "" {
		product.Slug = productSlug(product.Name) + "-" + uuid.NewString()[:6]
	}

	if err := h.productService.CreateProduct(&product); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Product created successfully", "data": product})
}

func (h *ProductHandler) UpdateProduct(c *gin.Context) {
	var product model.Product
	if err := c.ShouldBindJSON(&product); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if id := c.Param("id"); id != "" {
		parsedID, err := uuid.Parse(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid product id"})
			return
		}
		product.ID = parsedID
	}
	if product.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	if product.Price < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "price cannot be negative"})
		return
	}
	if product.UnitType == "" {
		product.UnitType = "PER_POHON"
	}
	if product.Status == "" {
		product.Status = "active"
	}
	if product.WeightGram <= 0 {
		product.WeightGram = 500
	}
	if product.BatchQuantity <= 0 {
		product.BatchQuantity = 1
	}
	if product.Slug == "" {
		product.Slug = productSlug(product.Name) + "-" + product.ID.String()[:6]
	}

	if err := h.productService.UpdateProduct(&product); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Product updated successfully", "data": product})
}

func (h *ProductHandler) DeleteProduct(c *gin.Context) {
	id := c.Param("id")
	if err := h.productService.DeleteProduct(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Product deleted successfully"})
}

func (h *ProductHandler) AdjustStock(c *gin.Context) {
	productID := c.Param("id")
	var req struct {
		Quantity *int   `json:"quantity" binding:"required,min=0"`
		Note     string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	adminID := c.GetString("userID")

	if err := h.productService.AdjustStock(productID, *req.Quantity, adminID, req.Note); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Stock adjusted successfully"})
}

func (h *ProductHandler) GetAllCategories(c *gin.Context) {
	categories, err := h.productService.GetAllCategories()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch categories"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Categories fetched successfully",
		"data":    categories,
	})
}

func (h *ProductHandler) GetWishlist(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	items, err := h.productService.GetWishlist(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *ProductHandler) GetWishlistStatus(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	wishlisted, err := h.productService.IsWishlisted(userID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"wishlisted": wishlisted}})
}

func (h *ProductHandler) AddToWishlist(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		ProductID string `json:"product_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.productService.AddToWishlist(userID, req.ProductID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Product added to wishlist"})
}

func (h *ProductHandler) RemoveFromWishlist(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	if err := h.productService.RemoveFromWishlist(userID, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Product removed from wishlist"})
}

func intQuery(c *gin.Context, key string, fallback int) int {
	value, err := strconv.Atoi(c.Query(key))
	if err != nil {
		return fallback
	}
	return value
}

func floatQuery(c *gin.Context, key string) (float64, bool) {
	if c.Query(key) == "" {
		return 0, false
	}
	value, err := strconv.ParseFloat(c.Query(key), 64)
	return value, err == nil
}

func productSlug(value string) string {
	result := ""
	lastDash := false
	for _, ch := range strings.TrimSpace(value) {
		if ch >= 'A' && ch <= 'Z' {
			ch += 32
		}
		if (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') {
			result += string(ch)
			lastDash = false
			continue
		}
		if !lastDash && result != "" {
			result += "-"
			lastDash = true
		}
	}
	if result == "" {
		return "produk"
	}
	return strings.TrimSuffix(result, "-")
}
