package mailer

import (
	"bytes"
	"errors"
	"html/template"
	"net/mail"
	"net/smtp"
	"net/url"
	"os"
	"strings"
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

	toEmail = strings.TrimSpace(toEmail)
	toName = strings.TrimSpace(toName)
	resetURL = strings.TrimSpace(resetURL)
	if containsCRLF(toEmail) || containsCRLF(toName) || containsCRLF(from) {
		return errors.New("invalid mail fields")
	}
	if _, err := url.ParseRequestURI(resetURL); err != nil {
		return errors.New("invalid reset url")
	}

	fromAddr, err := mail.ParseAddress(from)
	if err != nil {
		return errors.New("invalid from address")
	}
	toAddr, err := mail.ParseAddress(toEmail)
	if err != nil {
		return errors.New("invalid to address")
	}

	auth := smtp.PlainAuth("", username, password, host)

	const bodyTpl = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.5;">
    <h2>Reset Kata Sandi OrchidMart</h2>
    <p>Halo {{.ToName}},</p>
    <p>Kami menerima permintaan pengaturan ulang kata sandi untuk akun Anda.</p>
    <p>Klik tautan berikut untuk mengatur kata sandi baru:</p>
    <p><a href="{{.ResetURL}}">{{.ResetURL}}</a></p>
    <p>Tautan ini berlaku selama 30 menit dan hanya dapat digunakan satu kali.</p>
  </body>
</html>`
	tpl, err := template.New("reset-email").Parse(bodyTpl)
	if err != nil {
		return err
	}
	var rendered bytes.Buffer
	if err := tpl.Execute(&rendered, map[string]string{
		"ToName":   toName,
		"ResetURL": resetURL,
	}); err != nil {
		return err
	}

	headers := []string{
		"From: " + sanitizeHeaderValue(fromAddr.String()),
		"To: " + sanitizeHeaderValue(toAddr.String()),
		"Subject: Reset Kata Sandi OrchidMart",
		"MIME-Version: 1.0",
		"Content-Type: text/html; charset=\"UTF-8\"",
	}
	message := strings.Join(headers, "\r\n") + "\r\n\r\n" + rendered.String()
	return smtp.SendMail(host+":"+port, auth, fromAddr.Address, []string{toAddr.Address}, []byte(message))
}

func containsCRLF(value string) bool {
	return strings.ContainsAny(value, "\r\n")
}

func sanitizeHeaderValue(value string) string {
	// Hard reject CRLF to avoid header injection.
	if containsCRLF(value) {
		return ""
	}
	return value
}
