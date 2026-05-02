# OrchidMart Security Report

Last reviewed: 2026-05-02

## Executive Summary

Repo ini sudah jauh lebih kuat dibanding kondisi audit awal: refresh token sudah dipindah ke cookie `HttpOnly`, reset token/admin password tidak lagi dicetak ke log, JWT secret wajib kuat, HTTP timeout sudah eksplisit, product inactive exposure sudah ditutup, payment proof sudah lewat private/authenticated flow, CORS production lebih ketat, body limit/security headers sudah ditambahkan, dan frontend production dependency audit sudah bersih.

Namun repo ini belum bisa dinilai "sangat kuat" atau production-final. Masih ada celah high-impact yang harus ditutup sebelum internet-facing production, terutama manipulasi total checkout dan Go runtime vulnerabilities yang reachable.

Penilaian saat ini: aman untuk development/demo terkendali, belum cukup untuk production serius tanpa fix temuan High dan Medium di bawah.

## Current Risk Summary

- Critical: tidak ada critical yang terbukti dari static/local review ini.
- High: 2 temuan aktif.
- Medium: 6 temuan aktif.
- Low / hardening: 4 temuan aktif.
- Fixed from previous audit: H-01 sampai H-05, M-01 sampai M-07, L-01 sampai L-03 secara umum sudah ditangani, dengan beberapa residual hardening yang dicatat ulang di bawah.

## High

### H-06: Checkout total bisa dimanipulasi dari client

- Severity: High
- Status: Open
- Location: `backend/internal/service/order_service.go:89`, `backend/internal/dto/request/order.go:14`
- Evidence: backend menghitung `total := subtotal + req.ShippingCost + req.InsuranceCost + req.PackingCost - discount`, sementara `shipping_cost`, `insurance_cost`, dan `packing_cost` berasal dari request client.
- Impact: user authenticated bisa mengirim biaya ongkir/asuransi/packing negatif atau nol, lalu membuat total order menjadi terlalu rendah bahkan `0`. Karena nominal ini juga dipakai untuk Payment/Midtrans request, ini menjadi business-logic payment bypass.
- Best fix: backend wajib menghitung ulang biaya shipping, insurance, dan packing dari server-side quote/policy. Frontend hanya boleh mengirim quote ID atau pilihan courier/service, bukan nominal final.
- Additional fix: validasi semua numeric amount `>= 0`, reject total `<= 0` kecuali memang ada promo gratis eksplisit, dan simpan quote dengan expiry agar tidak bisa replay quote lama.

### H-07: Go standard library vulnerabilities reachable

- Severity: High
- Status: Open
- Location: `backend/go.mod:3`, `backend/Dockerfile:1`
- Evidence: `govulncheck ./...` menemukan 9 reachable vulnerabilities karena backend memakai Go `1.25.5`; fixed versions minimal sampai Go `1.25.9`.
- Affected advisories: `GO-2026-4947`, `GO-2026-4946`, `GO-2026-4870`, `GO-2026-4865`, `GO-2026-4602`, `GO-2026-4601`, `GO-2026-4341`, `GO-2026-4340`, `GO-2026-4337`.
- Impact: DoS dan parsing/TLS/template related risks di standard library yang reachable dari HTTP server, DB TLS, outbound RajaOngkir, upload/download, dan Gin internals.
- Best fix: upgrade local toolchain, `go.mod`, CI, dan Docker builder ke Go `1.25.9+` atau patch terbaru; rebuild backend image.
- Verification after fix: jalankan `go test ./...` dan `govulncheck ./...` sampai reachable vulnerabilities menjadi 0.

## Medium

### M-08: Password reset tidak revoke refresh token lama

- Severity: Medium
- Status: Open
- Location: `backend/internal/service/auth_service.go:215`, `backend/internal/repository/user_repo.go:223`
- Evidence: `ResetPassword` update password dan mark token used, tapi tidak revoke refresh token milik user.
- Impact: kalau device lama, refresh token curian, atau session attacker sudah aktif sebelum reset password, session itu masih bisa bertahan sampai token expired.
- Best fix: tambahkan repository method `RevokeRefreshTokensForUser(userID)` dan panggil dalam transaksi yang sama saat reset password berhasil.

### M-09: Refresh token dan password reset token disimpan plaintext di database

- Severity: Medium
- Status: Open
- Location: `backend/internal/model/user.go:33`, `backend/internal/model/user.go:44`, `backend/internal/repository/user_repo.go:205`, `backend/internal/repository/user_repo.go:236`
- Evidence: kolom `RefreshToken.Token` dan `PasswordReset.Token` menyimpan token asli, lalu lookup dilakukan dengan `WHERE token = ?`.
- Impact: database leak langsung membuat refresh/reset token aktif bisa dipakai sampai expired/revoked.
- Best fix: simpan SHA-256/HMAC hash token saja di DB. Token asli hanya pernah dikirim ke client/email. Lookup token dilakukan dengan hash konstan.

### M-10: Midtrans webhook belum validasi nominal order

