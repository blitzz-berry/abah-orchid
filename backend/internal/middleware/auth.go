package middleware

import (
	"fmt"
	"net/http"
	"net/netip"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"orchidmart-backend/internal/config"
)

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
			return
		}

		tokenString := parts[1]
		jwtSecret, err := config.RequiredSecret("JWT_SECRET", 32)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "JWT_SECRET is required"})
			return
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			return
		}

		// Cast to string explicitly — c.GetString() only works with Go string type
		sub, _ := claims["sub"].(string)
		role, _ := claims["role"].(string)
		c.Set("userID", sub)
		c.Set("userRole", role)
		c.Set("tokenIssuedAt", claimUnix(claims["iat"]))

		c.Next()
	}
}

func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		role := c.GetString("userRole")
		if role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			return
		}

		c.Next()
	}
}

func CustomerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		role := c.GetString("userRole")
		if role != "customer" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Customer access required"})
			return
		}

		c.Next()
	}
}

func AdminIPAllowlist() gin.HandlerFunc {
	return func(c *gin.Context) {
		raw := strings.TrimSpace(os.Getenv("ADMIN_IP_ALLOWLIST"))
		if raw == "" {
			c.Next()
			return
		}

		clientIP, err := netip.ParseAddr(c.ClientIP())
		if err != nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin client IP is invalid"})
			return
		}
		for _, item := range strings.Split(raw, ",") {
			item = strings.TrimSpace(item)
			if item == "" {
				continue
			}
			if prefix, err := netip.ParsePrefix(item); err == nil && prefix.Contains(clientIP) {
				c.Next()
				return
			}
			if addr, err := netip.ParseAddr(item); err == nil && addr == clientIP {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin IP is not allowed"})
	}
}

func RequireAdminStepUp(action string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if strings.ToLower(c.GetHeader("X-Admin-Step-Up")) != "confirm" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin step-up confirmation required", "code": "admin_step_up_required", "action": action})
			return
		}

		issuedAt := c.GetInt64("tokenIssuedAt")
		if issuedAt <= 0 || time.Since(time.Unix(issuedAt, 0)) > adminStepUpMaxAge() {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "fresh admin session required", "code": "admin_step_up_required", "action": action})
			return
		}

		c.Next()
	}
}

func claimUnix(value interface{}) int64 {
	switch v := value.(type) {
	case float64:
		return int64(v)
	case int64:
		return v
	case int:
		return int64(v)
	default:
		return 0
	}
}

func adminStepUpMaxAge() time.Duration {
	raw := strings.TrimSpace(os.Getenv("ADMIN_STEP_UP_MAX_AGE"))
	if raw == "" {
		return 10 * time.Minute
	}
	parsed, err := time.ParseDuration(raw)
	if err != nil || parsed <= 0 {
		return 10 * time.Minute
	}
	return parsed
}
