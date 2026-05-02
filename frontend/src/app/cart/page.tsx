"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Leaf, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import type { Cart, CartItem } from "@/types";

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const cartItems = useMemo(() => cart?.items ?? [], [cart]);
  const selectedItems = useMemo(
    () => cartItems.filter((item) => selectedItemIds.includes(item.id)),
    [cartItems, selectedItemIds],
  );
  const subtotal = selectedItems.reduce((total, item) => total + item.product.price * item.quantity, 0);
  const totalQuantity = selectedItems.reduce((total, item) => total + item.quantity, 0);
  const allSelected = cartItems.length > 0 && selectedItemIds.length === cartItems.length;

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    const fetchCart = async () => {
      try {
        const response = await api.get("/cart");
        const nextCart = response.data?.data as Cart | null | undefined;
        const normalizedCart = nextCart ? { ...nextCart, items: nextCart.items ?? [] } : null;
        setCart(normalizedCart);
        setSelectedItemIds((normalizedCart?.items ?? []).map((item: CartItem) => item.id));
      } finally {
        setIsLoading(false);
      }
    };

    void fetchCart();
  }, [isAuthenticated, router]);

  const toggleItem = (itemId: string) => {
    setSelectedItemIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    );
  };

  const toggleAll = () => {
    setSelectedItemIds(allSelected ? [] : cartItems.map((item) => item.id));
  };

  const handleUpdateQty = async (itemId: string, newQty: number) => {
    if (newQty < 1 || !cart) return;
    if (!itemId) {
      alert("Item cart tidak valid.");
      return;
    }
    try {
      await api.put(`/cart/items/${itemId}`, { quantity: newQty });
      setCart({
        ...cart,
        items: cartItems.map((item) => item.id === itemId ? { ...item, quantity: newQty } : item),
      });
    } catch (e: any) {
      alert("Gagal mengubah jumlah: " + (e.response?.data?.error || e.message));
    }
  };

  const handleRemove = async (itemId: string) => {
    if (!cart) return;
    if (!itemId) {
      alert("Item cart tidak valid.");
      return;
    }
    try {
      await api.delete(`/cart/items/${itemId}`);
      setCart({
        ...cart,
        items: cartItems.filter((item) => item.id !== itemId),
      });
      setSelectedItemIds((current) => current.filter((id) => id !== itemId));
    } catch (e: any) {
      alert("Gagal menghapus item: " + (e.response?.data?.error || e.message));
    }
  };

  const handleContinueCheckout = () => {
    if (selectedItemIds.length === 0) {
      alert("Pilih minimal satu item untuk checkout.");
      return;
    }
    sessionStorage.setItem("checkout_cart_item_ids", JSON.stringify(selectedItemIds));
    router.push("/checkout");
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">Keranjang Belanja</h1>
            <p className="text-sm text-gray-500">Semua barang yang lu masukin ke cart ada di sini. Pilih item yang mau checkout dalam satu transaksi.</p>
          </div>
          {cartItems.length > 0 && (
            <button onClick={toggleAll} className="self-start sm:self-auto px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-bold hover:bg-gray-50 dark:hover:bg-zinc-900">
              {allSelected ? "Batalkan Pilihan" : "Pilih Semua"}
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-gray-200 border-t-[var(--color-leaf-500)] rounded-full animate-spin" /></div>
        ) : !cart || cartItems.length === 0 ? (
          <div className="text-center py-20 glass rounded-3xl">
            <Leaf className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Keranjang Kosong</h2>
            <p className="text-gray-500 mb-8">Yuk, cari varietas anggrek idamanmu dulu.</p>
            <Link href="/products" className="bg-black text-white dark:bg-white dark:text-black px-6 py-3 rounded-xl font-bold inline-flex items-center gap-2">Mulai Belanja <ArrowRight className="w-4 h-4" /></Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
            <div className="flex flex-col gap-3">
              {cartItems.map((item, idx) => {
                const selected = selectedItemIds.includes(item.id);
                return (
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} key={item.id} className={`glass p-4 rounded-2xl flex gap-4 items-center border ${selected ? "border-[var(--color-leaf-500)]" : "border-transparent"}`}>
                    <button onClick={() => toggleItem(item.id)} className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${selected ? "bg-[var(--color-leaf-600)] border-[var(--color-leaf-600)] text-white" : "border-gray-300 dark:border-gray-700"}`} aria-label={`Pilih ${item.product.name}`}>
                      {selected && <CheckCircle2 className="w-4 h-4" />}
                    </button>
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden shrink-0">
                      <img src={item.product.images?.[0]?.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.product.name)}&background=random`} alt={item.product.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold leading-tight truncate">{item.product.name}</h3>
                      <div className="text-sm text-gray-500">Rp {item.product.price.toLocaleString("id-ID")} / item</div>
                      <div className="font-extrabold text-[var(--color-brand-600)]">Rp {(item.quantity * item.product.price).toLocaleString("id-ID")}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleUpdateQty(item.id, item.quantity - 1)} className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-800"><Minus className="w-3 h-3" /></button>
                      <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                      <button onClick={() => handleUpdateQty(item.id, item.quantity + 1)} className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-800"><Plus className="w-3 h-3" /></button>
                    </div>
                    <button onClick={() => handleRemove(item.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl"><Trash2 className="w-4 h-4" /></button>
                  </motion.div>
                );
              })}
            </div>

            <aside className="glass p-6 rounded-2xl h-max sticky top-24">
              <h2 className="text-lg font-bold mb-4 border-b border-gray-200 dark:border-gray-800 pb-4">Ringkasan Pilihan</h2>
              <div className="flex justify-between mb-3 text-sm text-gray-600 dark:text-gray-300"><span>Item dipilih</span><span>{selectedItems.length} produk</span></div>
              <div className="flex justify-between mb-3 text-sm text-gray-600 dark:text-gray-300"><span>Total qty</span><span>{totalQuantity}</span></div>
              <div className="flex justify-between mb-6 pb-6 border-b border-gray-200 dark:border-gray-800 font-extrabold text-lg"><span>Subtotal</span><span className="text-[var(--color-leaf-600)]">Rp {subtotal.toLocaleString("id-ID")}</span></div>
              <button onClick={handleContinueCheckout} disabled={selectedItemIds.length === 0} className="w-full bg-black text-white dark:bg-white dark:text-black py-4 rounded-xl flex items-center justify-center gap-2 font-bold hover:scale-[1.02] transition-transform disabled:opacity-50">
                <ShoppingBag className="w-5 h-5" /> Checkout Item Dipilih
              </button>
            </aside>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