- Severity: Medium
- Status: Open
- Location: `backend/internal/service/order_service.go:508`
- Evidence: webhook signature diverifikasi di handler, tapi service tidak membandingkan `gross_amount` dari Midtrans dengan `order.Total` sebelum menandai payment/order paid.
- Impact: mismatch nominal akibat bug konfigurasi/payment provider state tidak tertahan oleh backend.
- Best fix: parse `gross_amount`, compare dengan `order.Total` dalam satuan integer terkecil/rounded policy yang konsisten, dan reject webhook paid jika mismatch.

### M-11: Mailer raw SMTP/HTML construction

- Severity: Medium
- Status: Open
- Location: `backend/internal/pkg/mailer/mailer.go:26`, `backend/internal/pkg/mailer/mailer.go:40`
- Evidence: body email dibuat dengan `fmt.Sprintf` dari `toName` dan `resetURL`, lalu dikirim langsung via `smtp.SendMail`. `gosec` menandai ini sebagai SMTP/header injection risk.
- Impact: input tidak tersanitasi bisa memengaruhi isi HTML email, dan header/address handling terlalu manual.
- Best fix: validasi `from`/`to` dengan `net/mail`, reject CRLF pada address/header fields, dan render body dengan `html/template`.

### M-12: Product image URL eksternal bebas dari admin

- Severity: Medium
- Status: Open
- Location: `backend/internal/handler/admin_handler.go:575`
- Evidence: `AddProductImage` menerima `image_url` dengan validator `required,url`, tanpa allowlist host/storage internal.
- Impact: image eksternal bisa melacak IP/referrer user/admin yang membuka halaman produk, dan membuat dependency privacy ke host pihak ketiga.
- Best fix: paksa semua product image lewat upload internal/S3 storage, atau allowlist host CDN/storage resmi saja.

### M-13: Frontend CSP masih longgar

- Severity: Medium
- Status: Open
- Location: `frontend/next.config.ts:9`, `frontend/next.config.ts:11`, `frontend/next.config.ts:13`
- Evidence: CSP masih memakai `img-src ... https:`, `script-src 'self' 'unsafe-inline'`, `style-src 'self' 'unsafe-inline'`, dan `connect-src ... https:`.
- Impact: jika XSS terjadi, CSP kurang kuat untuk membatasi script execution dan data exfiltration ke arbitrary HTTPS origin.
- Best fix: production CSP pakai allowlist origin spesifik untuk API/CDN/Midtrans/RajaOngkir, lalu migrasi `unsafe-inline` ke nonce/hash jika memungkinkan.

## Low / Defense In Depth

### L-04: Legacy refresh token JSON fallback masih aktif

- Severity: Low
- Status: Open
- Location: `backend/internal/handler/auth_handler.go:388`
- Evidence: refresh token utama sudah cookie `HttpOnly`, tapi handler masih menerima `refresh_token` dari JSON body sebagai fallback.
- Impact: attack surface lebih luas dan bisa mempertahankan pola client lama yang menyimpan refresh token di JS-readable storage.
- Best fix: setelah migrasi client selesai, hapus fallback JSON dan hanya terima refresh token dari cookie.

### L-05: Upload product image menyimpan file sebelum validasi UUID product

- Severity: Low
- Status: Open
- Location: `backend/internal/handler/upload_handler.go:34`, `backend/internal/handler/upload_handler.go:40`
- Evidence: file disimpan dengan `storage.SaveImage` sebelum `uuid.Parse(productID)`.
- Impact: request admin dengan product ID invalid bisa membuat orphan file/folder. Risikonya rendah karena route admin-only dan filename generated, tapi flow-nya tetap tidak ideal.
- Best fix: parse dan validasi `productID` dulu, pastikan product exists, baru save file.

### L-06: Rate limit in-memory dan trusted proxy belum dipin eksplisit

- Severity: Low
- Status: Open
- Location: `backend/cmd/server/main.go:36`, `backend/cmd/server/main.go:91`
- Evidence: rate limit app-level in-memory dan tidak terlihat konfigurasi `SetTrustedProxies`.
- Impact: pada multi-instance, limit bisa dibypass antar instance. Jika proxy trust salah, IP-based limiter bisa kurang akurat.
- Best fix: set trusted proxy eksplisit sesuai deployment, dan gunakan Redis/distributed rate limiter untuk production multi-instance.

### L-07: Runtime logs dan binary masih tracked di git

- Severity: Low
- Status: Open
- Location: `backend/server.out.log`, `backend/server.err.log`, `frontend/next.out.log`, `frontend/next.err.log`, `backend/bin/orchidmart-server.exe`
- Evidence: `git ls-files` menunjukkan file log dan binary tersebut tracked. Isi log saat dicek kosong/hampir kosong dan tidak mengandung secret aktif.
- Impact: log/binary di repo mudah jadi tempat bocor secret atau artefak environment pada commit berikutnya.
- Best fix: `git rm --cached` file log/binary, tambahkan pattern ignore untuk `*.log`, `backend/bin/`, dan generated binaries.

## Fixed / Improved From Previous Audit

### H-01: Token auth di `localStorage`

