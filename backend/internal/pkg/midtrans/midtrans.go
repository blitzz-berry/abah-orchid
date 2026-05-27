package midtrans

import (
	"log"
	"os"
	"strings"

	"github.com/midtrans/midtrans-go"
	"github.com/midtrans/midtrans-go/snap"
	"orchidmart-backend/internal/config"
)

var SnapClient snap.Client

func InitMidtrans() {
	serverKey := strings.TrimSpace(os.Getenv("MIDTRANS_SERVER_KEY"))
	if serverKey == "" {
		if config.IsProduction() {
			log.Fatal("MIDTRANS_SERVER_KEY is required in production")
		}
		serverKey = "SB-Mid-server-YOUR_DEV_KEY" // use from env usually
	}

	env := midtrans.Sandbox
	if config.IsProduction() {
		env = midtrans.Production
	}
	warnIfMidtransKeyEnvLooksSuspicious(serverKey, env)

	SnapClient.New(serverKey, env)
	log.Printf("Midtrans initialized in %s mode using configured access key", midtransEnvName(env))
}

func warnIfMidtransKeyEnvLooksSuspicious(serverKey string, env midtrans.EnvironmentType) {
	serverKey = strings.TrimSpace(serverKey)
	if serverKey == "" {
		return
	}

	isSandboxKey := strings.HasPrefix(serverKey, "SB-Mid-server-")
	isProductionKey := strings.HasPrefix(serverKey, "Mid-server-")

	switch env {
	case midtrans.Sandbox:
		if isProductionKey && !isSandboxKey {
			log.Printf("Warning: MIDTRANS_SERVER_KEY looks like a production-style key while app is running in sandbox mode. If this key came from the Sandbox dashboard, it may still be valid. If Midtrans returns 401, re-check the Sandbox access key in MAP.")
		}
	case midtrans.Production:
		if isSandboxKey {
			log.Printf("Warning: MIDTRANS_SERVER_KEY looks like a sandbox-style key while app is running in production mode. If Midtrans returns 401, switch to the Production access key from MAP.")
		}
	}
}

func midtransEnvName(env midtrans.EnvironmentType) string {
	if env == midtrans.Production {
		return "production"
	}
	return "sandbox"
}
