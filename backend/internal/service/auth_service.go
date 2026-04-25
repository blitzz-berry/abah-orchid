package service

import (
	"errors"
	"fmt"
	"log"
	"os"
	"time"

	"orchidmart-backend/internal/config"
	"orchidmart-backend/internal/model"
	mailerPkg "orchidmart-backend/internal/pkg/mailer"
	"orchidmart-backend/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AuthService interface {
	Register(email, password, fullName, phone string) (*model.User, error)
	Login(email, password string) (*model.User, string, string, error)
	Refresh(refreshToken string) (*model.User, string, string, error)
	Logout(refreshToken string) error
	GetUserByID(userID string) (*model.User, error)
	UpdateProfile(userID, fullName, phone string) (*model.User, error)
	GetAddresses(userID string) ([]model.Address, error)
	CreateAddress(userID string, address *model.Address) error
	UpdateAddress(userID, addressID string, address *model.Address) (*model.Address, error)
	DeleteAddress(userID, addressID string) error
	SetDefaultAddress(userID, addressID string) error
	RequestPasswordReset(email string) error
	ResetPassword(token, password string) error
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

func (s *authService) Login(email, password string) (*model.User, string, string, error) {
	user, err := s.userRepo.FindByEmail(email)
	if err != nil || user == nil {
		return nil, "", "", errors.New("invalid email or password")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, "", "", errors.New("invalid email or password")
	}

	if !user.IsActive {
		return nil, "", "", errors.New("account is suspended")
	}

	acToken, rfToken, err := s.issueTokens(user)
	if err != nil {
		return nil, "", "", err
	}
	if err := s.userRepo.CreateRefreshToken(&model.RefreshToken{
		UserID:    user.ID,
		Token:     rfToken,
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
	}); err != nil {
		return nil, "", "", err
	}

	return user, acToken, rfToken, nil
}

func (s *authService) Refresh(refreshToken string) (*model.User, string, string, error) {
	stored, err := s.userRepo.FindRefreshToken(refreshToken)
	if err != nil {
		return nil, "", "", err
	}
	if stored == nil || stored.IsRevoked || time.Now().After(stored.ExpiresAt) {
		return nil, "", "", errors.New("refresh token is invalid or expired")
	}

	claims, err := parseToken(refreshToken)
	if err != nil {
		return nil, "", "", err
	}
	sub, _ := claims["sub"].(string)
	if sub == "" || sub != stored.UserID.String() {
		return nil, "", "", errors.New("refresh token subject is invalid")
	}

	user, err := s.userRepo.FindByID(sub)
	if err != nil {
		return nil, "", "", err
	}
	if user == nil || !user.IsActive {
		return nil, "", "", errors.New("account is suspended")
	}

	acToken, rfToken, err := s.issueTokens(user)
	if err != nil {
		return nil, "", "", err
	}
	if err := s.userRepo.RevokeRefreshToken(refreshToken); err != nil {
		return nil, "", "", err
	}
	if err := s.userRepo.CreateRefreshToken(&model.RefreshToken{
		UserID:    user.ID,
		Token:     rfToken,
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
	}); err != nil {
		return nil, "", "", err
	}

	return user, acToken, rfToken, nil
}

func (s *authService) Logout(refreshToken string) error {
	if refreshToken == "" {
		return nil
	}
	return s.userRepo.RevokeRefreshToken(refreshToken)
}

func (s *authService) GetUserByID(userID string) (*model.User, error) {
	return s.userRepo.FindByID(userID)
}

func (s *authService) UpdateProfile(userID, fullName, phone string) (*model.User, error) {
	return s.userRepo.UpdateProfile(userID, fullName, phone)
}

func (s *authService) GetAddresses(userID string) ([]model.Address, error) {
	return s.userRepo.GetAddressesByUserID(userID)
}

func (s *authService) CreateAddress(userID string, address *model.Address) error {
	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		return err
	}

	address.UserID = parsedUserID
	return s.userRepo.CreateAddress(address)
}

func (s *authService) UpdateAddress(userID, addressID string, address *model.Address) (*model.Address, error) {
	return s.userRepo.UpdateAddress(userID, addressID, address)
}

func (s *authService) DeleteAddress(userID, addressID string) error {
	return s.userRepo.DeleteAddress(userID, addressID)
}

func (s *authService) SetDefaultAddress(userID, addressID string) error {
	return s.userRepo.SetDefaultAddress(userID, addressID)
}

func (s *authService) RequestPasswordReset(email string) error {
	user, err := s.userRepo.FindByEmail(email)
	if err != nil {
		return err
	}
	if user == nil {
		return nil
	}

	reset := &model.PasswordReset{
		UserID:    user.ID,
		Token:     uuid.NewString(),
		ExpiresAt: time.Now().Add(30 * time.Minute),
	}
	if err := s.userRepo.CreatePasswordReset(reset); err != nil {
		return err
	}

	resetURL := buildResetPasswordURL(reset.Token)
	if err := mailerPkg.SendPasswordResetEmail(user.Email, user.FullName, resetURL); err != nil {
		log.Printf("password reset email fallback for %s: %s", user.Email, resetURL)
		if !errors.Is(err, mailerPkg.ErrMailerNotConfigured) {
			return err
		}
	}

	return nil
}

func (s *authService) ResetPassword(token, password string) error {
	reset, err := s.userRepo.FindPasswordResetByToken(token)
	if err != nil {
		return err
	}
	if reset == nil || reset.IsUsed || time.Now().After(reset.ExpiresAt) {
		return errors.New("reset token is invalid or expired")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return err
	}

	if err := s.userRepo.UpdatePassword(reset.UserID.String(), string(hashedPassword)); err != nil {
		return err
	}

	return s.userRepo.MarkPasswordResetUsed(token)
}

func (s *authService) issueTokens(user *model.User) (string, string, error) {
	jwtSecret, err := jwtSecret()
	if err != nil {
		return "", "", err
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  user.ID.String(),
		"role": user.Role,
		"jti":  uuid.NewString(),
		"exp":  time.Now().Add(15 * time.Minute).Unix(),
	})
	acToken, err := accessToken.SignedString([]byte(jwtSecret))
	if err != nil {
		return "", "", err
	}

	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": user.ID.String(),
		"jti": uuid.NewString(),
		"exp": time.Now().Add(7 * 24 * time.Hour).Unix(),
	})
	rfToken, err := refreshToken.SignedString([]byte(jwtSecret))
	if err != nil {
		return "", "", err
	}

	return acToken, rfToken, nil
}

func parseToken(tokenString string) (jwt.MapClaims, error) {
	secret, err := jwtSecret()
	if err != nil {
		return nil, err
	}
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return nil, errors.New("invalid or expired token")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("invalid token claims")
	}
	return claims, nil
}

func jwtSecret() (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		if config.IsProduction() {
			return "", errors.New("JWT_SECRET is required in production")
		}
		secret = "supersecretkey"
	}
	return secret, nil
}

func buildResetPasswordURL(token string) string {
	baseURL := os.Getenv("FRONTEND_URL")
	if baseURL == "" {
		baseURL = os.Getenv("APP_URL")
	}
	if baseURL == "" {
		baseURL = "http://localhost:3000"
	}

	return fmt.Sprintf("%s/reset-password?token=%s", baseURL, token)
}
