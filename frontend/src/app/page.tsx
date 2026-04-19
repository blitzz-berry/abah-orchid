"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Leaf, ShoppingBag, ShieldCheck, Truck, Star, ChevronRight } from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import api from "@/lib/api";
import type { Product, Category } from "@/types";

const CATEGORIES_STATIC = [
  { name: "Phalaenopsis", slug: "phalaenopsis", emoji: "🦋" },
  { name: "Dendrobium", slug: "dendrobium", emoji: "🌸" },
  { name: "Vanda", slug: "vanda", emoji: "💜" },
  { name: "Cattleya", slug: "cattleya", emoji: "🌺" },
  { name: "Oncidium", slug: "oncidium", emoji: "💛" },
];

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

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative flex flex-col items-center justify-center px-4 pt-32 pb-24 text-center overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--color-brand-200)]/30 dark:bg-[var(--color-brand-800)]/20 blur-[120px] -z-10" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--color-leaf-50)]/50 dark:bg-[var(--color-leaf-900)]/20 blur-[120px] -z-10" />
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="max-w-4xl flex flex-col items-center">
            <span className="px-4 py-1.5 rounded-full bg-[var(--color-brand-100)] text-[var(--color-brand-700)] dark:bg-[var(--color-brand-900)] dark:text-[var(--color-brand-200)] font-semibold text-sm mb-6 border border-[var(--color-brand-200)] dark:border-[var(--color-brand-800)]">🌟 Platform E-Commerce Anggrek #1 di Indonesia</span>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
              Koleksi <span className="bg-gradient-to-r from-[var(--color-brand-500)] to-[var(--color-leaf-500)] bg-clip-text text-transparent">Anggrek Premium</span><br/>Untuk Koleksi & Bisnis
            </h1>
            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mb-12">Temukan berbagai varietas anggrek langka, bibit unggul, hingga tanaman berbunga siap panen.</p>
            <div className="flex flex-col sm:flex-row gap-4 mb-16">
              <Link href="/products" className="flex items-center justify-center gap-2 px-8 py-4 bg-black text-white dark:bg-white dark:text-black rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl shadow-black/10">Mulai Belanja <ArrowRight className="w-5 h-5" /></Link>
              <Link href="/products?type=B2B" className="flex items-center justify-center gap-2 px-8 py-4 bg-transparent border-2 border-black dark:border-white rounded-full font-bold text-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">Pemesanan B2B</Link>
            </div>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
            {[{ icon: Leaf, title: "Varietas Terlengkap", desc: "Dari Phalaenopsis hingga Vanda langka" }, { icon: ShoppingBag, title: "Harga Grosir B2B", desc: "Beli per batch dengan harga spesial" }, { icon: ShieldCheck, title: "Garansi Pengiriman", desc: "Packing premium & asuransi tanaman" }].map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }} className="flex flex-col items-center text-center p-6 rounded-2xl glass hover:shadow-lg transition-shadow">
                <div className="p-4 bg-[var(--color-brand-50)] dark:bg-[var(--color-brand-900)] rounded-2xl mb-4"><f.icon className="w-7 h-7 text-[var(--color-brand-600)] dark:text-[var(--color-brand-300)]" /></div>
                <h3 className="text-lg font-bold mb-1">{f.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Kategori Populer */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center justify-between mb-8">
            <div><h2 className="text-3xl font-extrabold tracking-tight">Kategori Populer</h2><p className="text-gray-500 mt-1">Jelajahi berdasarkan genus anggrek favorit</p></div>
            <Link href="/products" className="text-sm font-medium text-[var(--color-brand-600)] hover:underline flex items-center gap-1">Lihat Semua <ChevronRight className="w-4 h-4" /></Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {CATEGORIES_STATIC.map((cat, idx) => (
              <motion.div key={cat.slug} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.05 }}>
                <Link href={`/products?category=${cat.slug}`} className="flex flex-col items-center gap-3 p-6 rounded-2xl glass hover:shadow-lg transition-all group">
                  <span className="text-4xl group-hover:scale-110 transition-transform">{cat.emoji}</span>
                  <span className="font-bold text-sm">{cat.name}</span>
                </Link>
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
          <div className="relative bg-gradient-to-br from-[var(--color-brand-600)] to-[var(--color-leaf-600)] rounded-3xl p-10 md:p-16 text-white overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
            <div className="relative z-10 max-w-lg">
              <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Butuh Order Grosir?</h2>
              <p className="text-white/80 text-lg mb-8">Dapatkan harga spesial untuk nursery, reseller, dan florist.</p>
              <Link href="/products?type=B2B" className="px-8 py-3 bg-white text-[var(--color-brand-700)] rounded-full font-bold hover:scale-105 transition-transform inline-block">Lihat Katalog B2B</Link>
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
