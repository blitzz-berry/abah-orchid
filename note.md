# Note Deploy VPS OrchidMart

Checklist ini dipakai saat deploy manual ke VPS, terutama setelah storage production diganti dari S3/MinIO ke local storage.

## 1. File Environment Production

Buat file `.env.production` dari template:

```bash
cp .env.production.example .env.production
```

Lalu edit:

```bash
nano .env.production
```

## 2. Konfigurasi URL Jika Belum Pakai Domain

Kalau VPS belum memakai domain, gunakan IP VPS.

Contoh:

```env
PUBLIC_BASE_URL=http://IP_VPS
FRONTEND_URL=http://IP_VPS
CORS_ALLOWED_ORIGINS=http://IP_VPS
NEXT_PUBLIC_API_URL=http://IP_VPS/api/v1
UPLOAD_PUBLIC_URL=http://IP_VPS/uploads
```

Jika sudah memakai domain dan HTTPS, ubah menjadi:

```env
PUBLIC_BASE_URL=https://domain-lu.com
FRONTEND_URL=https://domain-lu.com
CORS_ALLOWED_ORIGINS=https://domain-lu.com
NEXT_PUBLIC_API_URL=https://domain-lu.com/api/v1
UPLOAD_PUBLIC_URL=https://domain-lu.com/uploads
```

## 3. Konfigurasi Local Storage

Untuk deploy awal, gunakan local storage:

```env
STORAGE_DRIVER=local
UPLOAD_DIR=/app/uploads
PRIVATE_UPLOAD_DIR=/app/private_uploads
UPLOAD_PUBLIC_URL=http://IP_VPS/uploads
```

Catatan:

- Gambar produk publik disimpan di volume Docker `uploads`.
- Bukti pembayaran disimpan di volume Docker `private_uploads`.
- Folder upload tidak masuk GitHub.
- Kedua volume ini wajib masuk backup VPS.

## 4. Database PostgreSQL

Wajib ganti password database:

```env
DB_USER=orchidmart
DB_PASSWORD=ganti-password-kuat
DB_NAME=orchidmart
DB_HOST=postgres
DB_SSLMODE=disable
```

`DB_SSLMODE=disable` masih aman untuk compose ini karena PostgreSQL berjalan di private Docker network. Jika nanti memakai database eksternal, gunakan `require` atau `verify-full`.

## 5. JWT dan Admin

Wajib ganti secret dan password admin:

```env
JWT_SECRET=random-panjang-minimal-32-karakter
ADMIN_EMAIL=email-admin
ADMIN_PASSWORD=password-admin-kuat
ADMIN_NAME=OrchidMart Admin
```

Jangan gunakan password contoh di production.

## 6. Midtrans

Isi key Midtrans sesuai mode yang dipakai:

```env
MIDTRANS_SERVER_KEY=isi-server-key
MIDTRANS_CLIENT_KEY=isi-client-key
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=isi-client-key
MIDTRANS_IS_PRODUCTION=true
```

Jika masih sandbox:

```env
MIDTRANS_IS_PRODUCTION=false
```

Set notification URL di dashboard Midtrans:

```txt
http://IP_VPS/api/v1/webhooks/midtrans
```

Jika sudah domain HTTPS:

```txt
https://domain-lu.com/api/v1/webhooks/midtrans
```

## 7. RajaOngkir

Isi API key RajaOngkir:

```env
RAJAONGKIR_API_KEY=isi-api-key-rajaongkir
```

Pastikan endpoint ongkir dicoba setelah backend berjalan.

## 8. SMTP Email

Isi SMTP untuk reset password dan notifikasi email:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=email-gmail
SMTP_PASSWORD=app-password-gmail
SMTP_FROM=email-gmail
```

Gunakan Gmail App Password, bukan password login Gmail biasa.

## 9. Google OAuth

Kalau login Google belum dipakai, bisa matikan dulu:

```env
NEXT_PUBLIC_GOOGLE_OAUTH_READY=false
```

Kalau ingin dipakai:

```env
GOOGLE_CLIENT_ID=client-id-google
NEXT_PUBLIC_GOOGLE_CLIENT_ID=client-id-google
NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS=http://IP_VPS
NEXT_PUBLIC_GOOGLE_OAUTH_READY=true
```

Jika sudah domain:

```env
NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS=https://domain-lu.com
```

Tambahkan origin tersebut di Google Cloud Console.

## 10. Jalankan Docker Compose Production

Dari root repo di VPS:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Cek container:

```bash
docker compose -f docker-compose.prod.yml ps
```

Cek log backend:

```bash
docker compose -f docker-compose.prod.yml logs -f api
```

Cek log frontend:

```bash
docker compose -f docker-compose.prod.yml logs -f frontend
```

## 11. Test Setelah Deploy

Test minimal:

1. Buka `http://IP_VPS`.
2. Register user.
3. Login user.
4. Buka katalog produk.
5. Upload gambar produk dari admin.
6. Pastikan gambar bisa dibuka dari `http://IP_VPS/uploads/...`.
7. Tambah produk ke cart.
8. Checkout.
9. Cek ongkir.
10. Cek pembayaran Midtrans.
11. Cek status pembayaran.
12. Cek admin melihat order.
13. Cek upload bukti transfer manual jika metode manual dipakai.

## 12. Update Manual Setelah Ada Perubahan Kode

Di VPS:

```bash
cd orchidmart
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## 13. Backup Yang Wajib

Backup minimal:

- volume PostgreSQL `pgdata`
- volume public upload `uploads`
- volume private upload `private_uploads`
- file `.env.production`

Jangan upload `.env.production` ke GitHub.
