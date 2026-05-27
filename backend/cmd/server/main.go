package main

import (
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"orchidmart-backend/internal/config"
	"orchidmart-backend/internal/handler"
	"orchidmart-backend/internal/middleware"
	"orchidmart-backend/internal/pkg/appcache"
	"orchidmart-backend/internal/pkg/midtrans"
	"orchidmart-backend/internal/pkg/rajaongkir"
	"orchidmart-backend/internal/pkg/storage"
	"orchidmart-backend/internal/repository"
	"orchidmart-backend/internal/service"
)

func main() {
	config.LoadEnv()
	if _, err := config.RequiredSecret("JWT_SECRET", 32); err != nil {
		log.Fatalf("Invalid configuration: %v", err)
	}
	allowedOrigins, err := config.CORSAllowedOrigins()
	if err != nil {
		log.Fatalf("Invalid CORS configuration: %v", err)
	}

	// Initialize Database and Midtrans
	config.InitDB()
	midtrans.InitMidtrans()

	// Setup Gin router
	r := gin.Default()
	if err := r.SetTrustedProxies(trustedProxies()); err != nil {
		log.Fatalf("Invalid TRUSTED_PROXIES configuration: %v", err)
	}
	r.MaxMultipartMemory = 8 << 20
	r.Use(middleware.SecurityHeaders())
	r.StaticFS("/uploads", storage.PublicFileSystem())

	// Configure CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Admin-Step-Up"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Dependency Injection
	dataCache := appcache.NewFromEnv()
	rajaongkir.SetCache(dataCache)

	userRepo := repository.NewUserRepository(config.DB)
	authSvc := service.NewAuthService(userRepo)
	authHandler := handler.NewAuthHandler(authSvc)

	productRepo := repository.NewProductRepository(config.DB)
	productSvc := service.NewProductService(productRepo, dataCache)
	productHandler := handler.NewProductHandler(productSvc)

	cartRepo := repository.NewCartRepository(config.DB)
	cartSvc := service.NewCartService(cartRepo)
	cartHandler := handler.NewCartHandler(cartSvc)

	orderRepo := repository.NewOrderRepository(config.DB)
	orderSvc := service.NewOrderServiceWithDB(orderRepo, cartRepo, config.DB, dataCache)
	orderHandler := handler.NewOrderHandler(orderSvc, config.DB)
	uploadHandler := handler.NewUploadHandler(config.DB, orderSvc, dataCache)
	reviewRepo := repository.NewReviewRepository(config.DB)
	reviewSvc := service.NewReviewService(reviewRepo, orderRepo)
	reviewHandler := handler.NewReviewHandler(reviewSvc)

	shippingHandler := handler.NewShippingHandler()
	notificationHandler := handler.NewNotificationHandler(config.DB)
	adminHandler := handler.NewAdminHandler(config.DB, orderSvc, dataCache)
	if os.Getenv("PAYMENT_EXPIRY_WORKER") == "true" {
		go func() {
			ticker := time.NewTicker(15 * time.Minute)
			defer ticker.Stop()
			for range ticker.C {
				count, err := orderSvc.ExpirePendingPayments()
				if err != nil {
					log.Printf("payment expiry worker failed: %v", err)
					continue
				}
				if count > 0 {
					log.Printf("payment expiry worker cancelled %d pending orders", count)
				}
			}
		}()
	}

	// API Routes
	api := r.Group("/api/v1", middleware.RateLimit(100, time.Minute))
	{
		api.GET("/ping", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "pong from OrchidMart Backend!"})
		})
		api.GET("/healthz", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})
		api.GET("/readyz", func(c *gin.Context) {
			sqlDB, err := config.DB.DB()
			if err != nil || sqlDB.Ping() != nil {
				c.JSON(http.StatusServiceUnavailable, gin.H{"status": "not_ready"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"status": "ready"})
		})

		authRoutes := api.Group("/auth")
		{
			authRoutes.POST("/register", authHandler.Register)
			authRoutes.POST("/login", middleware.RateLimit(5, 15*time.Minute), authHandler.Login)
			authRoutes.POST("/google", middleware.RateLimit(10, 15*time.Minute), authHandler.GoogleLogin)
			authRoutes.POST("/refresh", authHandler.Refresh)
			authRoutes.POST("/logout", authHandler.Logout)
			authRoutes.POST("/forgot-password", middleware.RateLimit(5, 15*time.Minute), authHandler.ForgotPassword)
			authRoutes.POST("/reset-password", authHandler.ResetPassword)
			authRoutes.GET("/me", middleware.AuthMiddleware(), authHandler.GetMe)
			authRoutes.PUT("/me", middleware.AuthMiddleware(), authHandler.UpdateMe)
		}

		productRoutes := api.Group("/products")
		{
			productRoutes.GET("", productHandler.GetAllProducts)
			productRoutes.GET("/:id/reviews", reviewHandler.GetByProductID)
			productRoutes.POST("/:id/reviews", middleware.AuthMiddleware(), reviewHandler.Create)
			productRoutes.GET("/:id", productHandler.GetProductByID)

			adminProductRoutes := productRoutes.Group("", middleware.AuthMiddleware(), middleware.AdminMiddleware(), middleware.AdminIPAllowlist())
			adminProductRoutes.POST("", middleware.RequireAdminStepUp("create_product"), productHandler.CreateProduct)
			adminProductRoutes.PUT("/:id", middleware.RequireAdminStepUp("update_product"), productHandler.UpdateProduct)
			adminProductRoutes.DELETE("/:id", middleware.RequireAdminStepUp("delete_product"), productHandler.DeleteProduct)
			adminProductRoutes.POST("/:id/adjust-stock", middleware.RequireAdminStepUp("adjust_product_stock"), productHandler.AdjustStock)
		}

		// ... (keep existing shipping and webhooks)

		shippingRoutes := api.Group("/shipping")
		{
			shippingRoutes.GET("/provinces", shippingHandler.GetProvinces)
			shippingRoutes.GET("/cities", shippingHandler.GetCities)
			shippingRoutes.GET("/cities/:province_id", shippingHandler.GetCities)
			shippingRoutes.POST("/cost", shippingHandler.GetCost)
			shippingRoutes.GET("/track/:tracking_number", shippingHandler.Track)
			shippingRoutes.GET("/live-plant-options", shippingHandler.LivePlantOptions)
		}

		api.GET("/categories", productHandler.GetAllCategories) // ALSO AT ROOT level as requested by frontend
		api.GET("/categories/:slug/products", productHandler.GetProductsByCategory)

		addressRoutes := api.Group("/addresses", middleware.AuthMiddleware())
		{
			addressRoutes.GET("", authHandler.GetAddresses)
			addressRoutes.POST("", authHandler.CreateAddress)
			addressRoutes.PUT("/:id", authHandler.UpdateAddress)
			addressRoutes.DELETE("/:id", authHandler.DeleteAddress)
			addressRoutes.POST("/:id/default", authHandler.SetDefaultAddress)
		}

		// Webhooks (Unprotected)
		webhooks := api.Group("/webhooks")
		{
			webhooks.POST("/midtrans", orderHandler.WebhookMidtrans)
		}

		paymentWebhookRoutes := api.Group("/payments")
		{
			paymentWebhookRoutes.POST("/webhook/midtrans", middleware.RateLimit(60, time.Minute), orderHandler.WebhookMidtrans)
		}

		// Protected Routes (requires JWT token)
		cartRoutes := api.Group("/cart", middleware.AuthMiddleware())
		{
			cartRoutes.GET("", cartHandler.GetCart)
			cartRoutes.POST("", cartHandler.AddToCart)
			cartRoutes.POST("/items", cartHandler.AddToCart)
			cartRoutes.PUT("/items/:id", cartHandler.UpdateCartItem)
			cartRoutes.DELETE("/items/:id", cartHandler.RemoveFromCart)
			cartRoutes.DELETE("", cartHandler.ClearCart)
		}

		orderRoutes := api.Group("/orders", middleware.AuthMiddleware())
		{
			orderRoutes.GET("", orderHandler.GetUserOrders)
			orderRoutes.GET("/:id", orderHandler.GetOrderByID)
			orderRoutes.POST("", orderHandler.Checkout)
			orderRoutes.POST("/checkout", orderHandler.Checkout)
			orderRoutes.POST("/:id/cancel", middleware.RateLimit(10, 15*time.Minute), orderHandler.CancelOrder)
			orderRoutes.PUT("/:id/cancel", middleware.RateLimit(10, 15*time.Minute), orderHandler.CancelOrder)
			orderRoutes.PATCH("/:id/cancel", middleware.RateLimit(10, 15*time.Minute), orderHandler.CancelOrder)
			orderRoutes.POST("/:id/confirm-delivery", orderHandler.ConfirmDelivery)
			orderRoutes.POST("/:id/request-return", orderHandler.RequestReturn)
		}

		paymentRoutes := api.Group("/payments", middleware.AuthMiddleware())
		{
			paymentRoutes.POST("/:order_id/pay", middleware.RateLimit(10, 15*time.Minute), orderHandler.InitiatePayment)
			paymentRoutes.GET("/:order_id/status", orderHandler.GetPaymentStatus)
			paymentRoutes.GET("/:order_id/proof-file/:filename", uploadHandler.DownloadPaymentProof)
			paymentRoutes.POST("/:order_id/upload-proof", middleware.RateLimit(10, 15*time.Minute), orderHandler.UploadPaymentProof)
			paymentRoutes.POST("/:order_id/upload-proof-file", middleware.RateLimit(10, 15*time.Minute), middleware.BodyLimit(storage.MaxPaymentProofSize+(1<<20)), uploadHandler.UploadPaymentProof)
		}

		notificationRoutes := api.Group("/notifications", middleware.AuthMiddleware())
		{
			notificationRoutes.GET("", notificationHandler.GetNotifications)
			notificationRoutes.PATCH("/:id/read", notificationHandler.MarkRead)
			notificationRoutes.PATCH("/read-all", notificationHandler.MarkAllRead)
		}

		couponRoutes := api.Group("/coupons", middleware.AuthMiddleware())
		{
			couponRoutes.POST("/preview", middleware.RateLimit(20, time.Minute), adminHandler.PreviewCoupon)
		}

		adminRoutes := api.Group("/admin", middleware.AuthMiddleware(), middleware.AdminMiddleware(), middleware.AdminIPAllowlist(), middleware.RateLimit(300, time.Minute))
		{
			adminRoutes.GET("/kpi", adminHandler.GetKPI)
			adminRoutes.GET("/analytics/overview", adminHandler.GetAnalyticsOverview)
			adminRoutes.GET("/analytics/sales", adminHandler.GetSalesAnalytics)
			adminRoutes.GET("/analytics/sales/summary", adminHandler.GetSalesAnalytics)
			adminRoutes.GET("/analytics/sales/chart", adminHandler.GetSalesChart)
			adminRoutes.GET("/analytics/sales/top-products", adminHandler.GetTopProducts)
			adminRoutes.GET("/analytics/inventory", adminHandler.GetInventoryAnalytics)
			adminRoutes.GET("/analytics/customers", adminHandler.GetCustomerAnalytics)
			adminRoutes.GET("/analytics/trends", adminHandler.GetTrendAnalytics)
			adminRoutes.GET("/products", productHandler.GetAllProducts)
			adminRoutes.GET("/products/:id", productHandler.GetProductByID)
			adminRoutes.POST("/products", middleware.RequireAdminStepUp("create_product"), productHandler.CreateProduct)
			adminRoutes.PUT("/products/:id", middleware.RequireAdminStepUp("update_product"), productHandler.UpdateProduct)
			adminRoutes.DELETE("/products/:id", middleware.RequireAdminStepUp("delete_product"), productHandler.DeleteProduct)
			adminRoutes.POST("/products/:id/adjust-stock", middleware.RequireAdminStepUp("adjust_product_stock"), productHandler.AdjustStock)
			adminRoutes.POST("/products/:id/images", middleware.RequireAdminStepUp("add_product_image"), adminHandler.AddProductImage)
			adminRoutes.POST("/products/:id/images/upload", middleware.RequireAdminStepUp("upload_product_image"), middleware.BodyLimit(storage.MaxImageSize+(1<<20)), uploadHandler.UploadProductImage)
			adminRoutes.PUT("/products/:id/images/:image_id/primary", middleware.RequireAdminStepUp("set_primary_product_image"), adminHandler.SetPrimaryProductImage)
			adminRoutes.DELETE("/products/:id/images/:image_id", middleware.RequireAdminStepUp("delete_product_image"), adminHandler.DeleteProductImage)
			adminRoutes.GET("/categories", productHandler.GetAllCategories)
			adminRoutes.POST("/categories", middleware.RequireAdminStepUp("create_category"), adminHandler.CreateCategory)
			adminRoutes.PUT("/categories/:id", middleware.RequireAdminStepUp("update_category"), adminHandler.UpdateCategory)
			adminRoutes.DELETE("/categories/:id", middleware.RequireAdminStepUp("delete_category"), adminHandler.DeleteCategory)
			adminRoutes.GET("/orders", adminHandler.GetOrders)
			adminRoutes.GET("/orders/:id", adminHandler.GetOrderByID)
			adminRoutes.PUT("/orders/:id/status", middleware.RequireAdminStepUp("update_order_status"), adminHandler.UpdateOrderStatus)
			adminRoutes.PUT("/orders/:id/tracking", middleware.RequireAdminStepUp("update_order_tracking"), adminHandler.UpdateOrderTracking)
			adminRoutes.POST("/orders/:id/cancel", middleware.RequireAdminStepUp("cancel_order"), adminHandler.CancelOrder)
			adminRoutes.PUT("/orders/:id/cancel", middleware.RequireAdminStepUp("cancel_order"), adminHandler.CancelOrder)
			adminRoutes.PATCH("/orders/:id/cancel", middleware.RequireAdminStepUp("cancel_order"), adminHandler.CancelOrder)
			adminRoutes.POST("/orders/:id/approve-cancel", middleware.RequireAdminStepUp("approve_cancellation"), adminHandler.ApproveCancellation)
			adminRoutes.PUT("/orders/:id/approve-cancel", middleware.RequireAdminStepUp("approve_cancellation"), adminHandler.ApproveCancellation)
			adminRoutes.PATCH("/orders/:id/approve-cancel", middleware.RequireAdminStepUp("approve_cancellation"), adminHandler.ApproveCancellation)
			adminRoutes.POST("/orders/:id/reject-cancel", middleware.RequireAdminStepUp("reject_cancellation"), adminHandler.RejectCancellation)
			adminRoutes.PUT("/orders/:id/reject-cancel", middleware.RequireAdminStepUp("reject_cancellation"), adminHandler.RejectCancellation)
			adminRoutes.PATCH("/orders/:id/reject-cancel", middleware.RequireAdminStepUp("reject_cancellation"), adminHandler.RejectCancellation)
			adminRoutes.POST("/orders/:id/approve-return", middleware.RequireAdminStepUp("approve_return"), adminHandler.ApproveReturn)
			adminRoutes.PUT("/orders/:id/approve-return", middleware.RequireAdminStepUp("approve_return"), adminHandler.ApproveReturn)
			adminRoutes.PATCH("/orders/:id/approve-return", middleware.RequireAdminStepUp("approve_return"), adminHandler.ApproveReturn)
			adminRoutes.POST("/orders/:id/reject-return", middleware.RequireAdminStepUp("reject_return"), adminHandler.RejectReturn)
			adminRoutes.PUT("/orders/:id/reject-return", middleware.RequireAdminStepUp("reject_return"), adminHandler.RejectReturn)
			adminRoutes.PATCH("/orders/:id/reject-return", middleware.RequireAdminStepUp("reject_return"), adminHandler.RejectReturn)
			adminRoutes.POST("/orders/:id/confirm-payment", middleware.RequireAdminStepUp("confirm_payment"), adminHandler.ConfirmPayment)
			adminRoutes.POST("/orders/:id/refund", middleware.RequireAdminStepUp("refund_order"), adminHandler.RefundOrder)
			adminRoutes.GET("/orders/:id/invoice", adminHandler.PrintInvoice)
			adminRoutes.POST("/payments/expire", middleware.RequireAdminStepUp("expire_payments"), adminHandler.ExpirePayments)
			adminRoutes.GET("/customers", adminHandler.GetCustomers)
			adminRoutes.GET("/customers/:id", adminHandler.GetCustomerByID)
			adminRoutes.GET("/inventory", adminHandler.GetInventory)
			adminRoutes.GET("/inventory/low-stock", adminHandler.GetLowStockInventory)
			adminRoutes.GET("/inventory/movements", adminHandler.GetMovements) // UPDATED
			adminRoutes.PUT("/inventory/:product_id", middleware.RequireAdminStepUp("update_inventory"), adminHandler.UpdateInventory)
			adminRoutes.GET("/coupons", adminHandler.GetCoupons)
			adminRoutes.POST("/coupons", middleware.RequireAdminStepUp("create_coupon"), adminHandler.CreateCoupon)
			adminRoutes.PUT("/coupons/:id", middleware.RequireAdminStepUp("update_coupon"), adminHandler.UpdateCoupon)
			adminRoutes.DELETE("/coupons/:id", middleware.RequireAdminStepUp("delete_coupon"), adminHandler.DeleteCoupon)
			adminRoutes.POST("/coupons/preview", middleware.RateLimit(60, time.Minute), adminHandler.PreviewCoupon)
		}

		wishlistRoutes := api.Group("/wishlist", middleware.AuthMiddleware())
		{
			wishlistRoutes.GET("", productHandler.GetWishlist)
			wishlistRoutes.POST("", productHandler.AddToWishlist)
			wishlistRoutes.GET("/:id/status", productHandler.GetWishlistStatus)
			wishlistRoutes.DELETE("/:id", productHandler.RemoveFromWishlist)
		}

		reviewRoutes := api.Group("/reviews")
		{
			reviewRoutes.GET("/product/:productID", reviewHandler.GetByProductID)
			reviewRoutes.POST("", middleware.AuthMiddleware(), reviewHandler.Create)
		}
	}

	port := os.Getenv("APP_PORT")
	if port == "" {
		port = os.Getenv("PORT")
	}
	if port == "" {
		port = "8080"
	}
	server := config.NewHTTPServer(":"+port, r)
	log.Printf("Server is running on port %s...", port)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Failed to run server: %v", err)
	}
}

func trustedProxies() []string {
	raw := strings.TrimSpace(os.Getenv("TRUSTED_PROXIES"))
	if raw == "" {
		if config.IsProduction() {
			log.Fatal("TRUSTED_PROXIES is required in production (comma-separated IPs/CIDRs of reverse proxies)")
		}
		// Dev default: only trust local proxy hops.
		return []string{"127.0.0.1", "::1"}
	}

	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}
