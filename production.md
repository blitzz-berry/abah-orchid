# Checklist Production OrchidMart

Last updated: 2026-05-14

Dokumen ini adalah checklist production OrchidMart berdasarkan kondisi repo saat ini. Jangan masukkan secret asli ke repository, screenshot, atau chat.

## Status Readiness Saat Ini

Kesimpulan terbaru: OrchidMart **belum siap production final/public go-live**. Sistem sudah cukup matang untuk staging/demo dan validasi MVP, tetapi masih ada blocker konfigurasi dan runtime yang harus ditutup dulu.

Validasi lokal terakhir:

- `cd backend; go test ./...` lulus.
- `cd backend; go vet ./...` lulus.
- `cd backend; go run golang.org/x/vuln/cmd/govulncheck@latest ./...` lulus, tidak ada vulnerability terdeteksi.
- `cd frontend; npm.cmd run lint` lulus.
- `cd frontend; npm.cmd run build` lulus.
- `cd frontend; npm.cmd audit --omit=dev` lulus, `found 0 vulnerabilities`.
- `docker compose -f docker-compose.prod.yml --env-file .env.production.example config --quiet` lulus.

Catatan: validasi di atas membuktikan source/build dasar sehat, tetapi belum membuktikan domain HTTPS final, cookie production, webhook, Midtrans production, upload proof private, dan header aktual di runtime final.

## Blocker Sebelum Production Final

Item berikut wajib selesai sebelum traffic public dibuka:

1. `.env.production` actual belum bersih.
   Audit terakhir menemukan nilai placeholder/dev-domain, `TRUSTED_PROXIES` belum ada, `DB_SSLMODE` belum ada, `S3_PAYMENT_PROOF_BUCKET` belum ada, env Google duplicate, dan beberapa credential masih placeholder. Compose actual juga memperingatkan `S3_PAYMENT_PROOF_BUCKET` kosong. Ini bisa membuat upload bukti pembayaran private gagal.

2. Google Login production image perlu diperbaiki/divalidasi.
   Frontend membaca `NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS` dan `NEXT_PUBLIC_GOOGLE_OAUTH_READY`, tetapi build arg Docker production saat ini baru memasukkan `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`, dan `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Jika env ini tidak ikut saat build, tombol Google bisa tetap disabled di production.

3. Midtrans production flag belum konsisten.
   `.env.production.example` memakai `MIDTRANS_IS_PRODUCTION=true`, tetapi kode Midtrans saat ini memilih production berdasarkan `ENV=production`. Jika runtime hanya mengisi `APP_ENV=production`, Snap client berisiko tetap memakai Sandbox.

4. Reverse proxy dan trusted proxy belum final.
   Set `TRUSTED_PROXIES` sesuai jaringan nyata nginx/Cloudflare/load balancer. Jangan hanya memakai contoh `127.0.0.1,::1` kalau backend menerima traffic dari subnet Docker/reverse proxy lain.

5. Runtime production-like belum diverifikasi.
   Wajib uji di domain HTTPS final: login customer, login admin, Google Login, refresh cookie, checkout, Midtrans, upload bukti, admin preview bukti, confirm payment, update resi, webhook, CORS, CSP, dan security headers.

6. Scope PRD belum final.
   COD masih belum diimplementasikan. Jika production final harus full sesuai PRD, tambahkan COD approval-first sebelum go-live. Jika COD ditunda, tulis keputusan product secara eksplisit.

## 1. Domain dan HTTPS

- Siapkan domain production, misalnya `https://orchidmart.com`.
- Pastikan domain mengarah ke server, Cloudflare Tunnel, atau reverse proxy final.
- Production wajib memakai HTTPS.
- Jika memakai Cloudflare Tunnel, pastikan public hostname mengarah ke service nginx production.
- Jika memakai VPS biasa, pasang TLS terminator seperti Cloudflare, Nginx + Let's Encrypt, Caddy, atau reverse proxy lain.

Wajib dicek:

- `https://domain-anda.com/` membuka frontend.
- `https://domain-anda.com/api/v1/healthz` mengembalikan health API.
- `https://domain-anda.com/api/v1/readyz` mengembalikan ready API.
- Browser melihat origin yang sama dengan Google OAuth Console dan `NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS`.

