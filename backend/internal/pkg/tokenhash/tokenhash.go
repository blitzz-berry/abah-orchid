package tokenhash

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
)

// Hash returns a stable hex-encoded SHA-256 hash for a token value.
// Token values are expected to be high-entropy (random / JWT), so SHA-256 is sufficient.
func Hash(token string) string {
	token = strings.TrimSpace(token)
	if token == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
