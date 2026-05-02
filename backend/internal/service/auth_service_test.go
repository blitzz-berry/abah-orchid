package service

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"orchidmart-backend/internal/model"
)

type fakeUserRepo struct {
	usersByID     map[string]*model.User
	usersByEmail  map[string]*model.User
	refreshTokens map[string]*model.RefreshToken
	passwordReset *model.PasswordReset
}

func newFakeUserRepo() *fakeUserRepo {
	return &fakeUserRepo{
		usersByID:     map[string]*model.User{},
		usersByEmail:  map[string]*model.User{},
		refreshTokens: map[string]*model.RefreshToken{},
	}
}

func (r *fakeUserRepo) CreateUser(user *model.User) error {
	if user.ID == uuid.Nil {
		user.ID = uuid.New()
	}
	user.IsActive = true
	r.usersByID[user.ID.String()] = user
	r.usersByEmail[user.Email] = user
	return nil
}

func (r *fakeUserRepo) FindByEmail(email string) (*model.User, error) {
	return r.usersByEmail[email], nil
}

func (r *fakeUserRepo) FindByID(id string) (*model.User, error) {
	return r.usersByID[id], nil
}

func (r *fakeUserRepo) UpdateProfile(id, fullName, phone string) (*model.User, error) {
	user := r.usersByID[id]
	user.FullName = fullName
	user.Phone = phone
	return user, nil
}

func (r *fakeUserRepo) GetAddressesByUserID(string) ([]model.Address, error) {
	return nil, nil
}

func (r *fakeUserRepo) CreateAddress(*model.Address) error {
	return nil
}

func (r *fakeUserRepo) UpdateAddress(string, string, *model.Address) (*model.Address, error) {
	return nil, nil
}

func (r *fakeUserRepo) DeleteAddress(string, string) error {
	return nil
}

func (r *fakeUserRepo) SetDefaultAddress(string, string) error {
	return nil
}

func (r *fakeUserRepo) CreatePasswordReset(reset *model.PasswordReset) error {
	r.passwordReset = reset
	return nil
}

func (r *fakeUserRepo) FindPasswordResetByToken(token string) (*model.PasswordReset, error) {
	if r.passwordReset != nil && r.passwordReset.Token == token {
		return r.passwordReset, nil
	}
	return nil, nil
}

func (r *fakeUserRepo) MarkPasswordResetUsed(token string) error {
	if r.passwordReset != nil && r.passwordReset.Token == token {
		r.passwordReset.IsUsed = true
	}
	return nil
}

func (r *fakeUserRepo) UpdatePassword(userID string, hashedPassword string) error {
	r.usersByID[userID].PasswordHash = hashedPassword
	return nil
}

func (r *fakeUserRepo) CreateRefreshToken(token *model.RefreshToken) error {
	r.refreshTokens[token.Token] = token
	return nil
}

func (r *fakeUserRepo) FindRefreshToken(token string) (*model.RefreshToken, error) {
	return r.refreshTokens[token], nil
}

func (r *fakeUserRepo) RevokeRefreshToken(token string) error {
	if stored := r.refreshTokens[token]; stored != nil {
		stored.IsRevoked = true
	}
	return nil
}

func TestAuthServiceRegisterHashesPasswordAndRejectsDuplicateEmail(t *testing.T) {
	repo := newFakeUserRepo()
	svc := NewAuthService(repo)

	user, err := svc.Register("buyer@example.com", "secret123", "Buyer", "081234")
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}
	if user.PasswordHash == "secret123" {
		t.Fatal("Register() stored plaintext password")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte("secret123")); err != nil {
		t.Fatalf("registered password hash does not match original password: %v", err)
	}

	if _, err := svc.Register("buyer@example.com", "secret123", "Other", "080000"); err == nil {
		t.Fatal("Register() expected duplicate email error")
	}
}

func TestAuthServiceLoginAndRefreshRotateRefreshToken(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-jwt-secret-at-least-32-characters")

	repo := newFakeUserRepo()
	passwordHash, err := bcrypt.GenerateFromPassword([]byte("secret123"), 12)
	if err != nil {
		t.Fatalf("GenerateFromPassword() error = %v", err)
	}
	user := &model.User{
		ID:           uuid.New(),
		Email:        "buyer@example.com",
		PasswordHash: string(passwordHash),
		FullName:     "Buyer",
		Role:         "customer",
		IsActive:     true,
	}
	repo.usersByID[user.ID.String()] = user
	repo.usersByEmail[user.Email] = user

	svc := NewAuthService(repo)
	if _, _, _, err := svc.Login(user.Email, "wrong-password"); err == nil {
		t.Fatal("Login() expected invalid password error")
	}

	_, accessToken, refreshToken, err := svc.Login(user.Email, "secret123")
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}
	if accessToken == "" || refreshToken == "" {
		t.Fatal("Login() returned empty tokens")
	}
	if repo.refreshTokens[refreshToken] == nil {
		t.Fatal("Login() did not persist refresh token")
	}

	_, _, nextRefreshToken, err := svc.Refresh(refreshToken)
	if err != nil {
		t.Fatalf("Refresh() error = %v", err)
	}
	if nextRefreshToken == refreshToken {
		t.Fatal("Refresh() reused the same refresh token; expected rotation")
	}
	if !repo.refreshTokens[refreshToken].IsRevoked {
		t.Fatal("Refresh() did not revoke previous refresh token")
	}
	if repo.refreshTokens[nextRefreshToken] == nil {
		t.Fatal("Refresh() did not persist rotated refresh token")
	}

	if _, _, _, err := svc.Refresh(refreshToken); err == nil {
		t.Fatal("Refresh() accepted a revoked refresh token")
	}
}

func TestAuthServiceResetPasswordUsesTokenOnce(t *testing.T) {
	repo := newFakeUserRepo()
	user := &model.User{ID: uuid.New(), Email: "buyer@example.com", IsActive: true}
	repo.usersByID[user.ID.String()] = user
	repo.passwordReset = &model.PasswordReset{
		UserID:    user.ID,
		Token:     "reset-token",
		ExpiresAt: time.Now().Add(time.Hour),
	}

	svc := NewAuthService(repo)
	if err := svc.ResetPassword("reset-token", "new-secret123"); err != nil {
		t.Fatalf("ResetPassword() error = %v", err)
	}
	if !repo.passwordReset.IsUsed {
		t.Fatal("ResetPassword() did not mark token as used")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte("new-secret123")); err != nil {
		t.Fatalf("ResetPassword() did not store matching password hash: %v", err)
	}

	if err := svc.ResetPassword("reset-token", "another-secret123"); err == nil {
		t.Fatal("ResetPassword() accepted an already used reset token")
	}
}
