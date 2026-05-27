package appcache

import (
	"testing"
	"time"
)

func TestMemoryStoreCachesAndDeletesPrefix(t *testing.T) {
	store := NewMemory()
	store.SetJSON(CatalogPrefix+"products:all", map[string]string{"name": "Anggrek"}, time.Minute)
	store.SetJSON("shipping:provinces", map[string]string{"province": "Banten"}, time.Minute)

	var catalog map[string]string
	if !store.GetJSON(CatalogPrefix+"products:all", &catalog) || catalog["name"] != "Anggrek" {
		t.Fatalf("catalog cache value = %#v, want cached product", catalog)
	}

	store.DeletePrefix(CatalogPrefix)
	if store.GetJSON(CatalogPrefix+"products:all", &catalog) {
		t.Fatal("catalog key remained after prefix invalidation")
	}

	var shipping map[string]string
	if !store.GetJSON("shipping:provinces", &shipping) {
		t.Fatal("non-catalog key should not be deleted")
	}
}

func TestMemoryStoreExpiresEntries(t *testing.T) {
	store := NewMemory()
	store.SetJSON("short-lived", "value", time.Nanosecond)
	time.Sleep(time.Millisecond)

	var value string
	if store.GetJSON("short-lived", &value) {
		t.Fatal("expired entry should not be returned")
	}
}
