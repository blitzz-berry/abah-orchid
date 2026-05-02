package handler

import (
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"

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
		respondUploadParseError(c, err)
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
		respondUploadParseError(c, err)
		return
	}
	result, err := storage.SavePaymentProof(file, storage.ImageFolder("payment-proofs", orderID))
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

func (h *UploadHandler) DownloadPaymentProof(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	orderID := c.Param("order_id")
	filename := c.Param("filename")
	if filename == "" || filename != filepath.Base(filename) || strings.ContainsAny(filename, `/\`) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payment proof filename"})
		return
	}

	var order model.Order
	if err := h.db.Preload("Payments").Where("id = ?", orderID).First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "payment proof not found"})
		return
	}
	if c.GetString("userRole") != "admin" && order.UserID.String() != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "payment proof access denied"})
		return
	}
	if !orderHasPaymentProofFile(order.Payments, orderID, filename) {
		c.JSON(http.StatusNotFound, gin.H{"error": "payment proof not found"})
		return
	}

	file, contentType, err := storage.OpenPaymentProof(orderID, filename)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "payment proof not found"})
		return
	}
	defer file.Close()

	c.Header("Content-Type", contentType)
	c.Header("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, filename))
	if _, err := io.Copy(c.Writer, file); err != nil {
		c.Error(err)
	}
}

func orderHasPaymentProofFile(payments []model.Payment, orderID, filename string) bool {
	wantSuffix := fmt.Sprintf("/payments/%s/proof-file/%s", orderID, filename)
	for _, payment := range payments {
		value := strings.TrimSpace(payment.ProofImageURL)
		if value == "" {
			continue
		}
		if strings.HasSuffix(value, wantSuffix) || strings.HasSuffix(value, "/"+filename) {
			return true
		}
	}
	return false
}

func respondUploadParseError(c *gin.Context, err error) {
	if strings.Contains(strings.ToLower(err.Error()), "request body too large") {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "request body too large"})
		return
	}
	c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
}
