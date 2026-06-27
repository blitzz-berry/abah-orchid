# 🌸 OrchidMart - E-Commerce Platform

OrchidMart adalah platform e-commerce modern yang dirancang untuk penjualan tanaman anggrek dan kebutuhan berkebun lainnya. Platform ini dibangun dengan arsitektur monorepo yang memisahkan frontend (tampilan pengguna dan panel admin) dengan backend (layanan API performa tinggi).

---

## 🚀 Fitur Utama

- **Dashboard Admin**: Panel ringkasan analytics penjualan harian, status pesanan, alert produk low-stock, dan manajemen pesanan.
- **Manajemen Produk & Inventori**: Sistem katalog produk anggrek beserta kontrol stok otomatis.
- **Autentikasi Aman**: Registrasi dan login menggunakan JWT (JSON Web Token) dengan penyimpanan password ter-hash (`bcrypt`).
- **Integrasi Pembayaran**: Sistem pembayaran otomatis menggunakan payment gateway Midtrans.
- **Kalkulasi Ongkos Kirim**: Integrasi API RajaOngkir untuk perhitungan biaya pengiriman secara real-time.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS & Framer Motion (untuk animasi premium)
- **Icons**: Lucide React
- **State Management**: Zustand / React Context

### Backend
- **Language**: Go (Golang)
- **Framework**: Gin Gonic (Web Framework)
- **Database**: PostgreSQL (GORM / ORM)
- **Cache**: Redis
- **Authentication**: JWT & Go-Bcrypt

---

## 📂 Struktur Proyek

```text
ecommerce-kp/
├── backend/            # Aplikasi API Backend (Go)
│   ├── cmd/server/     # Entry point server (main.go)
│   └── internal/       # Logika bisnis terstruktur (handler, service, repository, model, dto)
├── frontend/           # Aplikasi Web & Admin Panel (Next.js)
│   ├── src/app/        # Struktur routing Next.js App Router
│   ├── src/components/ # Komponen UI reusable (Navbar, Footer, dsb.)
│   └── src/lib/        # Helpers API, konfigurasi fetcher, & real-time
├── docker-compose.yml  # PostgreSQL & Redis lokal untuk development
└── README.md           # Dokumentasi proyek
```

---

## ⚙️ Petunjuk Pengembangan Lokal

### Prerequisites
Pastikan Anda sudah menginstal:
- Docker & Docker Compose
- Go (versi terbaru)
- Node.js & npm

### Langkah-langkah Menjalankan

1. **Clone Repositori & Masuk ke Folder Proyek**
   ```bash
   git clone https://github.com/blitzz-berry/abah-orchid.git
   cd abah-orchid
   ```

2. **Jalankan Database & Cache (Docker)**
   Jalankan container PostgreSQL dan Redis di latar belakang:
   ```bash
   docker compose up -d postgres redis
   ```

3. **Jalankan API Backend (Go)**
   Masuk ke direktori backend, lalu jalankan server:
   ```bash
   cd backend
   go run ./cmd/server
   ```
   *Backend akan berjalan di port `http://localhost:8080`*

4. **Jalankan Frontend (Next.js)**
   Buka terminal baru di root proyek, masuk ke direktori frontend, instal dependensi, lalu jalankan server development:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *Frontend akan berjalan di port `http://localhost:3000`*

---

## 🧪 Pengujian (Whitebox Testing)

Proyek ini dilengkapi dengan unit testing komprehensif di sisi backend untuk menguji fungsionalitas logika bisnis, middleware, dan modul pembayaran secara internal.

Jalankan semua pengujian dengan perintah berikut:
```bash
cd backend
go test -v ./...
```

Untuk melihat persentase cakupan kode (*coverage report*):
```bash
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

---

## 📝 Panduan Commit (Conventional Commits)

Untuk menjaga kerapian riwayat perubahan kode di GitHub, biasakan menggunakan format **Conventional Commits**:
- `feat: ...` untuk penambahan fitur baru (misal: `feat: add midtrans payment trigger`)
- `fix: ...` untuk perbaikan bug (misal: `fix: resolve token validation crash`)
- `docs: ...` untuk perubahan dokumentasi (misal: `docs: update readme guide`)
- `style: ...` untuk format kode (misal: running gofmt / prettier)
