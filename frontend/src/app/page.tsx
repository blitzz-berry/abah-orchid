"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Leaf, ShoppingBag, ShieldCheck, Truck, Star, ChevronRight } from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import api from "@/lib/api";
import type { Product } from "@/types";

function ProductCard({ product, idx }: { product: Product; idx: number }) {
  const imgUrl = product.images?.[0]?.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(product.name)}&background=random&size=400`;
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: idx * 0.05 }}>
      <Link href={`/products/${product.id}`} className="glass rounded-2xl overflow-hidden hover:shadow-xl transition-all group flex flex-col h-full">
        <div className="aspect-square bg-gray-100 dark:bg-gray-800 relative overflow-hidden">
          <img src={imgUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          {product.unit_type === "PER_BATCH" && <span className="absolute top-3 left-3 bg-[var(--color-leaf-500)] text-white text-[10px] font-bold px-2 py-1 rounded-md">B2B</span>}
        </div>
        <div className="p-4 flex flex-col flex-1">
          <div className="text-xs text-gray-500 mb-1">{product.category?.name || "Anggrek"}</div>
          <h3 className="font-bold text-sm leading-tight mb-2 flex-1 line-clamp-2">{product.name}</h3>
          <div className="text-[var(--color-brand-600)] font-extrabold">Rp {product.price.toLocaleString("id-ID")}</div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get("/products");
        setProducts(res.data.data || []);
      } catch { /* silent */ } finally { setIsLoading(false); }
    };
    fetchData();
  }, []);

  const latestProducts = products.slice(0, 8);
  const b2bProduct = products.find((product) => product.unit_type === "PER_BATCH");
  const b2bImageUrl = b2bProduct?.images?.[0]?.image_url || "/images/anggrek.png";

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative flex flex-col items-center justify-center px-4 pt-32 pb-24 text-center overflow-hidden bg-[url('/images/kebun1.png')] bg-cover bg-center">
          <div className="absolute inset-0 bg-black/60" />
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="relative z-10 max-w-4xl flex flex-col items-center">
            <span className="px-4 py-1.5 rounded-full bg-white/15 text-white font-semibold text-sm mb-6 border border-white/25 backdrop-blur">🌟 Platform E-Commerce Anggrek #1 di Indonesia</span>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight text-white">
              Koleksi <span className="text-[var(--color-brand-200)]">Anggrek Premium</span><br />Untuk Koleksi & Bisnis
            </h1>
            <p className="text-lg md:text-xl text-white/85 max-w-2xl mb-12">Temukan berbagai varietas anggrek langka, bibit unggul, hingga tanaman berbunga siap panen.</p>
            <div className="flex flex-col sm:flex-row gap-4 mb-16">
              <Link href="/products" className="flex items-center justify-center gap-2 px-8 py-4 bg-white text-black rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl shadow-black/20">Mulai Belanja <ArrowRight className="w-5 h-5" /></Link>
              <Link href="/products?type=B2B" className="flex items-center justify-center gap-2 px-8 py-4 bg-transparent text-white border-2 border-white/70 rounded-full font-bold text-lg hover:bg-white/10 transition-colors">Pemesanan B2B</Link>
            </div>
          </motion.div>
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
            {[{ icon: Leaf, title: "Varietas Terlengkap", desc: "Dari Phalaenopsis hingga Vanda langka" }, { icon: ShoppingBag, title: "Harga Grosir B2B", desc: "Beli per batch dengan harga spesial" }, { icon: ShieldCheck, title: "Garansi Pengiriman", desc: "Packing premium & asuransi tanaman" }].map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }} className="flex flex-col items-center text-center p-6 rounded-2xl glass hover:shadow-lg transition-shadow">
                <div className="p-4 bg-[var(--color-brand-50)] dark:bg-[var(--color-brand-900)] rounded-2xl mb-4"><f.icon className="w-7 h-7 text-[var(--color-brand-600)] dark:text-[var(--color-brand-300)]" /></div>
                <h3 className="text-lg font-bold mb-1">{f.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Produk Terbaru */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center justify-between mb-8">
            <div><h2 className="text-3xl font-extrabold tracking-tight">Produk Terbaru</h2><p className="text-gray-500 mt-1">Koleksi anggrek yang baru ditambahkan</p></div>
            <Link href="/products" className="text-sm font-medium text-[var(--color-brand-600)] hover:underline flex items-center gap-1">Lihat Semua <ChevronRight className="w-4 h-4" /></Link>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-gray-200 border-t-[var(--color-leaf-500)] rounded-full animate-spin" /></div>
          ) : latestProducts.length === 0 ? (
            <div className="text-center py-16 glass rounded-2xl"><Leaf className="w-12 h-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">Belum ada produk. Segera hadir!</p></div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {latestProducts.map((p, i) => <ProductCard key={p.id} product={p} idx={i} />)}
            </div>
          )}
        </section>

        {/* CTA Banner */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-zinc-950">
            <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
              <div className="relative min-h-[300px] overflow-hidden bg-zinc-100 lg:order-2 dark:bg-zinc-900">
                <img src={b2bImageUrl} alt={b2bProduct?.name || "Paket grosir anggrek"} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/20 bg-black/35 p-4 text-white backdrop-blur-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-white/70">Mulai dari</div>
                  <div className="mt-1 text-2xl font-extrabold">{b2bProduct?.name || "Paket batch siap jual"}</div>
                  <div className="mt-2 text-sm text-white/75">Untuk reseller, florist, nursery, dan kebutuhan event.</div>
                </div>
              </div>
              <div className="p-7 sm:p-9 md:p-12 lg:p-14">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-brand-200)] bg-[var(--color-brand-50)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--color-brand-700)] dark:border-[var(--color-brand-800)] dark:bg-[var(--color-brand-900)]/40 dark:text-[var(--color-brand-200)]">
                  <ShoppingBag className="h-4 w-4" /> Program Grosir
                </div>
                <h2 className="max-w-xl text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">Butuh stok anggrek dalam jumlah besar?</h2>
                <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-600 md:text-lg dark:text-gray-300">Ambil paket grosir untuk restock toko, dekorasi event, atau kebutuhan nursery. Pilih batch yang sesuai, kami bantu siapkan tanaman dan packing pengirimannya.</p>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {[
                    { value: "B2B", label: "Harga batch" },
                    { value: "Aman", label: "Packing tanaman" },
                    { value: "Cepat", label: "Siap restock" },
                  ].map((stat) => (
                    <div key={stat.label} className="border-l-2 border-[var(--color-brand-500)] pl-4">
                      <div className="text-lg font-extrabold text-[var(--color-brand-700)] dark:text-[var(--color-brand-200)]">{stat.value}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <Link href="/products?type=B2B" className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-brand-700)] px-7 py-3.5 font-bold text-white shadow-sm transition-transform hover:scale-[1.02] hover:bg-[var(--color-brand-800)]">
                    Lihat Paket Grosir <ArrowRight className="h-5 w-5" />
                  </Link>
                  <Link href="/products" className="inline-flex items-center justify-center rounded-full border border-gray-300 px-7 py-3.5 font-bold text-gray-800 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-white/5">
                    Cek Semua Produk
                  </Link>
                </div>

                <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
                  {["Bibit", "Tanaman remaja", "Anggrek berbunga"].map((item) => (
                    <span key={item} className="inline-flex items-center gap-2">
                      <Leaf className="h-4 w-4 text-[var(--color-leaf-600)]" /> {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Shipping Info */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[{ icon: Truck, title: "Pengiriman Aman", desc: "Packing khusus tanaman hidup" }, { icon: ShieldCheck, title: "Garansi Tumbuh", desc: "Claim dengan bukti unboxing video" }, { icon: Star, title: "Kualitas Terjamin", desc: "Langsung dari nursery terpercaya" }].map((item, i) => (
              <div key={i} className="flex items-start gap-4 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
                <div className="p-3 bg-[var(--color-leaf-50)] dark:bg-[var(--color-leaf-900)]/30 rounded-xl"><item.icon className="w-6 h-6 text-[var(--color-leaf-600)]" /></div>
                <div><h4 className="font-bold mb-0.5">{item.title}</h4><p className="text-sm text-gray-500">{item.desc}</p></div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