## 2. File Environment Production

Gunakan `.env.production` sebagai sumber konfigurasi production. File ini harus tetap ignored dari Git.

Minimal variabel penting:

```env
APP_ENV=production
ENV=production
APP_PORT=8080
PUBLIC_BASE_URL=https://domain-anda.com
CORS_ALLOWED_ORIGINS=https://domain-anda.com
FRONTEND_URL=https://domain-anda.com
NEXT_PUBLIC_API_URL=https://domain-anda.com/api/v1
```

Catatan:

- `ENV=production` masih perlu diisi selama kode Midtrans masih membaca `ENV`.
- `CORS_ALLOWED_ORIGINS` tidak boleh wildcard.
- Di production, origin CORS wajib HTTPS.
- `FRONTEND_URL` dipakai untuk membuat tautan reset kata sandi.
- Semua `NEXT_PUBLIC_*` dibaca saat frontend build. Setelah nilainya berubah, frontend wajib di-build ulang.

Checklist env actual:

- [ ] Tidak ada `change-this-*`.
- [ ] Tidak ada `example.com`.
- [ ] Tidak ada password default seperti `secretpassword` atau `Admin123!`.
- [ ] Tidak ada key duplicate dengan nilai berbeda.
- [ ] Semua env wajib di compose dan aplikasi terisi.
- [ ] `.env.production` tidak tracked Git.

## 3. Secret dan Kredensial

Ganti semua placeholder dan kredensial development.

```env
JWT_SECRET=secret-panjang-random-minimal-32-karakter
ADMIN_EMAIL=admin@domain-anda.com
ADMIN_PASSWORD=password-admin-yang-kuat
ADMIN_NAME=OrchidMart Admin
```

Wajib:

- Gunakan `JWT_SECRET` acak, panjang, dan unik.
- Jangan memakai password admin default.
- Jangan memakai password database default.
- Jangan commit `.env.production`.
- Jika secret pernah dibagikan di chat, screenshot, atau repository, lakukan rotasi sebelum go-live.

## 4. Google Login

Flow saat ini memakai Google Identity Services di frontend. Browser menerima `credential` ID token, lalu frontend mengirimnya ke backend `POST /api/v1/auth/google`. Backend memverifikasi signature, issuer, audience, expiry, dan `email_verified`.

Environment yang perlu diisi:

```env
GOOGLE_CLIENT_ID=client-id-google-anda.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=client-id-google-anda.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS=https://domain-anda.com
NEXT_PUBLIC_GOOGLE_OAUTH_READY=true
```

Di Google Cloud Console, OAuth Client type harus **Web application**. Isi **Authorized JavaScript origins**:

```txt
https://domain-anda.com
```

Untuk pengujian lokal, tambahkan juga:

```txt
http://localhost:3000
```

Wajib:

- Gunakan Client ID, bukan Client Secret.
- `GOOGLE_CLIENT_ID` dan `NEXT_PUBLIC_GOOGLE_CLIENT_ID` harus sama.
- `NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS` harus persis sama dengan `window.location.origin` di browser production.
- `NEXT_PUBLIC_GOOGLE_OAUTH_READY=true` hanya setelah Google Console origin sudah benar.
- Pastikan `frontend/Dockerfile` dan `docker-compose.prod.yml` ikut mengirim `NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS` dan `NEXT_PUBLIC_GOOGLE_OAUTH_READY` saat build.
- Setelah env `NEXT_PUBLIC_*` berubah, rebuild frontend.

Defense-in-depth yang masih disarankan:

- Tambahkan nonce Google login dan verifikasi nonce di backend.
- Putuskan apakah admin boleh login lewat Google. Jika boleh, akun Google admin wajib MFA. Jika tidak, blok Google login untuk role admin.

## 5. Email Reset Kata Sandi

