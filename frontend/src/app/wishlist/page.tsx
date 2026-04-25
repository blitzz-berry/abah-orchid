"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import type { WishlistItem } from "@/types";

export default function WishlistPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    const fetchWishlist = async () => {
      try {
        const response = await api.get("/wishlist");
        setItems(response.data.data || []);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchWishlist();
  }, [isAuthenticated, router]);

  const handleRemove = async (productID: string) => {
    try {
      await api.delete(`/wishlist/${productID}`);
      setItems((prev) => prev.filter((item) => item.product_id !== productID));
    } catch {}
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <Navbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <h1 className="text-3xl font-extrabold tracking-tight mb-8">Wishlist Saya</h1>
        {isLoading ? (
          <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-gray-200 border-t-[var(--color-leaf-500)] rounded-full animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 glass rounded-3xl">
            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Wishlist Masih Kosong</h2>
            <p className="text-gray-500 mb-8">Simpan dulu produk yang pengen lu pantau atau beli nanti.</p>
            <Link href="/products" className="bg-black text-white dark:bg-white dark:text-black px-6 py-3 rounded-xl font-bold inline-flex items-center gap-2">Lihat Katalog</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item) => (
              <div key={item.id} className="glass rounded-2xl p-4 flex gap-4 items-center">
                <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden shrink-0">
                  <img src={item.product.images?.[0]?.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.product.name)}&background=random`} alt={item.product.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/products/${item.product.id}`} className="font-bold line-clamp-2 hover:text-[var(--color-brand-600)]">{item.product.name}</Link>
                  <div className="text-sm text-gray-500 mt-1">{item.product.category?.name || "Anggrek"}</div>
                  <div className="text-lg font-extrabold text-[var(--color-brand-600)] mt-2">Rp {item.product.price.toLocaleString("id-ID")}</div>
                </div>
                <div className="flex flex-col gap-2">
                  <Link href={`/products/${item.product.id}`} className="p-2 rounded-lg bg-black text-white dark:bg-white dark:text-black">
                    <ShoppingCart className="w-4 h-4" />
                  </Link>
                  <button onClick={() => handleRemove(item.product_id)} className="p-2 rounded-lg bg-red-50 text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
