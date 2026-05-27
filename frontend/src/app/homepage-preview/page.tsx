"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  Heart,
  Leaf,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react";
import Footer from "@/components/ui/Footer";
import Navbar from "@/components/ui/Navbar";

const categories = [
  { name: "Phalaenopsis", count: "24 koleksi" },
  { name: "Dendrobium", count: "18 koleksi" },
  { name: "Vanda", count: "12 koleksi" },
  { name: "Cattleya", count: "15 koleksi" },
  { name: "Bibit", count: "31 stok" },
  { name: "Grosir", count: "Paket batch" },
];

const featuredProducts = [
  {
    name: "Phalaenopsis Amabilis Premium",
    category: "Anggrek berbunga",
    price: "Rp 185.000",
    badge: "Ready bloom",
    image: "/images/anggrek.png",
  },
  {
    name: "Dendrobium Seedling Mix",
    category: "Bibit unggul",
    price: "Rp 45.000",
    badge: "Pemula",
    image: "/images/kebun.png",
  },
  {
    name: "Vanda Tricolor Rare Collection",
    category: "Koleksi langka",
    price: "Rp 320.000",
    badge: "Rare",
    image: "/images/kebun1.png",
  },
  {
    name: "Nursery Selection Pack",
    category: "Paket nursery",
    price: "Mulai Rp 1.250.000",
    badge: "Grosir",
    image: "/images/anggrek.png",
  },
];

const careCollections = [
  { title: "Cocok untuk pemula", copy: "Varietas tahan adaptasi dan mudah dirawat.", icon: Leaf },
  { title: "Siap berbunga", copy: "Pilihan tanaman mature untuk koleksi rumah.", icon: Sparkles },
  { title: "Stok nursery", copy: "Pilihan stok sehat untuk toko tanaman dan florist.", icon: PackageCheck },
];

