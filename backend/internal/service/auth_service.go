package service

import (
	"errors"
	"os"
	"time"

	"orchidmart-backend/internal/model"
	"orchidmart-backend/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type AuthService interface {
	Register(email, password, fullName, phone string) (*model.User, error)
	Login(email, password string) (string, string, error)
}

type authService struct {
	userRepo repository.UserRepository
}

func NewAuthService(userRepo repository.UserRepository) AuthService {
	return &authService{userRepo: userRepo}
}

func (s *authService) Register(email, password, fullName, phone string) (*model.User, error) {
	existingUser, _ := s.userRepo.FindByEmail(email)
	if existingUser != nil {
		return nil, errors.New("email already in use")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return nil, err
	}

	user := &model.User{
		Email:        email,
		PasswordHash: string(hashedPassword),
		FullName:     fullName,
		Phone:        phone,
		Role:         "customer",
	}

	if err := s.userRepo.CreateUser(user); err != nil {
		return nil, err
	}

	return user, nil
}

func (s *authService) Login(email, password string) (string, string, error) {
	user, err := s.userRepo.FindByEmail(email)
	if err != nil || user == nil {
		return "", "", errors.New("invalid email or password")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return "", "", errors.New("invalid email or password")
	}

	if !user.IsActive {
		return "", "", errors.New("account is suspended")
	}

	// Generate Tokens
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "supersecretkey" // Default for dev
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  user.ID.String(),
		"role": user.Role,
		"exp":  time.Now().Add(15 * time.Minute).Unix(),
	})
	acToken, _ := accessToken.SignedString([]byte(jwtSecret))

	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": user.ID.String(),
		"exp": time.Now().Add(7 * 24 * time.Hour).Unix(),
	})
	rfToken, _ := refreshToken.SignedString([]byte(jwtSecret))

	return acToken, rfToken, nil
}
