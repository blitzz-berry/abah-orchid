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

func (r *fakeUserRepo) RevokeRefreshTokensForUser(userID string) error {
	for _, token := range r.refreshTokens {
		if token != nil && token.UserID.String() == userID {
			token.IsRevoked = true
		}
	}
	return nil
}

func TestAuthServiceRegisterHashesPasswordAndRejectsDuplicateEmail(t *testing.T) {
	repo := newFakeUserRepo()
	svc := NewAuthService(repo)
	password := uuid.NewString()

	user, err := svc.Register(" Buyer@Example.COM ", password, "Buyer", "081234")
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}
	if user.Email != "buyer@example.com" {
		t.Fatalf("Register() stored email = %q, want normalized lowercase email", user.Email)
	}
	if user.PasswordHash == password {
		t.Fatal("Register() stored plaintext password")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		t.Fatalf("registered password hash does not match original password: %v", err)
	}

	if _, err := svc.Register("buyer@example.com", password, "Other", "080000"); err == nil {
		t.Fatal("Register() expected duplicate email error")
	}
}

func TestAuthServiceLoginAndRefreshRotateRefreshToken(t *testing.T) {
	t.Setenv("JWT_SECRET", uuid.NewString()+uuid.NewString())

	repo := newFakeUserRepo()
	password := uuid.NewString()
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
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
	wrongPassword := uuid.NewString()
	if _, _, _, err := svc.Login(user.Email, wrongPassword); err == nil {
		t.Fatal("Login() expected invalid password error")
	}

	_, accessToken, refreshToken, err := svc.Login(user.Email, password)
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
	token := uuid.NewString()
	repo.passwordReset = &model.PasswordReset{
		UserID:    user.ID,
		Token:     token,
		ExpiresAt: time.Now().Add(time.Hour),
	}

	svc := NewAuthService(repo)
	newPassword := uuid.NewString()
	if err := svc.ResetPassword(token, newPassword); err != nil {
		t.Fatalf("ResetPassword() error = %v", err)
	}
	if !repo.passwordReset.IsUsed {
		t.Fatal("ResetPassword() did not mark token as used")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(newPassword)); err != nil {
		t.Fatalf("ResetPassword() did not store matching password hash: %v", err)
	}

	if err := svc.ResetPassword(token, uuid.NewString()); err == nil {
		t.Fatal("ResetPassword() accepted an already used reset token")
	}
}

func TestAuthServiceResetPasswordRejectsExpiredToken(t *testing.T) {
	repo := newFakeUserRepo()
	user := &model.User{ID: uuid.New(), Email: "buyer@example.com", IsActive: true}
	repo.usersByID[user.ID.String()] = user
	token := uuid.NewString()
	repo.passwordReset = &model.PasswordReset{
		UserID:    user.ID,
		Token:     token,
		ExpiresAt: time.Now().Add(-time.Minute),
	}

	svc := NewAuthService(repo)
	if err := svc.ResetPassword(token, uuid.NewString()); err == nil {
		t.Fatal("ResetPassword() accepted an expired reset token")
	}
	if repo.passwordReset.IsUsed {
		t.Fatal("ResetPassword() marked an expired token as used")
	}
	if user.PasswordHash != "" {
		t.Fatal("ResetPassword() changed password for an expired token")
	}
}

func TestAuthServiceRequestPasswordResetReturnsDevURLWhenMailerIsNotConfigured(t *testing.T) {
	t.Setenv("APP_ENV", "")
	t.Setenv("FRONTEND_URL", "http://localhost:3000")
	t.Setenv("SMTP_HOST", "")
	t.Setenv("SMTP_PORT", "")
	t.Setenv("SMTP_USERNAME", "")
	t.Setenv("SMTP_PASSWORD", "")
	t.Setenv("SMTP_FROM", "")

	repo := newFakeUserRepo()
	user := &model.User{
		ID:       uuid.New(),
		Email:    "buyer@example.com",
		FullName: "Buyer",
		IsActive: true,
	}
	repo.usersByID[user.ID.String()] = user
	repo.usersByEmail[user.Email] = user

	svc := NewAuthService(repo)
	result, err := svc.RequestPasswordReset(" Buyer@Example.COM ")
	if err != nil {
		t.Fatalf("RequestPasswordReset() error = %v", err)
	}
	if result == nil || result.ResetURL == "" {
		t.Fatal("RequestPasswordReset() did not return dev reset URL")
	}
	if result.EmailSent {
		t.Fatal("RequestPasswordReset() reported email sent without configured SMTP")
	}
	if repo.passwordReset == nil {
		t.Fatal("RequestPasswordReset() did not persist reset token")
	}
	timeUntilExpiry := time.Until(repo.passwordReset.ExpiresAt)
	if timeUntilExpiry <= 29*time.Minute || timeUntilExpiry > passwordResetTTL {
		t.Fatalf("RequestPasswordReset() expiry = %v, want about %v", timeUntilExpiry, passwordResetTTL)
	}
	if want := "http://localhost:3000/reset-password?token=" + repo.passwordReset.Token; result.ResetURL != want {
		t.Fatalf("RequestPasswordReset() reset URL = %q, want %q", result.ResetURL, want)
	}
}
