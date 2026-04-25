package request

type CheckoutRequest struct {
	ShippingName       string  `json:"shipping_name" binding:"required"`
	ShippingPhone      string  `json:"shipping_phone" binding:"required"`
	ShippingAddress    string  `json:"shipping_address" binding:"required"`
	ShippingCity       string  `json:"shipping_city" binding:"required"`
	ShippingProvince   string  `json:"shipping_province" binding:"required"`
	ShippingPostalCode string  `json:"shipping_postal_code" binding:"required"`
	CourierCode        string  `json:"courier_code" binding:"required"`
	CourierService     string  `json:"courier_service" binding:"required"`
	ShippingCost       float64 `json:"shipping_cost" binding:"required"`
	ShippingInsurance  bool    `json:"shipping_insurance"`
	InsuranceCost      float64 `json:"insurance_cost"`
	PackingType        string  `json:"packing_type"`
	PackingCost        float64 `json:"packing_cost"`
	LivePlantNote      string  `json:"live_plant_note"`
	CouponCode         string  `json:"coupon_code"`
	PaymentMethod      string  `json:"payment_method"`
	Note               string  `json:"note"`
}

type MidtransWebhookRequest struct {
	TransactionTime   string `json:"transaction_time"`
	TransactionStatus string `json:"transaction_status"`
	TransactionID     string `json:"transaction_id"`
	StatusMessage     string `json:"status_message"`
	StatusCode        string `json:"status_code"`
	SignatureKey      string `json:"signature_key"`
	PaymentType       string `json:"payment_type"`
	OrderID           string `json:"order_id"`
	MerchantID        string `json:"merchant_id"`
	GrossAmount       string `json:"gross_amount"`
	FraudStatus       string `json:"fraud_status"`
	Currency          string `json:"currency"`
}
