package storage

import "testing"

func TestPaymentProofAccessPath(t *testing.T) {
	got := paymentProofAccessPath("payment-proofs/order-id/file.pdf")
	want := "/api/v1/payments/order-id/proof-file/file.pdf"
	if got != want {
		t.Fatalf("paymentProofAccessPath() = %q, want %q", got, want)
	}
}

func TestS3BucketRequiresSeparatePaymentProofBucketInProduction(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("S3_BUCKET", "orchidmart-images")
	t.Setenv("S3_PAYMENT_PROOF_BUCKET", "orchidmart-images")

	if _, err := s3Bucket(true); err == nil {
		t.Fatal("s3Bucket(true) error = nil, want error")
	}
}

func TestS3BucketAllowsSeparatePaymentProofBucketInProduction(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("S3_BUCKET", "orchidmart-images")
	t.Setenv("S3_PAYMENT_PROOF_BUCKET", "orchidmart-payment-proofs")

	got, err := s3Bucket(true)
	if err != nil {
		t.Fatalf("s3Bucket(true) error = %v", err)
	}
	if got != "orchidmart-payment-proofs" {
		t.Fatalf("s3Bucket(true) = %q, want orchidmart-payment-proofs", got)
	}
}

func TestS3UseSSLRejectsExternalInsecureProductionEndpoint(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("S3_USE_SSL", "false")

	if _, err := s3UseSSL("s3.example.com"); err == nil {
		t.Fatal("s3UseSSL() error = nil, want error")
	}
}

func TestS3UseSSLAllowsPrivateInsecureProductionEndpoint(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("S3_USE_SSL", "false")

	got, err := s3UseSSL("minio:9000")
	if err != nil {
		t.Fatalf("s3UseSSL() error = %v", err)
	}
	if got {
		t.Fatal("s3UseSSL() = true, want false")
	}
}
