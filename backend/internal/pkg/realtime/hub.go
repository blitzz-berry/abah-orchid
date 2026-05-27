package realtime

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	EventOrderChanged        = "order.changed"
	EventPaymentChanged      = "payment.changed"
	EventNotificationCreated = "notification.created"
)

type Event struct {
	Type       string    `json:"type"`
	OrderID    string    `json:"order_id,omitempty"`
	Status     string    `json:"status,omitempty"`
	OccurredAt time.Time `json:"occurred_at"`
}

type Hub struct {
	mu    sync.RWMutex
	users map[string]map[chan Event]struct{}
	roles map[string]map[chan Event]struct{}
}

func NewHub() *Hub {
	return &Hub{
		users: make(map[string]map[chan Event]struct{}),
		roles: make(map[string]map[chan Event]struct{}),
	}
}

func (h *Hub) Subscribe(userID, role string) (<-chan Event, func()) {
	ch := make(chan Event, 16)
	h.mu.Lock()
	if h.users[userID] == nil {
		h.users[userID] = make(map[chan Event]struct{})
	}
	h.users[userID][ch] = struct{}{}
	if role != "" {
		if h.roles[role] == nil {
			h.roles[role] = make(map[chan Event]struct{})
		}
		h.roles[role][ch] = struct{}{}
	}
	h.mu.Unlock()

	return ch, func() {
		h.mu.Lock()
		delete(h.users[userID], ch)
		if len(h.users[userID]) == 0 {
			delete(h.users, userID)
		}
		if role != "" {
			delete(h.roles[role], ch)
			if len(h.roles[role]) == 0 {
				delete(h.roles, role)
			}
		}
		close(ch)
		h.mu.Unlock()
	}
}

func (h *Hub) OrderChanged(userID, orderID, status string) {
	event := newEvent(EventOrderChanged, orderID, status)
	h.publishUser(userID, event)
	h.publishRole("admin", event)
}

func (h *Hub) PaymentChanged(userID, orderID, status string) {
	event := newEvent(EventPaymentChanged, orderID, status)
	h.publishUser(userID, event)
	h.publishRole("admin", event)
}

func (h *Hub) NotificationCreated(userID, orderID string) {
	h.publishUser(userID, newEvent(EventNotificationCreated, orderID, ""))
}

func newEvent(eventType, orderID, status string) Event {
	return Event{
		Type:       eventType,
		OrderID:    orderID,
		Status:     status,
		OccurredAt: time.Now().UTC(),
	}
}

func (h *Hub) publishUser(userID string, event Event) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	h.publish(h.users[userID], event)
}

func (h *Hub) publishRole(role string, event Event) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	h.publish(h.roles[role], event)
}

func (h *Hub) publish(subscribers map[chan Event]struct{}, event Event) {
	for ch := range subscribers {
		select {
		case ch <- event:
		default:
			select {
			case <-ch:
			default:
			}
			select {
			case ch <- event:
			default:
			}
		}
	}
}

type Handler struct {
	hub *Hub
}

func NewHandler(hub *Hub) *Handler {
	return &Handler{hub: hub}
}

func (h *Handler) Stream(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	events, unsubscribe := h.hub.Subscribe(userID, c.GetString("userRole"))
	defer unsubscribe()

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Streaming unsupported"})
		return
	}

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache, no-transform")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")
	c.SSEvent("connected", newEvent("connected", "", ""))
	flusher.Flush()

	heartbeat := time.NewTicker(20 * time.Second)
	defer heartbeat.Stop()

	for {
		select {
		case <-c.Request.Context().Done():
			return
		case event, open := <-events:
			if !open {
				return
			}
			c.SSEvent(event.Type, event)
			flusher.Flush()
		case <-heartbeat.C:
			_, _ = fmt.Fprint(c.Writer, ": heartbeat\n\n")
			flusher.Flush()
		}
	}
}
