package service

import (
	"reflect"
	"testing"

	"github.com/midtrans/midtrans-go/snap"
)

func TestNormalizePaymentMethod(t *testing.T) {
	tests := map[string]string{
		"":                     "midtrans",
		"midtrans_all":         "midtrans",
		"bank_transfer":        "manual_bank_transfer",
		"bank_transfer_manual": "manual_bank_transfer",
		"virtual_account":      "midtrans_bank_transfer",
		"ewallet":              "midtrans_ewallet",
		"credit_card":          "midtrans_card",
	}

	for input, want := range tests {
		t.Run(input, func(t *testing.T) {
			if got := normalizePaymentMethod(input); got != want {
				t.Fatalf("normalizePaymentMethod(%q) = %q, want %q", input, got, want)
			}
		})
	}
}

func TestEnabledSnapPaymentsRestrictsChannelByMethod(t *testing.T) {
	tests := []struct {
		name   string
		method string
		want   []snap.SnapPaymentType
	}{
		{
			name:   "virtual account",
			method: "midtrans_bank_transfer",
			want: []snap.SnapPaymentType{
				snap.PaymentTypeBankTransfer,
				snap.PaymentTypeBCAVA,
				snap.PaymentTypeBNIVA,
				snap.PaymentTypeBRIVA,
				snap.PaymentTypePermataVA,
				snap.PaymentTypeEChannel,
			},
		},
		{
			name:   "ewallet",
			method: "midtrans_ewallet",
			want:   []snap.SnapPaymentType{snap.PaymentTypeGopay, snap.PaymentTypeShopeepay},
		},
		{
			name:   "card",
			method: "midtrans_card",
			want:   []snap.SnapPaymentType{snap.PaymentTypeCreditCard},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := enabledSnapPayments(tt.method); !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("enabledSnapPayments(%q) = %#v, want %#v", tt.method, got, tt.want)
			}
		})
	}
}

func TestTrustedPaymentProofURL(t *testing.T) {
	t.Setenv("UPLOAD_PUBLIC_URL", "https://orchidmart.example.com/uploads")
	t.Setenv("S3_PUBLIC_URL", "https://orchidmart.example.com/media/orchidmart-images")

	tests := []struct {
		name  string
		value string
		want  bool
	}{
		{name: "legacy local upload path", value: "/uploads/payment-proofs/order-id/file.jpg", want: false},
		{name: "protected api path", value: "/api/v1/payments/order-id/proof-file/file.jpg", want: true},
		{name: "configured upload origin", value: "https://orchidmart.example.com/uploads/payment-proofs/order-id/file.jpg", want: false},
		{name: "configured s3 public origin", value: "https://orchidmart.example.com/media/orchidmart-images/payment-proofs/order-id/file.pdf", want: false},
		{name: "external origin", value: "https://evil.example/payment-proofs/order-id/file.jpg", want: false},
		{name: "wrong storage folder", value: "https://orchidmart.example.com/uploads/products/order-id/file.jpg", want: false},
		{name: "empty", value: "", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isTrustedPaymentProofURL(tt.value); got != tt.want {
				t.Fatalf("isTrustedPaymentProofURL(%q) = %v, want %v", tt.value, got, tt.want)
			}
		})
	}
}