Reset kata sandi production membutuhkan SMTP aktif.

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USERNAME=username-smtp
SMTP_PASSWORD=password-smtp
SMTP_FROM=noreply@domain-anda.com
```

Wajib diuji:

- Form lupa kata sandi mengirim email sungguhan.
- Email masuk ke inbox pelanggan.
- Tautan reset mengarah ke domain production.
- Tautan reset berlaku 30 menit.
- Tautan reset tidak bisa dipakai ulang setelah berhasil digunakan.
- Setelah reset password, sesi lama invalid karena refresh token direvoke.

## 6. Database

Jika memakai PostgreSQL dari Docker production:

```env
DB_USER=orchidmart
DB_PASSWORD=password-database-kuat
DB_NAME=orchidmart
DB_PORT=5432
DB_SSLMODE=disable
```

Jika memakai managed database eksternal:

```env
DB_SSLMODE=require
```

atau lebih baik:

```env
DB_SSLMODE=verify-full
DB_SSLROOTCERT=/path/ke/ca.crt
```

Wajib:

- Isi `DB_SSLMODE`; production code akan menolak env kosong.
- Backup database sebelum rilis besar.
- Pastikan volume `pgdata` tidak terhapus saat deploy.
- Pastikan database hanya bisa diakses dari jaringan privat aplikasi.

## 7. Storage Gambar dan Bukti Pembayaran

Production saat ini memakai S3-compatible storage melalui MinIO/R2/S3.

```env
STORAGE_DRIVER=s3
S3_ACCESS_KEY=access-key
S3_SECRET_KEY=secret-key
S3_BUCKET=orchidmart-images
S3_PAYMENT_PROOF_BUCKET=orchidmart-payment-proofs
S3_USE_SSL=false
S3_PUBLIC_URL=https://domain-anda.com/media/orchidmart-images
UPLOAD_PUBLIC_URL=https://domain-anda.com/uploads
```

Wajib:

- `S3_BUCKET` untuk gambar produk boleh public.
- `S3_PAYMENT_PROOF_BUCKET` harus private.
- `S3_PAYMENT_PROOF_BUCKET` wajib diisi di `.env.production`.
- `S3_PAYMENT_PROOF_BUCKET` tidak boleh sama dengan `S3_BUCKET`.
- Bukti pembayaran hanya boleh dibuka melalui endpoint backend yang membutuhkan login.
- Uji upload gambar produk dari admin.
- Uji upload bukti transfer dari pelanggan.
- Uji admin dapat melihat bukti transfer.

## 8. Midtrans

Isi kredensial production dari Midtrans.

```env
MIDTRANS_SERVER_KEY=server-key-production
MIDTRANS_CLIENT_KEY=client-key-production
MIDTRANS_IS_PRODUCTION=true
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=client-key-production
ENV=production
```

Catatan penting:

- Saat dokumen ini ditulis, kode Midtrans memilih environment dengan `ENV=production`, bukan `MIDTRANS_IS_PRODUCTION`.
- Sebelum go-live, perbaiki kode agar membaca `config.IsProduction()` atau `MIDTRANS_IS_PRODUCTION`, atau pastikan `ENV=production` ikut diset.

Wajib:

- Pastikan memakai key production, bukan sandbox, saat benar-benar live.
- Untuk uji sebelum live, gunakan sandbox dengan domain production-like jika memungkinkan.
- Konfigurasi webhook Midtrans ke:

```txt
https://domain-anda.com/api/v1/webhooks/midtrans
```

atau:

```txt
https://domain-anda.com/api/v1/payments/webhook/midtrans
```

Wajib diuji:

- Pembayaran berhasil.
- Pembayaran kedaluwarsa.
- Webhook mengubah payment/order status.
- Nominal order sama dengan nominal pembayaran.
- VA, e-wallet, dan kartu sesuai metode yang diaktifkan.

## 9. RajaOngkir

Isi API key RajaOngkir:

```env
RAJAONGKIR_API_KEY=api-key-rajaongkir
```

Wajib diuji:

- Daftar provinsi tampil.
- Daftar kota tampil.
- Ongkir dapat dihitung.
- Kurir PRD `jne`, `jnt`, `sicepat`, `anteraja`, dan `pos` sesuai provider final.
- Checkout tidak dapat lanjut jika layanan pengiriman belum dipilih.
- Putuskan apakah fallback ongkir boleh aktif di production. Untuk harga live serius, fallback simulasi sebaiknya dimatikan atau diberi kontrol operasional yang jelas.

## 10. Reverse Proxy, Nginx, dan Trusted Proxies

Production compose memakai nginx sebagai reverse proxy.

Jika backend berjalan di balik nginx, Cloudflare, atau load balancer, set:

```env
TRUSTED_PROXIES=127.0.0.1,172.16.0.0/12
```

Sesuaikan dengan jaringan nyata server.

Wajib:

- `TRUSTED_PROXIES` tidak kosong di production.
- Jangan trust seluruh internet seperti `0.0.0.0/0`.
- `X-Forwarded-For` dan `X-Forwarded-Proto` diteruskan dengan benar.
- `ClientIP()` di backend terbaca sesuai IP client/proxy yang diharapkan.
- Rate limit dan admin IP allowlist diuji dari domain final.
- Route `/api/v1` dapat diakses dari frontend production.

## 11. Cookie, Session, dan Auth

Auth saat ini memakai access token in-memory di frontend dan refresh token di cookie `HttpOnly`.

Wajib dicek di browser production:

- Cookie `refresh_token` punya `HttpOnly`.
- Cookie `refresh_token` punya `Secure`.
- Cookie `refresh_token` punya `SameSite=Lax`.
- Cookie path adalah `/api/v1/auth`.
- Reload halaman setelah login tetap menghidrasi sesi lewat `/auth/refresh`.
- Logout menghapus cookie dan sesi frontend.
- Akun customer tidak bisa membuka endpoint/page admin.
- Admin mutation butuh token fresh sesuai step-up logic.

Catatan:

- `SameSite=Lax` cocok jika frontend dan API masih same-site. Jika nanti frontend/API beda eTLD+1, perlu evaluasi `SameSite=None; Secure`.

## 12. Security Header dan CORS

Wajib dicek setelah deploy:

- `Content-Security-Policy` aktif.
- `X-Frame-Options` atau `frame-ancestors` tidak membuka iframe sembarangan.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy` aktif.
- CORS hanya menerima domain production.
- Origin selain domain production ditolak.

