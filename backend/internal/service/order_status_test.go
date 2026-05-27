package service

import "testing"

func TestCanTransitionOrder(t *testing.T) {
	allowed := [][2]string{
		{"PAID", "PROCESSING"},
		{"PROCESSING", "SHIPPED"},
		{"SHIPPED", "DELIVERED"},
		{"DELIVERED", "COMPLETED"},
		{"PENDING_PAYMENT", "CANCELLED"},
		{"RETURN_REQUESTED", "RETURN_APPROVED"},
		{"RETURN_APPROVED", "REFUNDED"},
	}
	for _, pair := range allowed {
		if !canTransitionOrder(pair[0], pair[1]) {
			t.Fatalf("expected transition %s -> %s to be allowed", pair[0], pair[1])
		}
	}

	blocked := [][2]string{
		{"PENDING_PAYMENT", "SHIPPED"},
		{"PAID", "DELIVERED"},
		{"PROCESSING", "COMPLETED"},
		{"CANCELLED", "PAID"},
		{"SHIPPED", "PROCESSING"},
		{"COMPLETED", "SHIPPED"},
		{"PAID", "NOT_A_STATUS"},
	}
	for _, pair := range blocked {
		if canTransitionOrder(pair[0], pair[1]) {
			t.Fatalf("expected transition %s -> %s to be blocked", pair[0], pair[1])
		}
	}
}
