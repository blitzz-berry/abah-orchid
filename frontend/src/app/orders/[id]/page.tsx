"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Package, Truck, MapPin, CreditCard, CheckCircle } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import api from "@/lib/api";
import { motion } from "framer-motion";
import type { Order } from "@/types";

export default function OrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) { router.push("/login"); return; }
    const f = async () => {
      try { const r = await api.get(`/orders/${id}`); setOrder(r.data.data || r.data); } catch {} finally { setIsLoading(false); }
    };
    if (id) f();
  }, [id, isAuthenticated, router]);

  const handleConfirmDelivery = async () => {
    setIsConfirming(true);
    try {
      await api.post(`/orders/${id}/confirm-delivery`);
      setOrder(prev => prev ? { ...prev, status: "COMPLETED" } : prev);
    } catch (e: any) { alert("Gagal: " + (e.response?.data?.error || e.message)); }
    finally { setIsConfirming(false); }
  };

  if (isLoading) return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)]"><Navbar /><div className="flex-1 flex items-center justify-center"><div className="w-10 h-10 border-4 border-gray-200 border-t-[var(--color-leaf-500)] rounded-full animate-spin" /></div></div>
  );

  if (!order) return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)]"><Navbar /><div className="flex-1 flex flex-col items-center justify-center"><h1 className="text-2xl font-bold mb-2">Pesanan tidak ditemukan</h1><Link href="/orders" className="text-[var(--color-brand-600)] hover:underline">Kembali</Link></div><Footer /></div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <Link href="/orders" className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[var(--color-brand-600)] mb-6"><ArrowLeft className="w-4 h-4" /> Kembali ke Pesanan</Link>

        <div className="flex items-center justify-between mb-8">
          <div><h1 className="text-2xl font-extrabold">{order.order_number}</h1><p className="text-sm text-gray-500">{new Date(order.created_at || "").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p></div>
          <span className="px-3 py-1 rounded-full text-sm font-bold bg-[var(--color-brand-50)] text-[var(--color-brand-600)] dark:bg-[var(--color-brand-900)] dark:text-[var(--color-brand-200)]">{order.status.replace(/_/g, " ")}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Items */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5">
              <h3 className="font-bold mb-4 flex items-center gap-2"><Package className="w-5 h-5" /> Item Pesanan</h3>
              <div className="flex flex-col gap-3">
                {order.items?.map(item => (
                  <div key={item.id} className="flex items-center gap-4 p-3 border border-gray-100 dark:border-gray-800 rounded-xl">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden shrink-0"><img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.product_name)}&background=random`} alt={item.product_name} className="w-full h-full object-cover" /></div>
                    <div className="flex-1 min-w-0"><div className="font-medium text-sm truncate">{item.product_name}</div><div className="text-xs text-gray-500">{item.quantity} x Rp {item.product_price.toLocaleString("id-ID")}</div></div>
                    <div className="font-bold text-sm">Rp {item.subtotal.toLocaleString("id-ID")}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Shipping */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-5">
              <h3 className="font-bold mb-4 flex items-center gap-2"><MapPin className="w-5 h-5 text-[var(--color-leaf-600)]" /> Pengiriman</h3>
              <div className="text-sm space-y-1">
                <p className="font-medium">{order.shipping_name} • {order.shipping_phone}</p>
                <p className="text-gray-500">{order.shipping_address}</p>
                <p className="text-gray-500">{order.shipping_city}, {order.shipping_province} {order.shipping_postal_code}</p>
                {order.courier_code && <p className="mt-2"><span className="font-medium uppercase">{order.courier_code}</span> {order.courier_service}</p>}
                {order.tracking_number && <p className="flex items-center gap-2 mt-2"><Truck className="w-4 h-4" /> <span className="font-mono font-bold">{order.tracking_number}</span></p>}
              </div>
            </motion.div>
          </div>

          {/* Summary */}
          <div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass rounded-2xl p-5 sticky top-24">
              <h3 className="font-bold mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5" /> Ringkasan</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>Rp {order.subtotal.toLocaleString("id-ID")}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Ongkir</span><span>Rp {order.shipping_cost.toLocaleString("id-ID")}</span></div>
                {order.discount > 0 && <div className="flex justify-between text-green-600"><span>Diskon</span><span>- Rp {order.discount.toLocaleString("id-ID")}</span></div>}
                <div className="flex justify-between font-extrabold text-lg border-t border-gray-200 dark:border-gray-800 pt-3 mt-3"><span>Total</span><span className="text-[var(--color-brand-600)]">Rp {order.total.toLocaleString("id-ID")}</span></div>
              </div>

              {order.status === "DELIVERED" && (
                <button onClick={handleConfirmDelivery} disabled={isConfirming} className="w-full mt-6 py-3 bg-[var(--color-leaf-600)] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform disabled:opacity-50">
                  <CheckCircle className="w-5 h-5" /> {isConfirming ? "Memproses..." : "Konfirmasi Diterima"}
                </button>
              )}

              {order.note && <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-sm"><span className="font-bold text-amber-700">Catatan:</span> {order.note}</div>}
            </motion.div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