- Status: Fixed
- Evidence: refresh token sekarang cookie `HttpOnly`; access token hanya in-memory; legacy localStorage dibersihkan.
- Residual: hash refresh token di DB masih perlu dikerjakan, tercatat sebagai M-09.

### H-02: Password reset URL/token masuk log

- Status: Fixed
- Evidence: reset token tidak lagi dicetak ke log saat mailer gagal.
- Residual: reset token masih plaintext di DB, tercatat sebagai M-09.

### H-03: Default admin password masuk log

- Status: Fixed
- Evidence: log admin creation tidak lagi mencetak password.
- Residual: rotate credential jika pernah terlanjur muncul di log lama.

### H-04: JWT secret fallback lemah

- Status: Fixed
- Evidence: `JWT_SECRET` wajib ada minimal 32 karakter lewat config validation.

### H-05: HTTP server tanpa timeout eksplisit

- Status: Fixed
- Evidence: backend memakai `http.Server` explicit timeout melalui `backend/internal/config/http.go`.

### M-01: Public product inactive exposure

- Status: Fixed
- Evidence: public route tidak lagi menghormati `include_inactive`; admin-only path yang boleh melihat inactive.

### M-02: Payment proof arbitrary external URL

- Status: Fixed
- Evidence: flow resmi payment proof memakai file upload private/authenticated, bukan arbitrary external URL.

### M-03: Upload/body limit app-level

- Status: Fixed
- Evidence: middleware body limit dan `MaxMultipartMemory` sudah ditambahkan.

### M-04: Frontend security headers tidak ada

- Status: Fixed with residual hardening
- Evidence: `frontend/next.config.ts` sudah menambahkan CSP, nosniff, frame protection, referrer policy, dan permissions policy.
- Residual: CSP masih terlalu longgar untuk production kuat, tercatat sebagai M-13.

### M-05: Credentialed CORS bergantung env

- Status: Fixed
- Evidence: CORS config dipisah dan divalidasi agar production tidak memakai wildcard/unsafe origin.

### M-06: GORM logger terlalu verbose

- Status: Fixed
- Evidence: logger production diturunkan agar tidak mudah membocorkan query/PII.

### M-07: Frontend PostCSS advisory

- Status: Fixed
- Evidence: `npm audit --omit=dev --json` setelah override PostCSS menunjukkan 0 vulnerabilities.

### L-01: DB TLS disabled by default

- Status: Fixed with deployment caveat
- Evidence: `DB_SSLMODE` sudah configurable/validated untuk production.
- Residual: `disable` hanya aman untuk Docker/private network lokal.

### L-02: Payment proof satu bucket public dengan product image

- Status: Fixed
- Evidence: product image public bucket dan payment proof private bucket/endpoint sudah dipisah.

### L-03: Production nginx route HMR

- Status: Fixed
- Evidence: route `/_next/webpack-hmr` sudah dihapus dari production nginx config.

## Positive Findings

- Password hashing memakai bcrypt cost 12.
- Public IDs memakai UUID.
- Query database mayoritas memakai GORM parameter binding, bukan string concatenation raw.
- Midtrans webhook handler memverifikasi signature sebelum memanggil service.
- Upload file memakai MIME allowlist dan random server-side filename.
- Admin routes dilindungi auth middleware dan admin middleware.
- Backend punya security headers, CORS allowlist, rate limit, body limit, dan HTTP timeout eksplisit.
- Payment proof download sudah authenticated dan mengecek owner/admin.

## Tooling Verification

- `go test ./...`: pass pada audit sebelumnya setelah patch security.
- `go vet ./...`: pass pada audit sebelumnya.
- `npm run lint`: pass pada audit sebelumnya.
- `npm run build`: pass pada audit sebelumnya.
- `npm audit --omit=dev --json`: 0 production vulnerabilities setelah PostCSS override.
- `govulncheck ./...`: 9 reachable Go stdlib vulnerabilities masih aktif karena Go `1.25.5`.
- `gosec`: menemukan mailer SMTP/header injection risk dan beberapa storage path/perms warnings; sebagian storage warning kemungkinan false positive karena filename generated, tapi validasi path/perms tetap direkomendasikan.

## Recommended Fix Order

1. Fix H-06: pindahkan kalkulasi shipping/insurance/packing sepenuhnya ke backend/server-side quote.
2. Fix H-07: upgrade Go toolchain/Docker builder ke `1.25.9+`, lalu rerun `govulncheck`.
3. Fix M-08 dan M-09: revoke token saat reset password dan hash refresh/reset token di DB.
4. Fix M-10: validasi `gross_amount` webhook terhadap `order.Total`.
5. Fix M-11: harden mailer dengan `net/mail`, CRLF rejection, dan `html/template`.
6. Fix M-12 dan M-13: restrict product image hosts dan perketat CSP production.
7. Fix L-04 sampai L-07 untuk mengurangi attack surface dan hygiene repo/deploy.

## Scope And Limitations

Audit ini berbasis static source review dan local tooling. Belum termasuk penetration test runtime terhadap deployment asli, verifikasi live Cloudflare/nginx headers, transaksi Midtrans sandbox end-to-end, ataupun git history secret scan penuh.