export default function HomepagePreview() {
  return (
    <div className="min-h-screen bg-[#fbfaf7] text-stone-950 dark:bg-zinc-950 dark:text-stone-50">
      <Navbar />
      <main>
        <section className="relative min-h-[88vh] overflow-hidden">
          <img
            src="/images/kebun1.png"
            alt="Kebun anggrek OrchidMart"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/78 via-black/45 to-black/10" />
          <div className="relative mx-auto flex min-h-[88vh] max-w-7xl items-center px-5 py-28 sm:px-6 lg:px-8">
            <div className="max-w-3xl text-white">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-4 py-2 text-sm font-semibold backdrop-blur">
                <BadgeCheck className="h-4 w-4 text-emerald-200" />
                Nursery pilihan untuk kolektor dan reseller
              </div>
              <h1 className="max-w-3xl text-5xl font-black leading-[0.98] md:text-7xl">
                Anggrek premium, dikurasi langsung dari nursery.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-white/82 md:text-xl">
                Pilih anggrek berbunga, bibit unggul, dan koleksi nursery dengan stok yang jelas serta packing aman untuk tanaman hidup.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/products"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-4 text-base font-extrabold text-stone-950 shadow-xl shadow-black/20 transition-transform hover:scale-[1.02]"
                >
                  Belanja Sekarang <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 border-t border-white/15 bg-black/24 backdrop-blur-md">
            <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-3 sm:px-6 lg:px-8">
              {[
                { value: "500+", label: "tanaman siap kirim" },
                { value: "24h", label: "validasi pembayaran" },
                { value: "Nursery", label: "stok pilihan" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-4 text-white">
                  <div className="font-display text-3xl font-black">{item.value}</div>
                  <div className="text-sm font-medium text-white/70">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mx-auto max-w-7xl px-5 py-6 sm:px-6 lg:px-8">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {categories.map((category) => (
                <Link
                  key={category.name}
                  href="/products"
                  className="min-w-[170px] rounded-2xl border border-stone-200 bg-[#fbfaf7] p-4 transition-colors hover:border-[var(--color-brand-400)] hover:bg-[var(--color-brand-50)] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-[var(--color-brand-700)]"
                >
                  <div className="text-sm font-extrabold">{category.name}</div>
                  <div className="mt-1 text-xs font-medium text-stone-500 dark:text-zinc-400">{category.count}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 text-sm font-extrabold uppercase tracking-wide text-[var(--color-brand-700)] dark:text-[var(--color-brand-200)]">
                Koleksi pilihan
              </p>
              <h2 className="max-w-2xl text-4xl font-black leading-tight md:text-5xl">Tanaman yang siap masuk keranjang hari ini.</h2>
            </div>
            <Link href="/products" className="inline-flex items-center gap-1 text-sm font-extrabold text-[var(--color-brand-700)] dark:text-[var(--color-brand-200)]">
              Lihat katalog <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProducts.map((product) => (
              <Link
                key={product.name}
                href="/products"
                className="group overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-stone-100 dark:bg-zinc-800">
                  <img src={product.image} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <span className="absolute left-3 top-3 rounded-full bg-white/92 px-3 py-1 text-xs font-extrabold text-stone-900 shadow-sm">
                    {product.badge}
                  </span>
                  <button className="absolute right-3 top-3 rounded-full bg-white/92 p-2 text-stone-900 shadow-sm">
                    <Heart className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-zinc-400">{product.category}</div>
                  <h3 className="mt-2 min-h-12 text-base font-extrabold leading-snug">{product.name}</h3>
                  <div className="mt-4 text-lg font-black text-[var(--color-brand-700)] dark:text-[var(--color-brand-200)]">{product.price}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-stone-950 text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div>
              <p className="mb-3 text-sm font-extrabold uppercase tracking-wide text-emerald-200">Belanja lebih yakin</p>
              <h2 className="text-4xl font-black leading-tight md:text-5xl">Bukan sekadar listing produk, tapi alur kirim tanaman yang jelas.</h2>
              <p className="mt-6 max-w-xl text-base leading-7 text-white/68">
                OrchidMart menonjolkan stok, metode bayar, pengemasan, dan status pesanan supaya pembeli tahu tanaman yang dipesan benar-benar diproses.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: ShieldCheck, title: "Bukti pembayaran diverifikasi", copy: "Transfer manual masuk ke antrian admin sebelum pesanan diproses." },
                { icon: Truck, title: "Packing tanaman hidup", copy: "Pilihan packing dan asuransi membantu mengurangi risiko pengiriman." },
                { icon: Search, title: "Stok mudah dipindai", copy: "Koleksi bisa dibaca cepat berdasarkan kategori, ukuran, dan status stok." },
                { icon: ShoppingBag, title: "Pilihan nursery", copy: "Koleksi batch dan stok bibit tetap bisa ditampilkan tanpa jalur promo khusus." },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <item.icon className="h-6 w-6 text-emerald-200" />
                  <h3 className="mt-4 text-lg font-extrabold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/62">{item.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-5 md:grid-cols-3">
            {careCollections.map((item) => (
              <Link
                key={item.title}
                href="/products"
                className="rounded-2xl border border-stone-200 bg-white p-6 transition-colors hover:border-[var(--color-brand-400)] dark:border-zinc-800 dark:bg-zinc-900"
              >
                <item.icon className="h-7 w-7 text-[var(--color-leaf-600)]" />
                <h3 className="mt-5 text-xl font-extrabold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-zinc-400">{item.copy}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="grid lg:grid-cols-2">
              <div className="relative min-h-[340px]">
                <img src="/images/kebun.png" alt="Stok anggrek nursery" className="absolute inset-0 h-full w-full object-cover" />
              </div>
              <div className="p-8 sm:p-10 lg:p-14">
                <p className="mb-3 text-sm font-extrabold uppercase tracking-wide text-[var(--color-brand-700)] dark:text-[var(--color-brand-200)]">
                  Koleksi Nursery
                </p>
                <h2 className="text-4xl font-black leading-tight">Pilih stok anggrek langsung dari katalog utama.</h2>
                <p className="mt-5 text-base leading-7 text-stone-600 dark:text-zinc-300">
                  Preview ini tetap bisa menampilkan stok pilihan dan bibit tanpa membuat jalur promosi terpisah di homepage.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link href="/products" className="inline-flex items-center justify-center rounded-full border border-stone-300 px-7 py-3.5 font-extrabold dark:border-zinc-700">
                    Semua Produk
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
