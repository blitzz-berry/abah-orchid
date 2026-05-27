package tokenhash

import "testing"

func TestHashReturnsStableSHA256Hex(t *testing.T) {
	token := "refresh-token-123"

	first := Hash(token)
	second := Hash(token)

	if first == "" {
		t.Fatal("Hash() returned empty hash for non-empty token")
	}
	if first != second {
		t.Fatalf("Hash() should be stable, got %q and %q", first, second)
	}
	if len(first) != 64 {
		t.Fatalf("Hash() length = %d, want 64 hex chars", len(first))
	}
}

func TestHashTrimsWhitespaceBeforeHashing(t *testing.T) {
	trimmed := Hash("refresh-token-123")
	withWhitespace := Hash("  refresh-token-123 \n")

	if trimmed != withWhitespace {
		t.Fatalf("Hash() trimmed = %q, with whitespace = %q, want equal", trimmed, withWhitespace)
	}
}

func TestHashReturnsEmptyStringForBlankToken(t *testing.T) {
	if got := Hash("   "); got != "" {
		t.Fatalf("Hash() = %q, want empty string", got)
	}
}
