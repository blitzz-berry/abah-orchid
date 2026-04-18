package midtrans

import (
	"os"

	"github.com/midtrans/midtrans-go"
	"github.com/midtrans/midtrans-go/snap"
)

var SnapClient snap.Client

func InitMidtrans() {
	serverKey := os.Getenv("MIDTRANS_SERVER_KEY")
	if serverKey == "" {
		serverKey = "SB-Mid-server-YOUR_DEV_KEY" // use from env usually
	}
	
	// Setting environment setup
	env := midtrans.Sandbox
	if os.Getenv("ENV") == "production" {
		env = midtrans.Production
	}

	SnapClient.New(serverKey, env)
}
