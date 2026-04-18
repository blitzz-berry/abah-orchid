# Panduan Setup & Konfigurasi OrchidMart

Biar OrchidMart bisa langsung jalan di server lokal (laptop) kamu, ini dia beberapa langkah **Setup Environment** dan **Cara Menjalankannya** sesuai dengan konfigurasi yang udah kita bangun.

## ⚙️ 1. Persiapan Infrastruktur (Wajib)
Pastikan kamu udah install *tools* di bawah ini sebelum mulai:
1. **Docker Desktop:** Wajib jalan. Digunakan buat ngejalanin database PostgreSQL dan Redis secara instan tanpa perlu repot install local.
2. **Node.js (v18.x++):** Digunakan buat nge-run environment Next.js (Frontend).
3. **Golang (v1.21++):** Digunakan buat build dan jalanin API Backend.
4. **Akun Midtrans Sandbox:** Buat ngetes payment gateway. (Daftar di midtrans.com buat dapet *Client Key* & *Server Key*).

---

## 🔑 2. Atur Environment Backend (Golang)
Bikin/Edit file `.env` di dalam folder `d:\web kp\ecommerce-kp\backend`, lalu isi dengan *value* ini:

```env
# SERVER INFO
PORT=8080
ENV=development

# DATABASE POSTGRES (Sesuai dengan docker-compose.yml)
DB_HOST=localhost
DB_PORT=5432
DB_USER=orchidmart
DB_PASSWORD=secretpassword
DB_NAME=orchidmart

# SECURITY
JWT_SECRET=bikin_rahasia_lo_disini_biar_aman_bos

# MIDTRANS GATEWAY
MIDTRANS_SERVER_KEY=SB-Mid-server-KODE_RAHASIA_DARI_MIDTRANS_LO
```
*(Catatan: Tanpa file `.env` ini, backend GORM pake fallback otomatis ke database localhost/orchidmart, cuma JWT dan Midtrans-nya butuh kunci spesifik)*

---

## 🌐 3. Atur Environment Frontend (Next.js)
Bikin/Edit file `.env.local` di dalam folder `d:\web kp\ecommerce-kp\frontend`, lalu isi dengan *value* berikut ini:

```env
# Koneksi langsung tembak ke Backend API Golang
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1

# Buat UI Pop-up Midtrans kalau nanti dipakai via Snap.js di halaman Checkout
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-KODE_CLIENT_DARI_MIDTRANS
```

---

## 🚀 4. Cara Menjalankan (The Ultimate Start)
Buka 3 terminal (CMD/Powershell) berbeda biar rapi, lalu jalankan sesuai urutan ini:

### Terminal 1: Nyalain Database (Postgres & Redis)
Nyalain container databasenya dengan command Docker:
```bash
cd "d:\web kp\ecommerce-kp"
docker-compose up -d
```
*(Tunggu sekitar 10-15 detik biar databasenya statusnya 'ready-to-accept-connections')*

### Terminal 2: Nyalain Backend API & Auto-Migrate Tabel
Waktunya nyalain Golang. Pas Go-nya jalan, GORM secara otomatis bakal ngubah semua model struktur (User, Cart, Order, Product, Dll) jadi tabel riil di Postgres.
```bash
cd "d:\web kp\ecommerce-kp\backend"
go run ./cmd/server
```

### Terminal 3: Nyalain Frontend Website
Sekarang tinggal nge-run UI Next.js-nya:
```bash
cd "d:\web kp\ecommerce-kp\frontend"
npm run dev
```

---

## 🎯 Akses URL
Setelah 3 command di atas nyala tanpa error, lo udah bisa tes nge-review dan nyoba flow OrchidMart:
- **Toko Utama (B2C & B2B):** [http://localhost:3000](http://localhost:3000)
- **Halaman Login/Register:** [http://localhost:3000/login](http://localhost:3000/login)
- **Dashboard Cart:** [http://localhost:3000/cart](http://localhost:3000/cart)
- **Dashboard Admin:** [http://localhost:3000/admin](http://localhost:3000/admin)
