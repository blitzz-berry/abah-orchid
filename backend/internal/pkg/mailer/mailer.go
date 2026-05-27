package mailer

import (
	"bytes"
	"errors"
	"fmt"
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

func SendPaymentConfirmedEmail(toEmail, toName, orderNumber string, total float64) error {
	const bodyTpl = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.5;">
    <h2>Pembayaran Berhasil Dikonfirmasi</h2>
    <p>Halo {{.ToName}},</p>
    <p>Pembayaran untuk pesanan <strong>{{.OrderNumber}}</strong> sudah berhasil dikonfirmasi.</p>
    <p>Total pembayaran: <strong>{{.Total}}</strong></p>
    <p>Pesanan Anda akan segera kami proses. Status terbaru juga dapat dilihat pada halaman pesanan OrchidMart.</p>
  </body>
</html>`
	return sendTransactionalEmail(toEmail, "Pembayaran Berhasil - "+orderNumber, bodyTpl, map[string]string{
		"ToName":      strings.TrimSpace(toName),
		"OrderNumber": strings.TrimSpace(orderNumber),
		"Total":       fmt.Sprintf("Rp %.0f", total),
	})
}

func SendOrderShippedEmail(toEmail, toName, orderNumber, courier, trackingNumber string) error {
	const bodyTpl = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.5;">
    <h2>Pesanan Anda Sedang Dikirim</h2>
    <p>Halo {{.ToName}},</p>
    <p>Pesanan <strong>{{.OrderNumber}}</strong> sudah masuk tahap pengiriman.</p>
    {{if .Courier}}<p>Kurir: <strong>{{.Courier}}</strong></p>{{end}}
    {{if .TrackingNumber}}<p>Nomor resi: <strong>{{.TrackingNumber}}</strong></p>{{else}}<p>Nomor resi akan tersedia pada detail pesanan setelah diperbarui admin.</p>{{end}}
    <p>Silakan pantau perkembangan pengiriman pada halaman pesanan OrchidMart.</p>
  </body>
</html>`
	return sendTransactionalEmail(toEmail, "Pesanan Dikirim - "+orderNumber, bodyTpl, map[string]string{
		"ToName":         strings.TrimSpace(toName),
		"OrderNumber":    strings.TrimSpace(orderNumber),
		"Courier":        strings.ToUpper(strings.TrimSpace(courier)),
		"TrackingNumber": strings.TrimSpace(trackingNumber),
	})
}

func SendOrderCancelledEmail(toEmail, toName, orderNumber, resultStatus, reason string) error {
	const bodyTpl = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.5;">
    <h2>Pesanan Dibatalkan</h2>
    <p>Halo {{.ToName}},</p>
    <p>Pesanan <strong>{{.OrderNumber}}</strong> telah dibatalkan oleh admin.</p>
    {{if .Reason}}<p>Alasan: {{.Reason}}</p>{{end}}
    {{if eq .ResultStatus "REFUNDED"}}<p>Dana untuk pesanan ini telah diproses untuk pengembalian.</p>{{end}}
    <p>Status terbaru dapat dilihat pada halaman pesanan OrchidMart.</p>
  </body>
</html>`
	return sendTransactionalEmail(toEmail, "Pesanan Dibatalkan - "+orderNumber, bodyTpl, map[string]string{
		"ToName":       strings.TrimSpace(toName),
		"OrderNumber":  strings.TrimSpace(orderNumber),
		"ResultStatus": strings.TrimSpace(resultStatus),
		"Reason":       strings.TrimSpace(reason),
	})
}

func SendCancellationDecisionEmail(toEmail, toName, orderNumber string, approved bool, resultStatus, reason string) error {
	const bodyTpl = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.5;">
    <h2>Pengajuan Pembatalan {{.Decision}}</h2>
    <p>Halo {{.ToName}},</p>
    <p>Pengajuan pembatalan untuk pesanan <strong>{{.OrderNumber}}</strong> {{.DecisionText}}.</p>
    {{if .Reason}}<p>Catatan admin: {{.Reason}}</p>{{end}}
    {{if eq .ResultStatus "REFUNDED"}}<p>Dana untuk pesanan ini telah diproses untuk pengembalian.</p>{{end}}
    {{if not .Approved}}<p>Pesanan Anda tetap berjalan sesuai status terakhirnya.</p>{{end}}
    <p>Silakan cek halaman pesanan OrchidMart untuk rincian terbaru.</p>
  </body>
</html>`
	decision := "Ditolak"
	decisionText := "ditolak oleh admin"
	if approved {
		decision = "Disetujui"
		decisionText = "disetujui oleh admin"
	}
	return sendTransactionalEmail(toEmail, "Pengajuan Pembatalan "+decision+" - "+orderNumber, bodyTpl, map[string]interface{}{
		"ToName":       strings.TrimSpace(toName),
		"OrderNumber":  strings.TrimSpace(orderNumber),
		"Approved":     approved,
		"Decision":     decision,
		"DecisionText": decisionText,
		"ResultStatus": strings.TrimSpace(resultStatus),
		"Reason":       strings.TrimSpace(reason),
	})
}

func SendReturnDecisionEmail(toEmail, toName, orderNumber string, approved bool, reason string) error {
	const bodyTpl = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.5;">
    <h2>Pengajuan Retur {{.Decision}}</h2>
    <p>Halo {{.ToName}},</p>
    <p>Pengajuan retur untuk pesanan <strong>{{.OrderNumber}}</strong> {{.DecisionText}}.</p>
    {{if .Reason}}<p>Catatan admin: {{.Reason}}</p>{{end}}
    {{if .Approved}}<p>Proses refund dapat dilanjutkan sesuai keputusan admin. Anda akan menerima pembaruan saat refund selesai.</p>{{else}}<p>Status pesanan dikembalikan ke status sebelumnya.</p>{{end}}
    <p>Silakan cek halaman pesanan OrchidMart untuk rincian terbaru.</p>
  </body>
</html>`
	decision := "Ditolak"
	decisionText := "ditolak oleh admin"
	if approved {
		decision = "Disetujui"
		decisionText = "disetujui oleh admin"
	}
	return sendTransactionalEmail(toEmail, "Pengajuan Retur "+decision+" - "+orderNumber, bodyTpl, map[string]interface{}{
		"ToName":       strings.TrimSpace(toName),
		"OrderNumber":  strings.TrimSpace(orderNumber),
		"Approved":     approved,
		"Decision":     decision,
		"DecisionText": decisionText,
		"Reason":       strings.TrimSpace(reason),
	})
}

func SendRefundCompletedEmail(toEmail, toName, orderNumber, reason string, amount float64) error {
	const bodyTpl = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.5;">
    <h2>Refund Pesanan Diproses</h2>
    <p>Halo {{.ToName}},</p>
    <p>Refund untuk pesanan <strong>{{.OrderNumber}}</strong> telah diproses.</p>
    {{if .Amount}}<p>Nominal refund: <strong>{{.Amount}}</strong></p>{{end}}
    {{if .Reason}}<p>Alasan: {{.Reason}}</p>{{end}}
    <p>Waktu dana masuk dapat mengikuti proses penyedia pembayaran atau bank Anda.</p>
  </body>
</html>`
	amountText := ""
	if amount > 0 {
		amountText = fmt.Sprintf("Rp %.0f", amount)
	}
	return sendTransactionalEmail(toEmail, "Refund Diproses - "+orderNumber, bodyTpl, map[string]string{
		"ToName":      strings.TrimSpace(toName),
		"OrderNumber": strings.TrimSpace(orderNumber),
		"Reason":      strings.TrimSpace(reason),
		"Amount":      amountText,
	})
}

func sendTransactionalEmail(toEmail, subject, bodyTpl string, data interface{}) error {
	tpl, err := template.New("transaction-email").Parse(bodyTpl)
	if err != nil {
		return err
	}
	host := os.Getenv("SMTP_HOST")
	port := os.Getenv("SMTP_PORT")
	username := os.Getenv("SMTP_USERNAME")
	password := os.Getenv("SMTP_PASSWORD")
	from := os.Getenv("SMTP_FROM")
	if host == "" || port == "" || username == "" || password == "" || from == "" {
		return ErrMailerNotConfigured
	}

	toEmail = strings.TrimSpace(toEmail)
	if containsCRLF(toEmail) || containsCRLF(from) || containsCRLF(subject) {
		return errors.New("invalid mail fields")
	}
	fromAddr, err := mail.ParseAddress(from)
	if err != nil {
		return errors.New("invalid from address")
	}
	toAddr, err := mail.ParseAddress(toEmail)
	if err != nil {
		return errors.New("invalid to address")
	}
	var rendered bytes.Buffer
	if err := tpl.Execute(&rendered, data); err != nil {
		return err
	}

	headers := []string{
		"From: " + sanitizeHeaderValue(fromAddr.String()),
		"To: " + sanitizeHeaderValue(toAddr.String()),
		"Subject: " + sanitizeHeaderValue(subject),
		"MIME-Version: 1.0",
		"Content-Type: text/html; charset=\"UTF-8\"",
	}
	auth := smtp.PlainAuth("", username, password, host)
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
