package rajaongkir

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"orchidmart-backend/internal/config"
	"os"
	"strings"
	"time"
)

const (
	BaseURL        = "https://api.rajaongkir.com/starter"
	dummyAPIKey    = "e1234567890dummyapikey"
	requestTimeout = 10 * time.Second
)

func getAPIKey() string {
	key := os.Getenv("RAJAONGKIR_API_KEY")
	if key == "" {
		if config.IsProduction() {
			log.Fatal("RAJAONGKIR_API_KEY is required in production")
		}
		key = dummyAPIKey
	}
	return key
}

func GetProvinces() (interface{}, error) {
	if shouldUseFallback() {
		return fallbackProvinces(), nil
	}

	req, _ := http.NewRequest("GET", BaseURL+"/province", nil)
	req.Header.Add("key", getAPIKey())

	client := &http.Client{Timeout: requestTimeout}
	res, err := client.Do(req)
	if err != nil {
		return fallbackOnRajaError(fallbackProvinces(), err)
	}
	defer res.Body.Close()

	var result map[string]interface{}
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return fallbackOnRajaError(fallbackProvinces(), err)
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return fallbackOnRajaError(fallbackProvinces(), err)
	}
	if !isRajaOngkirSuccess(result) {
		return fallbackOnRajaError(fallbackProvinces(), fmt.Errorf("rajaongkir provinces request failed"))
	}

	return result, nil
}

func GetCities(provinceID string) (interface{}, error) {
	provinceID = strings.TrimSpace(provinceID)
	if shouldUseFallback() {
		return fallbackCities(provinceID), nil
	}

	req, _ := http.NewRequest("GET", BaseURL+"/city?province="+url.QueryEscape(provinceID), nil)
	req.Header.Add("key", getAPIKey())

	client := &http.Client{Timeout: requestTimeout}
	res, err := client.Do(req)
	if err != nil {
		return fallbackOnRajaError(fallbackCities(provinceID), err)
	}
	defer res.Body.Close()

	var result map[string]interface{}
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return fallbackOnRajaError(fallbackCities(provinceID), err)
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return fallbackOnRajaError(fallbackCities(provinceID), err)
	}
	if !isRajaOngkirSuccess(result) {
		return fallbackOnRajaError(fallbackCities(provinceID), fmt.Errorf("rajaongkir cities request failed"))
	}

	return result, nil
}

type CostPayload struct {
	Origin      string `json:"origin"`
	Destination string `json:"destination"`
	Weight      int    `json:"weight"`
	Courier     string `json:"courier"`
}

func GetCost(payload CostPayload) (interface{}, error) {
	if payload.Origin == "" {
		payload.Origin = "152"
	}
	if payload.Weight <= 0 {
		payload.Weight = 1000
	}
	payload.Courier = strings.ToLower(strings.TrimSpace(payload.Courier))
	if shouldUseFallback() {
		return fallbackCost(payload), nil
	}

	form := url.Values{}
	form.Set("origin", payload.Origin)
	form.Set("destination", payload.Destination)
	form.Set("weight", fmt.Sprintf("%d", payload.Weight))
	form.Set("courier", payload.Courier)

	req, _ := http.NewRequest("POST", BaseURL+"/cost", strings.NewReader(form.Encode()))
	req.Header.Add("key", getAPIKey())
	req.Header.Add("content-type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: requestTimeout}
	res, err := client.Do(req)
	if err != nil {
		return fallbackOnRajaError(fallbackCost(payload), err)
	}
	defer res.Body.Close()

	var result map[string]interface{}
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return fallbackOnRajaError(fallbackCost(payload), err)
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return fallbackOnRajaError(fallbackCost(payload), err)
	}
	if !isRajaOngkirSuccess(result) {
		return fallbackOnRajaError(fallbackCost(payload), fmt.Errorf("rajaongkir cost request failed"))
	}

	return result, nil
}

func shouldUseFallback() bool {
	key := strings.TrimSpace(os.Getenv("RAJAONGKIR_API_KEY"))
	return !config.IsProduction() && (key == "" || key == dummyAPIKey)
}

func fallbackOnRajaError(fallback interface{}, err error) (interface{}, error) {
	if strings.ToLower(strings.TrimSpace(os.Getenv("RAJAONGKIR_DISABLE_FALLBACK"))) == "true" {
		return nil, err
	}
	log.Printf("rajaongkir provider unavailable, using fallback data: %v", err)
	return fallback, nil
}

func isRajaOngkirSuccess(result map[string]interface{}) bool {
	raja, ok := result["rajaongkir"].(map[string]interface{})
	if !ok {
		return false
	}
	status, ok := raja["status"].(map[string]interface{})
	if !ok {
		return false
	}
	switch code := status["code"].(type) {
	case float64:
		return int(code) == http.StatusOK
	case int:
		return code == http.StatusOK
	case string:
		return code == "200"
	default:
		return false
	}
}

func fallbackProvinces() map[string]interface{} {
	return rajaResponse([]map[string]string{
		{"province_id": "1", "province": "Bali"},
		{"province_id": "3", "province": "Banten"},
		{"province_id": "5", "province": "DI Yogyakarta"},
		{"province_id": "6", "province": "DKI Jakarta"},
		{"province_id": "9", "province": "Jawa Barat"},
		{"province_id": "10", "province": "Jawa Tengah"},
		{"province_id": "11", "province": "Jawa Timur"},
	})
}

