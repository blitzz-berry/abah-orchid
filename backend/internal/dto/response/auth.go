package response

import (
	"time"
	"github.com/google/uuid"
)

type UserResponse struct {
	ID        uuid.UUID  `json:"id"`
	Email     string     `json:"email"`
	FullName  string     `json:"full_name"`
	Phone     string     `json:"phone"`
	Role      string     `json:"role"`
	CreatedAt time.Time  `json:"created_at"`
}

type AuthResponse struct {
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token"`
	User         UserResponse `json:"user"`
}
