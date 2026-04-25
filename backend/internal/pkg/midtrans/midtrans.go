package midtrans

import (
	"log"
	"os"

	"github.com/midtrans/midtrans-go"
	"github.com/midtrans/midtrans-go/snap"
	"orchidmart-backend/internal/config"
)

var SnapClient snap.Client

func InitMidtrans() {
	serverKey := os.Getenv("MIDTRANS_SERVER_KEY")
	if serverKey == "" {
		if config.IsProduction() {
			log.Fatal("MIDTRANS_SERVER_KEY is required in production")
		}
		serverKey = "SB-Mid-server-YOUR_DEV_KEY" // use from env usually
	}

	// Setting environment setup
	env := midtrans.Sandbox
	if os.Getenv("ENV") == "production" {
		env = midtrans.Production
	}

	SnapClient.New(serverKey, env)
}
