package rajaongkir

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

const (
	BaseURL = "https://api.rajaongkir.com/starter"
)

func getAPIKey() string {
	key := os.Getenv("RAJAONGKIR_API_KEY")
	if key == "" {
		key = "e1234567890dummyapikey" // In production use an actual env
	}
	return key
}

func GetProvinces() (interface{}, error) {
	req, _ := http.NewRequest("GET", BaseURL+"/province", nil)
	req.Header.Add("key", getAPIKey())

	client := &http.Client{}
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	var result map[string]interface{}
	body, _ := io.ReadAll(res.Body)
	json.Unmarshal(body, &result)

	return result, nil
}

func GetCities(provinceID string) (interface{}, error) {
	req, _ := http.NewRequest("GET", BaseURL+"/city?province="+provinceID, nil)
	req.Header.Add("key", getAPIKey())

	client := &http.Client{}
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	var result map[string]interface{}
	body, _ := io.ReadAll(res.Body)
	json.Unmarshal(body, &result)

	return result, nil
}

type CostPayload struct {
	Origin      string `json:"origin"`
	Destination string `json:"destination"`
	Weight      int    `json:"weight"`
	Courier     string `json:"courier"`
}

func GetCost(payload CostPayload) (interface{}, error) {
	// Jakarta Pusat Origin Hardcoded Default
	if payload.Origin == "" {
		payload.Origin = "152" 
	}
	
	pBody, _ := json.Marshal(map[string]interface{}{
		"origin":      payload.Origin,
		"destination": payload.Destination,
		"weight":      payload.Weight,
		"courier":     payload.Courier,
	})

	req, _ := http.NewRequest("POST", BaseURL+"/cost", bytes.NewBuffer(pBody))
	req.Header.Add("key", getAPIKey())
	req.Header.Add("content-type", "application/x-www-form-urlencoded") // Actually Starter API needs form encoded, but handling via mapping is safer:
	
	// RajaOngkir Starter expects Form URL Encoded
	formStr := fmt.Sprintf("origin=%s&destination=%s&weight=%d&courier=%s", payload.Origin, payload.Destination, payload.Weight, payload.Courier)
	
	req, _ = http.NewRequest("POST", BaseURL+"/cost", bytes.NewBufferString(formStr))
	req.Header.Add("key", getAPIKey())
	req.Header.Add("content-type", "application/x-www-form-urlencoded")

	client := &http.Client{}
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	var result map[string]interface{}
	body, _ := io.ReadAll(res.Body)
	json.Unmarshal(body, &result)

	return result, nil
}
