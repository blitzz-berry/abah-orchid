package realtime

import (
	"testing"
	"time"
)

func TestOrderChangedPublishesToCustomerAndAdmin(t *testing.T) {
	hub := NewHub()
	customer, unsubscribeCustomer := hub.Subscribe("customer-1", "customer")
	defer unsubscribeCustomer()
	admin, unsubscribeAdmin := hub.Subscribe("admin-1", "admin")
	defer unsubscribeAdmin()
	other, unsubscribeOther := hub.Subscribe("customer-2", "customer")
	defer unsubscribeOther()

	hub.OrderChanged("customer-1", "order-1", "PAID")

	assertEvent(t, customer, EventOrderChanged, "order-1", "PAID")
	assertEvent(t, admin, EventOrderChanged, "order-1", "PAID")
	select {
	case event := <-other:
		t.Fatalf("unrelated customer received event: %+v", event)
	default:
	}
}

func TestNotificationCreatedPublishesOnlyToTargetUser(t *testing.T) {
	hub := NewHub()
	target, unsubscribeTarget := hub.Subscribe("admin-1", "admin")
	defer unsubscribeTarget()
	other, unsubscribeOther := hub.Subscribe("admin-2", "admin")
	defer unsubscribeOther()

	hub.NotificationCreated("admin-1", "order-1")

	assertEvent(t, target, EventNotificationCreated, "order-1", "")
	select {
	case event := <-other:
		t.Fatalf("unrelated user received notification event: %+v", event)
	default:
	}
}

func assertEvent(t *testing.T, events <-chan Event, eventType, orderID, status string) {
	t.Helper()
	select {
	case event := <-events:
		if event.Type != eventType || event.OrderID != orderID || event.Status != status {
			t.Fatalf("event = %+v, want type=%q order=%q status=%q", event, eventType, orderID, status)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for event")
	}
}
