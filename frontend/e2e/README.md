# OrchidMart E2E

Setup E2E ini memakai `@playwright/test` dan fokus ke smoke flow yang paling penting dulu:

- login admin
- buka dashboard admin
- buka halaman manajemen pesanan
- forgot password
- login customer opsional jika kredensial customer tersedia

## Prasyarat

Jalankan service utama dulu:

1. backend di `http://localhost:8080`
2. frontend di `http://localhost:3000`

Atau biarkan Playwright menyalakan frontend sendiri lewat `npm run dev`, lalu pastikan backend tetap hidup.

## Environment Opsional

Admin fallback:

- otomatis baca `ADMIN_EMAIL` dan `ADMIN_PASSWORD` dari `backend/.env`
- kalau mau override khusus E2E, pakai:
  - `ORCHIDMART_E2E_ADMIN_EMAIL=admin@example.com`
  - `ORCHIDMART_E2E_ADMIN_PASSWORD=secret123`

Customer opsional:

- `ORCHIDMART_E2E_CUSTOMER_EMAIL=customer@example.com`
- `ORCHIDMART_E2E_CUSTOMER_PASSWORD=password123`

Opsional lain:

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000`
- `PLAYWRIGHT_SKIP_WEBSERVER=1`

`PLAYWRIGHT_SKIP_WEBSERVER=1` berguna kalau frontend sudah lu nyalain manual dan lu tidak mau Playwright start server baru.

## Command

```powershell
cd frontend
npm run test:e2e
```

Mode headed:

```powershell
cd frontend
npm run test:e2e:headed
```

## Catatan

- test customer orders akan otomatis di-skip kalau env customer belum disediakan
- flow Google login tidak dijadikan smoke test lokal karena sangat sensitif terhadap origin OAuth dan tunnel
- smoke test ini sengaja ringan dulu supaya stabil dan cepat dipakai sehari-hari
