"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Leaf, SlidersHorizontal, X } from "lucide-react";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { ProductGridSkeleton } from "@/components/ui/loading";
import type { Product, Category } from "@/types";

const SORT_OPTIONS = [
  { value: "newest", label: "Terbaru" },
  { value: "price_asc", label: "Harga Terendah" },
  { value: "price_desc", label: "Harga Tertinggi" },
];

const SIZE_OPTIONS = ["seedling", "remaja", "dewasa", "berbunga"];
const PRODUCTS_PER_PAGE = 8;
const SEARCH_DEBOUNCE_MS = 300;

function buildPaginationItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
}

type ApiErrorLike = {
  message?: string;
};

function CatalogPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  const initialSort = searchParams.get("sort") || "newest";
  const initialCategory = searchParams.get("category") || "";
  const initialSize = searchParams.get("size") || "";
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortBy, setSortBy] = useState(initialSort);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedSize, setSelectedSize] = useState(initialSize);
  const [showFilters, setShowFilters] = useState(false);
  const initialPage = Math.max(1, Number(searchParams.get("page") || "1") || 1);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(initialSearch);

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
    if (debouncedSearchQuery) {
      const q = debouncedSearchQuery.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.variety_name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }
    if (selectedCategory) result = result.filter(p => p.category?.slug === selectedCategory || p.category?.name?.toLowerCase() === selectedCategory.toLowerCase());
    if (selectedSize) result = result.filter(p => p.size === selectedSize);
    if (sortBy === "price_asc") result.sort((a, b) => a.price - b.price);
    else if (sortBy === "price_desc") result.sort((a, b) => b.price - a.price);
    return result;
  }, [debouncedSearchQuery, products, selectedCategory, selectedSize, sortBy]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, selectedCategory, selectedSize, sortBy]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);
  }, [currentPage, filteredProducts]);
  const paginationItems = useMemo(() => buildPaginationItems(currentPage, totalPages), [currentPage, totalPages]);
  const startProductIndex = filteredProducts.length === 0 ? 0 : (currentPage - 1) * PRODUCTS_PER_PAGE + 1;
  const endProductIndex = filteredProducts.length === 0 ? 0 : Math.min(currentPage * PRODUCTS_PER_PAGE, filteredProducts.length);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    const params = new URLSearchParams();
    const normalizedSearch = debouncedSearchQuery.trim();
    if (normalizedSearch) params.set("search", normalizedSearch);
    if (selectedCategory) params.set("category", selectedCategory);
    if (selectedSize) params.set("size", selectedSize);
    if (sortBy !== "newest") params.set("sort", sortBy);
    if (currentPage <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(currentPage));
    }
    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) return;
    const nextURL = nextQuery ? `/products?${nextQuery}` : "/products";
    router.replace(nextURL, { scroll: false });
  }, [currentPage, debouncedSearchQuery, router, searchParams, selectedCategory, selectedSize, sortBy]);

  const clearFilters = () => { setSearchQuery(""); setSelectedCategory(""); setSelectedSize(""); setSortBy("newest"); setCurrentPage(1); };
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
          <div className="mb-6 flex flex-col gap-2 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Menampilkan {startProductIndex}-{endProductIndex} dari {filteredProducts.length} produk
            </p>
            <p>
              Halaman {currentPage} dari {totalPages}
            </p>
          </div>
        )}

        {/* Content */}
        {errorMsg ? (
          <div className="text-center py-20 glass rounded-3xl border border-red-200 dark:border-red-800 max-w-xl mx-auto">
            <h2 className="text-2xl font-bold mb-2 text-red-500">Gagal Memuat 😢</h2>
            <p className="text-gray-500 mb-4">{errorMsg}</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold text-sm">Refresh</button>
          </div>
        ) : isLoading ? (
          <ProductGridSkeleton count={12} />
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 glass rounded-3xl">
            <Leaf className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">{hasFilters ? "Tidak Ada Hasil" : "Belum Ada Produk"}</h2>
            <p className="text-gray-500">{hasFilters ? "Silakan ubah filter pencarian Anda." : "Stok anggrek sedang kosong atau belum ditambahkan."}</p>
            {hasFilters && <button onClick={clearFilters} className="mt-4 px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold text-sm">Reset Filter</button>}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {paginatedProducts.map((product, idx) => (
              <motion.div key={product.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: idx * 0.03 }}>
                <Link href={`/products/${product.id}`} className="glass rounded-2xl overflow-hidden hover:shadow-xl transition-all group flex flex-col h-full">
                  <div className="aspect-square bg-gray-100 dark:bg-gray-800 relative overflow-hidden">
                    <img src={product.images?.[0]?.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(product.name)}&background=random&size=400`} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <div className="text-xs text-gray-500 mb-1">{product.category?.name || "Anggrek"}</div>
                    <h3 className="font-bold text-sm leading-tight mb-2 flex-1 line-clamp-2">{product.name}</h3>
                    <div className="flex items-end justify-between mt-auto">
                      <div className="flex flex-col">
                        {product.is_discounted && product.discounted_price ? (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-[var(--color-brand-600)] font-extrabold">Rp {product.discounted_price.toLocaleString("id-ID")}</span>
                              <span className="text-[0.65rem] text-red-500 font-bold px-1.5 py-0.5 bg-red-100 rounded">{product.discount_label || 'Promo'}</span>
                            </div>
                            <span className="text-[0.7rem] text-gray-400 line-through">Rp {product.price.toLocaleString("id-ID")}</span>
                          </>
                        ) : (
                          <span className="text-[var(--color-brand-600)] font-extrabold">Rp {product.price.toLocaleString("id-ID")}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mb-1">{product.inventory?.quantity || 0} stok</div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-zinc-900 dark:text-gray-300 dark:hover:bg-zinc-800"
                >
                  Sebelumnya
                </button>

                {paginationItems.map((item, index) => (
                  typeof item === "number" ? (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCurrentPage(item)}
                      className={`min-w-10 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                        currentPage === item
                          ? "bg-[var(--color-brand-600)] text-white shadow-sm"
                          : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-zinc-900 dark:text-gray-300 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {item}
                    </button>
                  ) : (
                    <span
                      key={`ellipsis-${index}`}
                      className="min-w-10 px-1 py-2 text-center text-sm font-bold text-gray-400"
                    >
                      ...
                    </span>
                  )
                ))}

                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-zinc-900 dark:text-gray-300 dark:hover:bg-zinc-800"
                >
                  Berikutnya
                </button>
              </div>
            )}
          </>
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
