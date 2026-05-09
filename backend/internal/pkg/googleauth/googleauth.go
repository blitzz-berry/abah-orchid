package googleauth

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"
)

const googleCertsURL = "https://www.googleapis.com/oauth2/v3/certs"

type Claims struct {
	Subject       string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	Issuer        string `json:"iss"`
	Audience      string `json:"aud"`
	ExpiresAt     int64  `json:"exp"`
}

type jwtHeader struct {
	Algorithm string `json:"alg"`
	KeyID     string `json:"kid"`
}

type jwksResponse struct {
	Keys []jwk `json:"keys"`
}

type jwk struct {
	KeyID     string `json:"kid"`
	KeyType   string `json:"kty"`
	Algorithm string `json:"alg"`
	Use       string `json:"use"`
	Modulus   string `json:"n"`
	Exponent  string `json:"e"`
}

var cache = struct {
	sync.Mutex
	expiresAt time.Time
	keys      map[string]*rsa.PublicKey
}{keys: map[string]*rsa.PublicKey{}}

func VerifyIDToken(ctx context.Context, token string, audience string) (*Claims, error) {
	token = strings.TrimSpace(token)
	audience = strings.TrimSpace(audience)
	if token == "" {
		return nil, errors.New("token Google tidak boleh kosong")
	}
	if audience == "" {
		return nil, errors.New("GOOGLE_CLIENT_ID belum dikonfigurasi")
	}

	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, errors.New("token Google tidak valid")
	}

	var header jwtHeader
	if err := decodeSegment(parts[0], &header); err != nil {
		return nil, errors.New("header token Google tidak valid")
	}
	if header.Algorithm != "RS256" || header.KeyID == "" {
		return nil, errors.New("metode tanda tangan token Google tidak didukung")
	}

	keys, err := googleKeys(ctx)
	if err != nil {
		return nil, err
	}
	key := keys[header.KeyID]
	if key == nil {
		cache.Lock()
		cache.expiresAt = time.Time{}
		cache.Unlock()
		keys, err = googleKeys(ctx)
		if err != nil {
			return nil, err
		}
		key = keys[header.KeyID]
	}
	if key == nil {
		return nil, errors.New("kunci verifikasi token Google tidak ditemukan")
	}

	signedContent := parts[0] + "." + parts[1]
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, errors.New("tanda tangan token Google tidak valid")
	}
	sum := sha256.Sum256([]byte(signedContent))
	if err := rsa.VerifyPKCS1v15(key, crypto.SHA256, sum[:], signature); err != nil {
		return nil, errors.New("tanda tangan token Google tidak valid")
	}

	var claims Claims
	if err := decodeSegment(parts[1], &claims); err != nil {
		return nil, errors.New("payload token Google tidak valid")
	}
	if claims.Issuer != "accounts.google.com" && claims.Issuer != "https://accounts.google.com" {
		return nil, errors.New("penerbit token Google tidak valid")
	}
	if claims.Audience != audience {
		return nil, errors.New("audience token Google tidak sesuai")
	}
	if claims.ExpiresAt <= time.Now().Unix() {
		return nil, errors.New("token Google sudah kedaluwarsa")
	}
	if claims.Email == "" || !claims.EmailVerified {
		return nil, errors.New("email Google belum terverifikasi")
	}

	return &claims, nil
}

func decodeSegment(segment string, target any) error {
	raw, err := base64.RawURLEncoding.DecodeString(segment)
	if err != nil {
		return err
	}
	return json.Unmarshal(raw, target)
}

func googleKeys(ctx context.Context) (map[string]*rsa.PublicKey, error) {
	cache.Lock()
	if time.Now().Before(cache.expiresAt) && len(cache.keys) > 0 {
		keys := cache.keys
		cache.Unlock()
		return keys, nil
	}
	cache.Unlock()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, googleCertsURL, nil)
	if err != nil {
		return nil, err
	}
	client := &http.Client{Timeout: 10 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return nil, errors.New("gagal mengambil kunci verifikasi Google")
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, errors.New("gagal mengambil kunci verifikasi Google")
	}

	var payload jwksResponse
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		return nil, errors.New("respons kunci Google tidak valid")
	}

	keys := make(map[string]*rsa.PublicKey, len(payload.Keys))
	for _, item := range payload.Keys {
		if item.KeyType != "RSA" || item.KeyID == "" || item.Modulus == "" || item.Exponent == "" {
			continue
		}
		key, err := rsaKey(item.Modulus, item.Exponent)
		if err != nil {
			continue
		}
		keys[item.KeyID] = key
	}
	if len(keys) == 0 {
		return nil, errors.New("kunci verifikasi Google tidak tersedia")
	}

	cache.Lock()
	cache.keys = keys
	cache.expiresAt = time.Now().Add(time.Hour)
	cache.Unlock()
	return keys, nil
}

func rsaKey(modulus string, exponent string) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(modulus)
	if err != nil {
		return nil, err
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(exponent)
	if err != nil {
		return nil, err
	}
	e := 0
	for _, b := range eBytes {
		e = e<<8 + int(b)
	}
	if e == 0 {
		return nil, errors.New("eksponen RSA tidak valid")
	}
	return &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: e}, nil
}
