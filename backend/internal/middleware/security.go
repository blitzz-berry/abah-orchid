package middleware

import "github.com/gin-gonic/gin"

func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		csp := "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; form-action 'none'; img-src 'self' data:; font-src 'none'; script-src 'none'; style-src 'none'; connect-src 'self'"
		if c.Request.URL.Path == "/uploads/" || len(c.Request.URL.Path) >= len("/uploads/") && c.Request.URL.Path[:len("/uploads/")] == "/uploads/" {
			csp = "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data:; media-src 'self'; script-src 'none'; style-src 'none'; sandbox"
		}
		c.Header("Content-Security-Policy", csp)
		c.Next()
	}
}
