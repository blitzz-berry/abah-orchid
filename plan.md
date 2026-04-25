Belum Sesuai / Missing Signifikan

  - Google OAuth P2 belum ada.
  - Xendit fallback belum ada.
  - GET /api/v1/auth/me belum ada.
  - DELETE /api/v1/cart clear cart belum exposed.
  - GET /api/v1/admin/orders/:id detail admin order belum exposed sebagai route terpisah.
  - GET /api/v1/admin/inventory, PUT /api/v1/admin/inventory/:product_id, GET /api/v1/admin/inventory/low-stock belum sesuai
    endpoint PRD; implementasi pakai product stock adjustment dan /admin/inventory/movements.
  - Suspend/blacklist customer belum ada.
  - B2B bulk order / harga grosir / faktur bisnis belum ada walau customer_type sudah disiapkan.
  - Monitoring, Redis cache, pgbouncer, CDN/S3 belum terimplementasi.



  Fitur yang masih parsial setelah perbaikan terakhir:

  - Checkout & payment: backend sudah ada Midtrans, COD, manual proof upload, expiry 24 jam, tapi UI baru expose Midtrans/COD.
    Transfer bank manual, e-wallet spesifik, kartu kredit, dan upload bukti transfer dari UI belum lengkap.
    
  - Shipping: cek ongkir RajaOngkir ada, packing tanaman hidup ada, input resi admin ada. Tracking real-time masih stub,
    ekspedisi belum selengkap PRD, dan rekomendasi layanan kilat belum benar-benar otomatis.
  - Admin produk: CRUD dasar ada, tapi UI belum lengkap untuk edit produk, status active/inactive/draft, upload multiple image,
    duplikat produk, dan bulk update harga.
  - Inventory: tracking stok, movement log, low stock, reduce/restore stok sudah ada. Tapi unit inventori masih melekat di
    produk, belum ada workflow batch/varietas yang matang, stock overview UI/endpoint baru dasar, dan stock movement chart belum
    ada.
  - Dashboard analytics: revenue, order count, AOV, chart sales, top products, inventory summary, customer summary sudah ada.
    Yang masih kurang: conversion rate valid, category bestseller detail, MoM/YoY, stock turnover, customer geography, CLV,
    retention, seasonal trend, demand prediction.
  - Customer management: list customer dan detail order history ada. Segmentasi B2B/B2C baru berupa field, belum ada workflow
    manajemen segmentasi; blacklist/suspend belum ada.
  - Review: backend rule sudah kuat dan test sudah ada, UI dasar sudah ada. Belum ada moderation/admin management review.
  - Coupon/voucher: model dan kalkulasi backend ada, tapi UI checkout dan admin CRUD coupon belum matang.
  - Security/NFR: JWT refresh rotation, bcrypt, CSP, CORS whitelist, file validation, login rate limit, global rate limit ada.
    Belum ada Redis-backed rate limit/session/cache, IP whitelist admin, structured logging, Prometheus/Grafana, Sentry,
    pgbouncer.
  - Storage/deployment: local upload sudah ada. PRD minta S3-compatible object storage/CDN, itu belum.
  - B2B: customer_type dan link B2B ada, tapi belum ada harga grosir, bulk order portal, faktur bisnis, atau flow negosiasi.