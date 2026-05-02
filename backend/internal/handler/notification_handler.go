package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"orchidmart-backend/internal/model"
)

type NotificationHandler struct {
	db *gorm.DB
}

func NewNotificationHandler(db *gorm.DB) *NotificationHandler {
	return &NotificationHandler{db: db}
}

func (h *NotificationHandler) GetNotifications(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("userID"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user"})
		return
	}

	var notifications []model.Notification
	if err := h.db.Where("user_id = ?", userID).Order("created_at desc").Limit(30).Find(&notifications).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch notifications"})
		return
	}

	var unreadCount int64
	_ = h.db.Model(&model.Notification{}).Where("user_id = ? AND is_read = ?", userID, false).Count(&unreadCount).Error

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"notifications": notifications,
		"unread_count":  unreadCount,
	}})
}

func (h *NotificationHandler) MarkRead(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("userID"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user"})
		return
	}
	notificationID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification id"})
		return
	}

	now := time.Now()
	if err := h.db.Model(&model.Notification{}).
		Where("id = ? AND user_id = ?", notificationID, userID).
		Updates(map[string]interface{}{"is_read": true, "read_at": &now}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark notification as read"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Notification marked as read"})
}

func (h *NotificationHandler) MarkAllRead(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("userID"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user"})
		return
	}

	now := time.Now()
	if err := h.db.Model(&model.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Updates(map[string]interface{}{"is_read": true, "read_at": &now}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark notifications as read"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Notifications marked as read"})
}
