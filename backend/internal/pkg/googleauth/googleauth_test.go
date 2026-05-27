package googleauth

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestVerifyIDTokenRejectsEmptyToken(t *testing.T) {
	if _, err := VerifyIDToken(context.Background(), "   ", "client-id"); err == nil || err.Error() != "token Google tidak boleh kosong" {
		t.Fatalf("VerifyIDToken() error = %v, want empty token error", err)
	}
}

func TestVerifyIDTokenRejectsMissingAudience(t *testing.T) {
	if _, err := VerifyIDToken(context.Background(), "a.b.c", "   "); err == nil || err.Error() != "GOOGLE_CLIENT_ID belum dikonfigurasi" {
		t.Fatalf("VerifyIDToken() error = %v, want missing audience error", err)
	}
}

func TestVerifyIDTokenAcceptsValidCachedKey(t *testing.T) {
	key := mustGenerateRSAKey(t)
	restore := installGoogleKeyCache("kid-valid", &key.PublicKey)
	defer restore()

	token := mustSignGoogleToken(t, key, "kid-valid", Claims{
		Subject:       "user-1",
		Email:         "buyer@example.com",
		EmailVerified: true,
		Name:          "Buyer",
		Issuer:        "https://accounts.google.com",
		Audience:      "client-id",
		ExpiresAt:     time.Now().Add(time.Hour).Unix(),
	})

	claims, err := VerifyIDToken(context.Background(), token, "client-id")
	if err != nil {
		t.Fatalf("VerifyIDToken() error = %v", err)
	}
	if claims.Email != "buyer@example.com" {
		t.Fatalf("VerifyIDToken() email = %q, want buyer@example.com", claims.Email)
	}
}

func TestVerifyIDTokenRejectsAudienceMismatch(t *testing.T) {
	key := mustGenerateRSAKey(t)
	restore := installGoogleKeyCache("kid-aud", &key.PublicKey)
	defer restore()

	token := mustSignGoogleToken(t, key, "kid-aud", Claims{
		Email:         "buyer@example.com",
		EmailVerified: true,
		Issuer:        "https://accounts.google.com",
		Audience:      "wrong-client",
		ExpiresAt:     time.Now().Add(time.Hour).Unix(),
	})

	if _, err := VerifyIDToken(context.Background(), token, "client-id"); err == nil || err.Error() != "audience token Google tidak sesuai" {
		t.Fatalf("VerifyIDToken() error = %v, want audience mismatch", err)
	}
}

func TestVerifyIDTokenRejectsUnverifiedEmail(t *testing.T) {
	key := mustGenerateRSAKey(t)
	restore := installGoogleKeyCache("kid-email", &key.PublicKey)
	defer restore()

	token := mustSignGoogleToken(t, key, "kid-email", Claims{
		Email:         "buyer@example.com",
		EmailVerified: false,
		Issuer:        "https://accounts.google.com",
		Audience:      "client-id",
		ExpiresAt:     time.Now().Add(time.Hour).Unix(),
	})

	if _, err := VerifyIDToken(context.Background(), token, "client-id"); err == nil || err.Error() != "email Google belum terverifikasi" {
		t.Fatalf("VerifyIDToken() error = %v, want unverified email", err)
	}
}

func TestVerifyIDTokenRejectsExpiredToken(t *testing.T) {
	key := mustGenerateRSAKey(t)
	restore := installGoogleKeyCache("kid-expired", &key.PublicKey)
	defer restore()

	token := mustSignGoogleToken(t, key, "kid-expired", Claims{
		Email:         "buyer@example.com",
		EmailVerified: true,
		Issuer:        "https://accounts.google.com",
		Audience:      "client-id",
		ExpiresAt:     time.Now().Add(-time.Minute).Unix(),
	})

	if _, err := VerifyIDToken(context.Background(), token, "client-id"); err == nil || err.Error() != "token Google sudah kedaluwarsa" {
		t.Fatalf("VerifyIDToken() error = %v, want expired token", err)
	}
}

func TestVerifyIDTokenRejectsInvalidIssuer(t *testing.T) {
	key := mustGenerateRSAKey(t)
	restore := installGoogleKeyCache("kid-issuer", &key.PublicKey)
	defer restore()

	token := mustSignGoogleToken(t, key, "kid-issuer", Claims{
		Email:         "buyer@example.com",
		EmailVerified: true,
		Issuer:        "https://evil.example.com",
		Audience:      "client-id",
		ExpiresAt:     time.Now().Add(time.Hour).Unix(),
	})

	if _, err := VerifyIDToken(context.Background(), token, "client-id"); err == nil || err.Error() != "penerbit token Google tidak valid" {
		t.Fatalf("VerifyIDToken() error = %v, want invalid issuer", err)
	}
}

func mustGenerateRSAKey(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}
	return key
}

func installGoogleKeyCache(kid string, key *rsa.PublicKey) func() {
	cache.Lock()
	previousKeys := cache.keys
	previousExpiresAt := cache.expiresAt
	cache.keys = map[string]*rsa.PublicKey{kid: key}
	cache.expiresAt = time.Now().Add(time.Hour)
	cache.Unlock()

	return func() {
		cache.Lock()
		cache.keys = previousKeys
		cache.expiresAt = previousExpiresAt
		cache.Unlock()
	}
}

func mustSignGoogleToken(t *testing.T, key *rsa.PrivateKey, kid string, claims Claims) string {
	t.Helper()

	headerJSON, err := json.Marshal(jwtHeader{
		Algorithm: "RS256",
		KeyID:     kid,
	})
	if err != nil {
		t.Fatalf("Marshal(header) error = %v", err)
	}
	payloadJSON, err := json.Marshal(claims)
	if err != nil {
		t.Fatalf("Marshal(claims) error = %v", err)
	}

	header := base64.RawURLEncoding.EncodeToString(headerJSON)
	payload := base64.RawURLEncoding.EncodeToString(payloadJSON)
	signedContent := header + "." + payload
	sum := sha256.Sum256([]byte(signedContent))
	signature, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, sum[:])
	if err != nil {
		t.Fatalf("SignPKCS1v15() error = %v", err)
	}

	return strings.Join([]string{
		header,
		payload,
		base64.RawURLEncoding.EncodeToString(signature),
	}, ".")
}
