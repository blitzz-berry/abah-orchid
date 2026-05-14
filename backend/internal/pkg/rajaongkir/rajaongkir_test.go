package rajaongkir

import (
	"strings"
	"testing"
)

func TestFallbackCostSupportsPRDCouriers(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("RAJAONGKIR_API_KEY", "")

	cases := map[string][]string{
		"jne":      {"REG", "YES"},
		"jnt":      {"EZ", "ECO"},
		"sicepat":  {"REG", "BEST"},
		"anteraja": {"REG", "NEXT"},
		"pos":      {"Paket Kilat Khusus", "Express Next Day"},
	}

	for courier, expectedServices := range cases {
		t.Run(courier, func(t *testing.T) {
			payload, err := GetCost(CostPayload{
				Destination: "152",
				Weight:      1000,
				Courier:     courier,
			})
			if err != nil {
				t.Fatalf("GetCost returned error: %v", err)
			}

			services := fallbackServiceNames(t, payload)
			for _, expected := range expectedServices {
				if !containsService(services, expected) {
					t.Fatalf("expected %s in services %v", expected, services)
				}
			}
		})
	}
}

func fallbackServiceNames(t *testing.T, payload interface{}) []string {
	t.Helper()

	root, ok := payload.(map[string]interface{})
	if !ok {
		t.Fatalf("payload root has unexpected type %T", payload)
	}
	raja, ok := root["rajaongkir"].(map[string]interface{})
	if !ok {
		t.Fatalf("missing rajaongkir payload")
	}
	results, ok := raja["results"].([]map[string]interface{})
	if !ok || len(results) == 0 {
		t.Fatalf("missing results payload")
	}
	costs, ok := results[0]["costs"].([]map[string]interface{})
	if !ok || len(costs) == 0 {
		t.Fatalf("missing costs payload")
	}

	services := make([]string, 0, len(costs))
	for _, cost := range costs {
		service, _ := cost["service"].(string)
		services = append(services, service)
	}
	return services
}

func containsService(services []string, expected string) bool {
	for _, service := range services {
		if strings.EqualFold(service, expected) {
			return true
		}
	}
	return false
}
