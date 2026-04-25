package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"orchidmart-backend/internal/model"
	"orchidmart-backend/internal/pkg/storage"
	"orchidmart-backend/internal/service"
)

type UploadHandler struct {
	db           *gorm.DB
	orderService service.OrderService
}

func NewUploadHandler(db *gorm.DB, orderService service.OrderService) *UploadHandler {
	return &UploadHandler{db: db, orderService: orderService}
}

func (h *UploadHandler) UploadProductImage(c *gin.Context) {
	productID := c.Param("id")
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}
	result, err := storage.SaveImage(file, storage.ImageFolder("products", productID))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	parsedProductID, err := uuid.Parse(productID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid product id"})
		return
	}
	image := model.ProductImage{
		ProductID: parsedProductID,
		ImageURL:  result.URL,
		AltText:   c.PostForm("alt_text"),
		IsPrimary: c.PostForm("is_primary") == "true",
	}
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if image.IsPrimary {
			if err := tx.Model(&model.ProductImage{}).Where("product_id = ?", productID).Update("is_primary", false).Error; err != nil {
				return err
			}
		}
		return tx.Create(&image).Error
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Product image uploaded", "data": gin.H{"image": image, "upload": result}})
}

func (h *UploadHandler) UploadPaymentProof(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	orderID := c.Param("order_id")
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}
	result, err := storage.SaveImage(file, storage.ImageFolder("payment-proofs", orderID))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	payment, err := h.orderService.UploadPaymentProof(orderID, userID, result.URL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Payment proof uploaded", "data": gin.H{"upload": result, "payment": payment}})
}
