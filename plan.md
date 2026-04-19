# 🔧 OrchidMart Frontend Overhaul Plan

## Masalah Yang Ditemukan

### 1. **Missing Pages (PRD vs Actual)**
| Halaman (PRD) | Status |
|---|---|
| Homepage | ✅ Ada, tapi tidak ada section kategori & produk terbaru |
| Products Listing | ✅ Ada, tapi filter/search belum fungsional |
| Product Detail `[slug]` | ⚠️ Ada tapi pakai `[id]` bukan `[slug]` sesuai PRD |
| Cart | ✅ Ada |
| Checkout | ❌ Gabung di cart, harusnya terpisah |
| Login | ✅ Ada |
| Register | ✅ Ada |
| Forgot Password | ❌ Belum ada |
| Profile | ❌ Belum ada |
| Orders (customer) | ❌ Belum ada |
| Order Detail | ❌ Belum ada |
| Admin Dashboard | ✅ Ada, tapi sidebar nggak navigable |
| Admin Products | ✅ Ada, tapi sidebar hilang |
| Admin Orders | ❌ Belum ada |
| Admin Inventory | ❌ Belum ada |
| Admin Customers | ❌ Belum ada |

### 2. **Masalah Struktural**
- Navbar copy-paste di setiap page, harusnya pakai shared component
- Admin tidak punya layout.tsx (sidebar shared)
- Auth store nggak persist di refresh browser
- Homepage nggak ada section kategori populer & produk terbaru/bestseller
- Footer belum ada sama sekali
- Tidak ada `components/` directory sama sekali
- Tidak ada `types/` directory

### 3. **Masalah UI/UX**
- Product detail pakai avatar placeholder bukan gambar produk real
- Kategori belum bisa di-browse
- Search dan filter di katalog belum fungsional
- Admin sidebar pakai `<a href="#">` — nggak navigasi ke mana-mana

---

## Rencana Perbaikan (Prioritas)

### Phase 1: Foundation & Shared Components
1. Bikin `types/index.ts` — TypeScript interfaces
2. Bikin shared Navbar component (storefront)
3. Bikin shared Footer component
4. Bikin Admin layout.tsx dengan sidebar navigable
5. Fix auth store persistence (hydrate dari localStorage)

### Phase 2: Fix Existing Pages
6. Homepage — tambah kategori populer, produk terbaru, bestseller, footer
7. Products — fungsionalkan search & filter + category filter
8. Product Detail — fix ke slug-based, tampilkan gallery & specs lengkap
9. Cart — pisahkan checkout flow
10. Admin Dashboard — sidebar navigable, grafik placeholder

### Phase 3: Missing Pages
11. Forgot Password page
12. Profile page
13. Orders page (customer)
14. Order Detail page
15. Admin Orders page
16. Admin Inventory page
17. Admin Customers page

---

## Execution Order
Karena ini banyak banget, gw prioritasin: **Foundation → Fix Existing → Add Missing**