Catatan:

- Google Login membutuhkan script dari `https://accounts.google.com`.
- Google Login juga membutuhkan `frame-src` ke `https://accounts.google.com`.
- Jika CSP memblokir tombol Google, pastikan `script-src`, `frame-src`, dan `connect-src` mengizinkan Google Identity Services secara terbatas.

## 13. Admin dan Role

Sebelum go-live:

- Ganti password admin.
- Batasi siapa saja yang memiliki role `admin`.
- Pertimbangkan `ADMIN_IP_ALLOWLIST`, VPN, atau Cloudflare Access.
- Uji login admin.
- Uji admin dapat mengelola produk, stok, gambar, pesanan, kupon, dan konfirmasi pembayaran.
- Pastikan akun pelanggan biasa tidak bisa membuka halaman admin.
- Putuskan apakah admin boleh login via Google.

## 14. Fitur PRD Yang Belum Final

Jika targetnya production final sesuai PRD, item ini perlu keputusan:

- COD belum diimplementasikan. Jika wajib, tambahkan metode `cod`, batas area, batas maksimum order, status approval-first, dan approve/reject admin.
- Admin order filtering/search masih client-side. Untuk order banyak, tambahkan server-side pagination/filter.
- Analytics dashboard masih ringkas, belum full MoM/YoY, CLV, retention, courier/payment trend.
- Invoice/packing slip belum berupa dokumen siap cetak.
- Real-time tracking ekspedisi perlu verifikasi provider final.

Jika item di atas ditunda, tulis di release note sebagai out-of-scope production awal.

## 15. Build dan Deploy

Perintah deploy production:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Cek status container:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

Cek log:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f api
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f frontend
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f nginx
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f minio-init
```

Jika memakai Cloudflare Tunnel, cek juga:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f cloudflared
```

## 16. Verifikasi Teknis Sebelum Go-Live

Jalankan minimal:

```bash
cd backend
go test ./...
go vet ./...
go run golang.org/x/vuln/cmd/govulncheck@latest ./...
```