func fallbackCities(provinceID string) map[string]interface{} {
	citiesByProvince := map[string][]map[string]string{
		"1": {
			{"city_id": "17", "province_id": "1", "province": "Bali", "type": "Kota", "city_name": "Denpasar", "postal_code": "80227"},
			{"city_id": "114", "province_id": "1", "province": "Bali", "type": "Kabupaten", "city_name": "Gianyar", "postal_code": "80519"},
		},
		"3": {
			{"city_id": "455", "province_id": "3", "province": "Banten", "type": "Kota", "city_name": "Tangerang", "postal_code": "15111"},
			{"city_id": "456", "province_id": "3", "province": "Banten", "type": "Kota", "city_name": "Tangerang Selatan", "postal_code": "15332"},
		},
		"5": {
			{"city_id": "39", "province_id": "5", "province": "DI Yogyakarta", "type": "Kabupaten", "city_name": "Bantul", "postal_code": "55715"},
			{"city_id": "501", "province_id": "5", "province": "DI Yogyakarta", "type": "Kota", "city_name": "Yogyakarta", "postal_code": "55111"},
		},
		"6": {
			{"city_id": "151", "province_id": "6", "province": "DKI Jakarta", "type": "Kota", "city_name": "Jakarta Barat", "postal_code": "11220"},
			{"city_id": "152", "province_id": "6", "province": "DKI Jakarta", "type": "Kota", "city_name": "Jakarta Pusat", "postal_code": "10540"},
			{"city_id": "153", "province_id": "6", "province": "DKI Jakarta", "type": "Kota", "city_name": "Jakarta Selatan", "postal_code": "12190"},
			{"city_id": "154", "province_id": "6", "province": "DKI Jakarta", "type": "Kota", "city_name": "Jakarta Timur", "postal_code": "13330"},
			{"city_id": "155", "province_id": "6", "province": "DKI Jakarta", "type": "Kota", "city_name": "Jakarta Utara", "postal_code": "14140"},
		},
		"9": {
			{"city_id": "23", "province_id": "9", "province": "Jawa Barat", "type": "Kota", "city_name": "Bandung", "postal_code": "40111"},
			{"city_id": "54", "province_id": "9", "province": "Jawa Barat", "type": "Kota", "city_name": "Bekasi", "postal_code": "17121"},
			{"city_id": "79", "province_id": "9", "province": "Jawa Barat", "type": "Kota", "city_name": "Bogor", "postal_code": "16119"},
			{"city_id": "115", "province_id": "9", "province": "Jawa Barat", "type": "Kota", "city_name": "Depok", "postal_code": "16431"},
		},
		"10": {
			{"city_id": "399", "province_id": "10", "province": "Jawa Tengah", "type": "Kota", "city_name": "Semarang", "postal_code": "50135"},
			{"city_id": "445", "province_id": "10", "province": "Jawa Tengah", "type": "Kota", "city_name": "Surakarta", "postal_code": "57113"},
		},
		"11": {
			{"city_id": "255", "province_id": "11", "province": "Jawa Timur", "type": "Kota", "city_name": "Malang", "postal_code": "65112"},
			{"city_id": "444", "province_id": "11", "province": "Jawa Timur", "type": "Kota", "city_name": "Surabaya", "postal_code": "60119"},
		},
	}

	if provinceID != "" {
		return rajaResponse(citiesByProvince[provinceID])
	}

	allCities := make([]map[string]string, 0)
	for _, cities := range citiesByProvince {
		allCities = append(allCities, cities...)
	}
	return rajaResponse(allCities)
}

func fallbackCost(payload CostPayload) map[string]interface{} {
	courier := payload.Courier
	if courier == "" {
		courier = "jne"
	}
	base := 12000 + ((payload.Weight + 999) / 1000 * 2500)
	services := []map[string]interface{}{
		{
			"service":     "REG",
			"description": "Regular Service",
			"cost": []map[string]interface{}{
				{"value": base, "etd": "2-4", "note": ""},
			},
		},
		{
			"service":     "YES",
			"description": "Express Service",
			"cost": []map[string]interface{}{
				{"value": base + 10000, "etd": "1-2", "note": ""},
			},
		},
	}
	if courier == "pos" {
		services = []map[string]interface{}{
			{
				"service":     "Paket Kilat Khusus",
				"description": "Paket Kilat Khusus",
				"cost": []map[string]interface{}{
					{"value": base - 1000, "etd": "2-5", "note": ""},
				},
			},
			{
				"service":     "Express Next Day",
				"description": "Express Next Day",
				"cost": []map[string]interface{}{
					{"value": base + 12000, "etd": "1-2", "note": ""},
				},
			},
		}
	}
	if courier == "tiki" {
		services = []map[string]interface{}{
			{
				"service":     "REG",
				"description": "Regular Service",
				"cost": []map[string]interface{}{
					{"value": base + 1000, "etd": "2-4", "note": ""},
				},
			},
			{
				"service":     "ONS",
				"description": "Over Night Service",
				"cost": []map[string]interface{}{
					{"value": base + 11000, "etd": "1", "note": ""},
				},
			},
		}
	}

	return rajaResponse([]map[string]interface{}{
		{
			"code":  courier,
			"name":  strings.ToUpper(courier),
			"costs": services,
		},
	})
}

func rajaResponse(results interface{}) map[string]interface{} {
	return map[string]interface{}{
		"rajaongkir": map[string]interface{}{
			"status": map[string]interface{}{
				"code":        http.StatusOK,
				"description": "OK",
			},
			"results": results,
		},
	}
}
