"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, Leaf, SlidersHorizontal, X } from "lucide-react";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import type { Product, Category } from "@/types";

const SORT_OPTIONS = [
  { value: "newest", label: "Terbaru" },
  { value: "price_asc", label: "Harga Terendah" },
  { value: "price_desc", label: "Harga Tertinggi" },
];

const SIZE_OPTIONS = ["seedling", "remaja", "dewasa", "berbunga"];

type ApiErrorLike = {
  message?: string;
};

function CatalogPageContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") || "");
  const [selectedSize, setSelectedSize] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodRes, catRes] = await Promise.allSettled([
          api.get("/products"),
          api.get("/categories"),
        ]);
        if (prodRes.status === "fulfilled") { setProducts(prodRes.value.data.data || []); setErrorMsg(null); }
        else setErrorMsg("Gagal memuat produk");
        if (catRes.status === "fulfilled") setCategories(catRes.value.data.data || []);
      } catch (error: unknown) {
        const apiError = error as ApiErrorLike;
        setErrorMsg(apiError.message || "Gagal memuat data");
      } finally { setIsLoading(false); }
    };
    fetchData();
  }, []);

  const filteredProducts = useMemo(() => {
    let result = [...products];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.variety_name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }
    if (selectedCategory) result = result.filter(p => p.category?.slug === selectedCategory || p.category?.name?.toLowerCase() === selectedCategory.toLowerCase());
    if (selectedSize) result = result.filter(p => p.size === selectedSize);
    if (sortBy === "price_asc") result.sort((a, b) => a.price - b.price);
    else if (sortBy === "price_desc") result.sort((a, b) => b.price - a.price);
    return result;
  }, [products, searchQuery, selectedCategory, selectedSize, sortBy]);

  const clearFilters = () => { setSearchQuery(""); setSelectedCategory(""); setSelectedSize(""); setSortBy("newest"); };
  const hasFilters = searchQuery || selectedCategory || selectedSize || sortBy !== "newest";

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-1">Katalog Anggrek</h1>
            <p className="text-gray-500">Temukan koleksi anggrek terbaik untuk rumah dan bisnismu.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari anggrek..." className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-black/50 border border-gray-200 dark:border-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] transition-all text-sm" />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl font-medium transition-colors text-sm ${showFilters ? "border-[var(--color-brand-500)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)]" : "border-gray-200 dark:border-gray-800 hover:bg-black/5 dark:hover:bg-white/5"}`}>
              <SlidersHorizontal className="w-4 h-4" /> Filter
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-6">
              <div className="glass rounded-2xl p-6 flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Kategori</label>
                  <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 text-sm">
                    <option value="">Semua Kategori</option>
                    {categories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
                    {categories.length === 0 && ["Phalaenopsis","Dendrobium","Vanda","Cattleya","Oncidium"].map(n => <option key={n} value={n.toLowerCase()}>{n}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Ukuran</label>
                  <select value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 text-sm">
                    <option value="">Semua Ukuran</option>
                    {SIZE_OPTIONS.map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Urutkan</label>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 text-sm">
                    {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                {hasFilters && (
                  <div className="flex items-end">
                    <button onClick={clearFilters} className="flex items-center gap-1 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors font-medium"><X className="w-4 h-4" /> Reset</button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Count */}
        {!isLoading && !errorMsg && (
          <p className="text-sm text-gray-500 mb-6">{filteredProducts.length} produk ditemukan</p>
        )}

        {/* Content */}
        {errorMsg ? (
          <div className="text-center py-20 glass rounded-3xl border border-red-200 dark:border-red-800 max-w-xl mx-auto">
            <h2 className="text-2xl font-bold mb-2 text-red-500">Gagal Memuat 😢</h2>
            <p className="text-gray-500 mb-4">{errorMsg}</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold text-sm">Refresh</button>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-gray-200 border-t-[var(--color-leaf-500)] rounded-full animate-spin" /></div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 glass rounded-3xl">
            <Leaf className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">{hasFilters ? "Tidak Ada Hasil" : "Belum Ada Produk"}</h2>
            <p className="text-gray-500">{hasFilters ? "Coba ubah filter pencarian kamu." : "Stok anggrek sedang kosong atau belum ditambahkan."}</p>
            {hasFilters && <button onClick={clearFilters} className="mt-4 px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold text-sm">Reset Filter</button>}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredProducts.map((product, idx) => (
              <motion.div key={product.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: idx * 0.03 }}>
                <Link href={`/products/${product.id}`} className="glass rounded-2xl overflow-hidden hover:shadow-xl transition-all group flex flex-col h-full">
                  <div className="aspect-square bg-gray-100 dark:bg-gray-800 relative overflow-hidden">
                    <img src={product.images?.[0]?.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(product.name)}&background=random&size=400`} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    {product.unit_type === "PER_BATCH" && <span className="absolute top-3 left-3 bg-[var(--color-leaf-500)] text-white text-[10px] font-bold px-2 py-1 rounded-md">B2B</span>}
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <div className="text-xs text-gray-500 mb-1">{product.category?.name || "Anggrek"}</div>
                    <h3 className="font-bold text-sm leading-tight mb-2 flex-1 line-clamp-2">{product.name}</h3>
                    <div className="flex items-end justify-between mt-auto">
                      <div className="text-[var(--color-brand-600)] font-extrabold">Rp {product.price.toLocaleString("id-ID")}</div>
                      <div className="text-xs text-gray-400">{product.inventory?.quantity || 0} stok</div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg)]" />}>
      <CatalogPageContent />
    </Suspense>
  );
}
