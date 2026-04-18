"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Filter, ShoppingCart, Leaf } from "lucide-react";
import api from "@/lib/api";
import { motion } from "framer-motion";

export default function CatalogPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchProducts = async () => {
      try {
        console.log("Fetching products...");
        const res = await api.get("/products");
        console.log("Products response:", res.data);
        if (isMounted) {
          setProducts(res.data.data || []);
          setErrorMsg(null);
        }
      } catch (error: any) {
        console.error("Failed to fetch products", error);
        if (isMounted) {
          setErrorMsg(error?.response?.data?.error || error.message || "Unknown error occurred while fetching products");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchProducts();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] px-4 py-8">
      <nav className="glass fixed top-0 left-0 w-full z-50 flex items-center justify-between px-8 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Leaf className="w-8 h-8 text-[var(--color-leaf-500)]" />
          <span className="text-2xl font-bold tracking-tight">OrchidMart</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/cart" className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors relative">
            <ShoppingCart className="w-6 h-6" />
            <span className="absolute top-0 right-0 bg-[var(--color-brand-500)] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">0</span>
          </Link>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto pt-24">
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-2">Katalog Anggrek</h1>
            <p className="text-gray-500">Temukan koleksi anggrek terbaik untuk rumah dan bisnismu.</p>
          </div>
          
          <div className="flex gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Cari anggrek..." 
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-black/50 border border-gray-200 dark:border-gray-800 rounded-xl outline-none focus:ring-1 focus:ring-[var(--color-brand-500)] transition-all"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium">
              <Filter className="w-5 h-5" /> Filter
            </button>
          </div>
        </div>

        {errorMsg ? (
          <div className="text-center py-20 glass rounded-3xl border border-red-500 max-w-xl mx-auto">
            <h2 className="text-2xl font-bold mb-2 text-red-500">Duh, Gagal Bro 😭</h2>
            <p className="text-gray-500 mb-4">{errorMsg}</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold">Refresh Page</button>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-[var(--color-leaf-500)] rounded-full animate-spin"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 glass rounded-3xl">
            <Leaf className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Belum Ada Produk</h2>
            <p className="text-gray-500">Stok anggrek sedang kosong atau belum ditambahkan oleh admin.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product, idx) => (
              <motion.div 
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className="glass rounded-2xl overflow-hidden hover:shadow-xl transition-all group flex flex-col"
              >
                <div className="aspect-square bg-gray-100 dark:bg-gray-800 relative overflow-hidden">
                  <img 
                    src={product.images?.[0]?.image_url || `https://ui-avatars.com/api/?name=${product.name}&background=random`} 
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {product.unit_type === "PER_BATCH" && (
                    <span className="absolute top-3 right-3 bg-[var(--color-leaf-500)] text-white text-xs font-bold px-2 py-1 rounded-md">
                      B2B Grosir
                    </span>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <div className="text-xs text-gray-500 mb-1">{product.category?.name || "Uncategorized"}</div>
                  <h3 className="font-bold text-lg leading-tight mb-2 flex-1">{product.name}</h3>
                  <div className="flex items-end justify-between mt-auto">
                    <div>
                      <div className="text-[var(--color-brand-600)] font-extrabold text-xl">
                        Rp {product.price.toLocaleString('id-ID')}
                      </div>
                    </div>
                    <button className="bg-black text-white dark:bg-white dark:text-black p-2.5 rounded-xl hover:scale-105 transition-transform">
                      <ShoppingCart className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
