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
		"COD":                  "cod",
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
