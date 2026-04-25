package mailer

import (
	"errors"
	"fmt"
	"net/smtp"
	"os"
)

var ErrMailerNotConfigured = errors.New("mailer is not configured")

func SendPasswordResetEmail(toEmail, toName, resetURL string) error {
	host := os.Getenv("SMTP_HOST")
	port := os.Getenv("SMTP_PORT")
	username := os.Getenv("SMTP_USERNAME")
	password := os.Getenv("SMTP_PASSWORD")
	from := os.Getenv("SMTP_FROM")

	if host == "" || port == "" || username == "" || password == "" || from == "" {
		return ErrMailerNotConfigured
	}

	auth := smtp.PlainAuth("", username, password, host)
	subject := "Subject: Reset Password OrchidMart\r\n"
	mime := "MIME-version: 1.0;\r\nContent-Type: text/html; charset=\"UTF-8\";\r\n\r\n"
	body := fmt.Sprintf(`
		<html>
			<body style="font-family: Arial, sans-serif; line-height: 1.5;">
				<h2>Reset Password OrchidMart</h2>
				<p>Halo %s,</p>
				<p>Kami menerima permintaan reset password untuk akun lu.</p>
				<p>Klik link berikut untuk set password baru:</p>
				<p><a href="%s">%s</a></p>
				<p>Link ini berlaku 30 menit dan cuma bisa dipakai sekali.</p>
			</body>
		</html>
	`, toName, resetURL, resetURL)

	message := []byte(subject + mime + body)
	return smtp.SendMail(host+":"+port, auth, from, []string{toEmail}, message)
}
