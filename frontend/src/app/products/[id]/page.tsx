"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { ArrowLeft, ShoppingCart, Info, CheckCircle2, ShieldCheck, Tag } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { motion } from "framer-motion";

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  
  const [product, setProduct] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await api.get(`/products/${id}`);
        setProduct(res.data.data);
      } catch (err) {
        console.error("Failed to load product", err);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchDetail();
  }, [id]);

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    
    setIsAdding(true);
    try {
      await api.post("/cart", {
        product_id: product.id,
        quantity: quantity,
        note: note
      });
      alert("Berhasil ditambahkan ke keranjang!");
      router.push("/cart");
    } catch (e: any) {
      alert("Gagal: " + (e.response?.data?.error || e.message));
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-[var(--color-leaf-500)] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-4">Produk tidak temukan</h1>
        <Link href="/products" className="text-[var(--color-brand-600)] font-medium hover:underline">Kembali ke Katalog</Link>
      </div>
    );
  }

  const isB2B = product.unit_type === "PER_BATCH";

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] pb-24">
      <nav className="glass sticky top-0 w-full z-50 px-4 md:px-8 py-4 flex items-center justify-between shadow-sm">
        <Link href="/products" className="flex items-center gap-2 font-bold hover:text-[var(--color-brand-600)] transition-colors">
          <ArrowLeft className="w-5 h-5"/> Katalog Produk
        </Link>
        <Link href="/cart" className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors relative">
          <ShoppingCart className="w-6 h-6" />
        </Link>
      </nav>

      <main className="max-w-6xl mx-auto px-4 md:px-8 mt-8">
        <div className="flex flex-col md:flex-row gap-10">
          {/* Main Visual */}
          <div className="w-full md:w-1/2 flex flex-col gap-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass p-2 rounded-3xl aspect-square overflow-hidden flex items-center justify-center relative bg-white/50 dark:bg-black/50"
            >
              {isB2B && (
                <div className="absolute top-4 left-4 z-10 bg-[var(--color-leaf-500)] text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-lg">
                  <Tag className="w-3 h-3" /> Rekomendasi Grosir (B2B)
                </div>
              )}
              <img 
                src={`https://ui-avatars.com/api/?name=${product.name}&size=512&background=random`} 
                alt={product.name} 
                className="w-full h-full object-cover rounded-2xl" 
              />
            </motion.div>
          </div>

          {/* Details & Actions */}
          <div className="w-full md:w-1/2 flex flex-col pt-2">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="text-sm font-bold text-[var(--color-leaf-600)] uppercase tracking-wider mb-2">
                SATUAN JUAL: {product.unit_type.replace(/_/g, " ")}
              </div>
              <h1 className="text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-4">{product.name}</h1>
              
              <div className="text-3xl font-extrabold text-[var(--color-brand-600)] mb-6 py-4 border-y border-gray-200 dark:border-gray-800">
                Rp {product.price.toLocaleString('id-ID')}
              </div>

              <div className="glass p-5 rounded-2xl mb-8 flex flex-col gap-3">
                <h3 className="font-bold flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-3"><Info className="w-5 h-5"/> Deskripsi Tanaman</h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed min-h-[100px]">
                  {product.description || "Belum ada deskripsi yang ditambahkan untuk varietas ini. Anggrek subur dan dijamin kesehatannya. Tanaman siap adaptasi ke lingkungan baru."}
                </p>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="bg-white/40 dark:bg-black/40 p-3 rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500"/>
                    <span className="text-sm font-medium">Stok: {product.inventory?.quantity || 0} Tersedia</span>
                  </div>
                  <div className="bg-white/40 dark:bg-black/40 p-3 rounded-xl flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-500"/>
                    <span className="text-sm font-medium">Garansi Tumbuh</span>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm sticky top-24"
            >
              <h3 className="font-bold mb-4">Atur Pesanan & Pilihan</h3>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="border border-gray-300 dark:border-gray-700 rounded-xl flex items-center overflow-hidden h-12 w-32">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-full flex items-center justify-center font-bold hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">-</button>
                  <input type="number" readOnly value={quantity} className="w-12 h-full text-center border-x border-gray-300 dark:border-gray-700 bg-transparent font-bold outline-none" />
                  <button onClick={() => setQuantity(Math.min(product.inventory?.quantity || 99, quantity + 1))} className="w-10 h-full flex items-center justify-center font-bold hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">+</button>
                </div>
                <div className="text-sm text-gray-500">
                  Subtotal: <span className="font-bold text-black dark:text-white">Rp {(product.price * quantity).toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div className="mb-6">
                <input 
                  type="text" 
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Catatan ke penjual (Opsional...)"
                  className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm focus:ring-1 focus:ring-[var(--color-brand-500)] outline-none"
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={handleAddToCart}
                  disabled={isAdding || (product.inventory?.quantity || 0) < 1}
                  className="flex-1 py-4 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100 shadow-xl shadow-black/10 dark:shadow-white/10"
                >
                  <ShoppingCart className="w-5 h-5"/>
                  {isAdding ? "Memproses..." : "Masukkan Keranjang"}
                </button>
              </div>
            </motion.div>

          </div>
        </div>
      </main>
    </div>
  );
}
