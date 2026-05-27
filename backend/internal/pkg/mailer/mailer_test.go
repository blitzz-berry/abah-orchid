package mailer

import "testing"

func TestSendPasswordResetEmailRequiresSMTPConfiguration(t *testing.T) {
	t.Setenv("SMTP_HOST", "")
	t.Setenv("SMTP_PORT", "")
	t.Setenv("SMTP_USERNAME", "")
	t.Setenv("SMTP_PASSWORD", "")
	t.Setenv("SMTP_FROM", "")

	err := SendPasswordResetEmail("buyer@example.com", "Buyer", "https://orchidmart.test/reset?token=abc")
	if err != ErrMailerNotConfigured {
		t.Fatalf("SendPasswordResetEmail() error = %v, want ErrMailerNotConfigured", err)
	}
}

func TestSendPaymentConfirmedEmailRequiresSMTPConfiguration(t *testing.T) {
	t.Setenv("SMTP_HOST", "")
	t.Setenv("SMTP_PORT", "")
	t.Setenv("SMTP_USERNAME", "")
	t.Setenv("SMTP_PASSWORD", "")
	t.Setenv("SMTP_FROM", "")

	err := SendPaymentConfirmedEmail("buyer@example.com", "Buyer", "ORD-001", 125000)
	if err != ErrMailerNotConfigured {
		t.Fatalf("SendPaymentConfirmedEmail() error = %v, want ErrMailerNotConfigured", err)
	}
}

func TestSendOrderShippedEmailRequiresSMTPConfiguration(t *testing.T) {
	t.Setenv("SMTP_HOST", "")
	t.Setenv("SMTP_PORT", "")
	t.Setenv("SMTP_USERNAME", "")
	t.Setenv("SMTP_PASSWORD", "")
	t.Setenv("SMTP_FROM", "")

	err := SendOrderShippedEmail("buyer@example.com", "Buyer", "ORD-001", "jne", "RESI-001")
	if err != ErrMailerNotConfigured {
		t.Fatalf("SendOrderShippedEmail() error = %v, want ErrMailerNotConfigured", err)
	}
}

func TestDecisionEmailsRequireSMTPConfiguration(t *testing.T) {
	t.Setenv("SMTP_HOST", "")
	t.Setenv("SMTP_PORT", "")
	t.Setenv("SMTP_USERNAME", "")
	t.Setenv("SMTP_PASSWORD", "")
	t.Setenv("SMTP_FROM", "")

	tests := []struct {
		name string
		send func() error
	}{
		{name: "order cancelled", send: func() error {
			return SendOrderCancelledEmail("buyer@example.com", "Buyer", "ORD-001", "CANCELLED", "Stok habis")
		}},
		{name: "cancellation decision", send: func() error {
			return SendCancellationDecisionEmail("buyer@example.com", "Buyer", "ORD-001", false, "PAID", "Sudah diproses")
		}},
		{name: "return decision", send: func() error {
			return SendReturnDecisionEmail("buyer@example.com", "Buyer", "ORD-001", true, "Disetujui")
		}},
		{name: "refund", send: func() error {
			return SendRefundCompletedEmail("buyer@example.com", "Buyer", "ORD-001", "Retur diterima", 125000)
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := tt.send(); err != ErrMailerNotConfigured {
				t.Fatalf("send email error = %v, want ErrMailerNotConfigured", err)
			}
		})
	}
}

func TestSendPasswordResetEmailRejectsCRLFInjection(t *testing.T) {
	setSMTPEnv(t)

	err := SendPasswordResetEmail("buyer@example.com\r\nBcc:evil@example.com", "Buyer", "https://orchidmart.test/reset?token=abc")
	if err == nil || err.Error() != "invalid mail fields" {
		t.Fatalf("SendPasswordResetEmail() error = %v, want invalid mail fields", err)
	}
}

func TestSendPasswordResetEmailRejectsInvalidResetURL(t *testing.T) {
	setSMTPEnv(t)

	err := SendPasswordResetEmail("buyer@example.com", "Buyer", "not-a-url")
	if err == nil || err.Error() != "invalid reset url" {
		t.Fatalf("SendPasswordResetEmail() error = %v, want invalid reset url", err)
	}
}

func TestSendPasswordResetEmailRejectsInvalidFromAddress(t *testing.T) {
	setSMTPEnv(t)
	t.Setenv("SMTP_FROM", "invalid-from-address")

	err := SendPasswordResetEmail("buyer@example.com", "Buyer", "https://orchidmart.test/reset?token=abc")
	if err == nil || err.Error() != "invalid from address" {
		t.Fatalf("SendPasswordResetEmail() error = %v, want invalid from address", err)
	}
}

func TestSendPasswordResetEmailRejectsInvalidRecipientAddress(t *testing.T) {
	setSMTPEnv(t)

	err := SendPasswordResetEmail("invalid-recipient", "Buyer", "https://orchidmart.test/reset?token=abc")
	if err == nil || err.Error() != "invalid to address" {
		t.Fatalf("SendPasswordResetEmail() error = %v, want invalid to address", err)
	}
}

func TestSanitizeHeaderValueRejectsCRLF(t *testing.T) {
	if got := sanitizeHeaderValue("Buyer\r\nX-Test: injected"); got != "" {
		t.Fatalf("sanitizeHeaderValue() = %q, want empty string", got)
	}
}

func setSMTPEnv(t *testing.T) {
	t.Helper()
	t.Setenv("SMTP_HOST", "smtp.example.com")
	t.Setenv("SMTP_PORT", "587")
	t.Setenv("SMTP_USERNAME", "mailer-user")
	t.Setenv("SMTP_PASSWORD", "mailer-pass")
	t.Setenv("SMTP_FROM", "OrchidMart <noreply@example.com>")
}