```bash
cd frontend
npm.cmd run lint
npm.cmd run build
npm.cmd audit --omit=dev
```

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production config --quiet
```

Jika build frontend gagal karena Google Fonts, pastikan server build memiliki akses internet ke:

```txt
https://fonts.googleapis.com
https://fonts.gstatic.com
```

## 17. Verifikasi Runtime Production-Like

Uji dari browser production:

- Daftar akun dengan email biasa.
- Masuk dengan email dan kata sandi.
- Masuk/daftar dengan Google.
- Lupa kata sandi sampai email diterima.
- Reset kata sandi berhasil.
- Link reset kedaluwarsa setelah 30 menit.
- Tambah produk ke keranjang.
- Ubah jumlah item keranjang.
- Checkout item terpilih.
- Hitung ongkir.
- Pembayaran manual transfer.
- Upload bukti transfer.
- Admin melihat bukti transfer.
- Admin konfirmasi pembayaran.
- Midtrans VA/e-wallet/card sampai webhook masuk.
- Status order berubah sesuai alur.
- Admin input nomor resi.
- Pelanggan melihat riwayat pesanan.
- Pelanggan konfirmasi barang diterima.
- Pelanggan membuat review setelah order selesai.

## 18. Monitoring dan Backup

Minimal siapkan:

- Backup database terjadwal.
- Backup object storage.
- Log container tersimpan.
- Alert jika backend mati.
- Alert jika disk hampir penuh.
- Alert jika email SMTP gagal.
- Alert jika webhook pembayaran gagal.
- Monitoring penggunaan CPU, RAM, disk, dan network.
- Prosedur restore database dan file upload.

## 19. Checklist Go-Live Singkat

- [ ] Domain production aktif dan memakai HTTPS.
- [ ] `.env.production` berisi nilai asli, bukan placeholder.
- [ ] `APP_ENV=production` dan `ENV=production` diset.
- [ ] `JWT_SECRET` kuat dan unik.
- [ ] Password admin sudah diganti.
- [ ] Database production siap dan dibackup.
- [ ] `DB_SSLMODE` terisi sesuai topology.
- [ ] `TRUSTED_PROXIES` sesuai reverse proxy final.
- [ ] Google Login sudah dikonfigurasi dan env build Docker lengkap.
- [ ] SMTP sudah mengirim email reset kata sandi.
- [ ] Midtrans environment benar-benar production atau sandbox sesuai fase uji.
- [ ] Webhook Midtrans tersambung.
- [ ] RajaOngkir sudah aktif dan kurir final diuji.
- [ ] S3/MinIO memisahkan bucket public dan private.
- [ ] `S3_PAYMENT_PROOF_BUCKET` terisi dan berbeda dari `S3_BUCKET`.
- [ ] CORS hanya mengizinkan domain production.
- [ ] Cookie refresh token aman di HTTPS.
- [ ] Upload gambar produk berhasil.
- [ ] Upload bukti transfer berhasil dan private.
- [ ] Admin dapat melihat dan mengonfirmasi bukti pembayaran.
- [ ] `go test ./...` lolos.
- [ ] `go vet ./...` lolos.
- [ ] `govulncheck ./...` lolos.
- [ ] `npm.cmd run lint` lolos.
- [ ] `npm.cmd run build` lolos.
- [ ] `npm.cmd audit --omit=dev` bersih.
- [ ] `docker compose ... config --quiet` lolos dengan `.env.production` actual.
- [ ] Secret tidak masuk Git.
- [ ] Keputusan COD dicatat: diimplementasikan atau resmi ditunda.

## 20. Catatan Penting

- Jangan memakai `.env.production` untuk development lokal.
- Untuk development lokal, gunakan `backend/.env` dan `frontend/.env.local`.
- Jika `NEXT_PUBLIC_*` berubah, frontend harus di-build ulang.
- Jika `GOOGLE_CLIENT_ID` berubah, backend harus direstart.
- Jika `JWT_SECRET` berubah, semua sesi login lama akan tidak valid.
- Jika menggunakan Cloudflare Tunnel, domain Google OAuth tetap harus memakai domain publik yang dilihat browser.
- Jangan klaim production final sebelum runtime domain HTTPS final selesai diuji.
