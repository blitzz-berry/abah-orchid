package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gin-contrib/cors"
	
	"orchidmart-backend/internal/config"
	"orchidmart-backend/internal/handler"
	"orchidmart-backend/internal/pkg/midtrans"
	"orchidmart-backend/internal/repository"
	"orchidmart-backend/internal/service"
)

func main() {
	// Initialize Database and Midtrans
	config.InitDB()
	midtrans.InitMidtrans()

	// Setup Gin router
	r := gin.Default()
	
	// Configure CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Dependency Injection
	userRepo := repository.NewUserRepository(config.DB)
	authSvc := service.NewAuthService(userRepo)
	authHandler := handler.NewAuthHandler(authSvc)

	productRepo := repository.NewProductRepository(config.DB)
	productSvc := service.NewProductService(productRepo)
	productHandler := handler.NewProductHandler(productSvc)

	cartRepo := repository.NewCartRepository(config.DB)
	cartSvc := service.NewCartService(cartRepo)
	cartHandler := handler.NewCartHandler(cartSvc)

	orderRepo := repository.NewOrderRepository(config.DB)
	orderSvc := service.NewOrderService(orderRepo, cartRepo)
	orderHandler := handler.NewOrderHandler(orderSvc)

	shippingHandler := handler.NewShippingHandler()

	// API Routes
	api := r.Group("/api/v1")
	{
		api.GET("/ping", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "pong from OrchidMart Backend!"})
		})

		authRoutes := api.Group("/auth")
		{
			authRoutes.POST("/register", authHandler.Register)
			authRoutes.POST("/login", authHandler.Login)
		}

		productRoutes := api.Group("/products")
		{
			productRoutes.GET("", productHandler.GetAllProducts)
			productRoutes.GET("/:id", productHandler.GetProductByID)

			// In a real application, these should be protected by an Admin Middleware
			productRoutes.POST("", productHandler.CreateProduct)
			productRoutes.PUT("/:id", productHandler.UpdateProduct)
			productRoutes.DELETE("/:id", productHandler.DeleteProduct)
			productRoutes.POST("/:id/adjust-stock", productHandler.AdjustStock)
		}

		shippingRoutes := api.Group("/shipping")
		{
			shippingRoutes.GET("/provinces", shippingHandler.GetProvinces)
			shippingRoutes.GET("/cities", shippingHandler.GetCities)
			shippingRoutes.POST("/cost", shippingHandler.GetCost)
		}

		// Webhooks (Unprotected)
		webhooks := api.Group("/webhooks")
		{
			webhooks.POST("/midtrans", orderHandler.WebhookMidtrans)
		}

		// Protected Routes
		// In a real application, you would attach the AuthMiddleware here
		// Example: protected := api.Group("/", middleware.AuthMiddleware())
		cartRoutes := api.Group("/cart") // attach middleware
		{
			cartRoutes.GET("", cartHandler.GetCart)
			cartRoutes.POST("", cartHandler.AddToCart)
			cartRoutes.DELETE("/:id", cartHandler.RemoveFromCart)
		}

		orderRoutes := api.Group("/orders") // attach middleware
		{
			orderRoutes.POST("/checkout", orderHandler.Checkout)
		}

		adminHandler := handler.NewAdminHandler(config.DB)
		adminRoutes := api.Group("/admin") // attach admin privilege middleware
		{
			adminRoutes.GET("/kpi", adminHandler.GetKPI)
		}
	}

	log.Println("Server is running on port 8080...")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}
