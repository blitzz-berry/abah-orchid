"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Package, Clock, Truck, CheckCircle, XCircle, ChevronRight } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import api from "@/lib/api";
import { motion } from "framer-motion";
import type { Order } from "@/types";

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  PENDING_PAYMENT: { label: "Menunggu Bayar", color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20", icon: Clock },
  PAID: { label: "Dibayar", color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20", icon: CheckCircle },
  PROCESSING: { label: "Diproses", color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20", icon: Package },
  SHIPPED: { label: "Dikirim", color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20", icon: Truck },
  DELIVERED: { label: "Diterima", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20", icon: CheckCircle },
  COMPLETED: { label: "Selesai", color: "text-green-600 bg-green-50 dark:bg-green-900/20", icon: CheckCircle },
  CANCELLED: { label: "Dibatalkan", color: "text-red-600 bg-red-50 dark:bg-red-900/20", icon: XCircle },
  RETURN_REQUESTED: { label: "Retur", color: "text-orange-600 bg-orange-50 dark:bg-orange-900/20", icon: Package },
  REFUNDED: { label: "Refund", color: "text-gray-600 bg-gray-50 dark:bg-gray-800", icon: XCircle },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) { router.push("/login"); return; }
    const fetchOrders = async () => {
      try { const r = await api.get("/orders"); setOrders(r.data.data || []); } catch {} finally { setIsLoading(false); }
    };
    fetchOrders();
  }, [isAuthenticated, router]);

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <h1 className="text-3xl font-extrabold tracking-tight mb-8">Pesanan Saya</h1>
        {isLoading ? (
          <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-gray-200 border-t-[var(--color-leaf-500)] rounded-full animate-spin" /></div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 glass rounded-2xl">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Belum Ada Pesanan</h2>
            <p className="text-gray-500 mb-6">Yuk mulai belanja anggrek!</p>
            <Link href="/products" className="bg-black text-white dark:bg-white dark:text-black px-6 py-3 rounded-xl font-bold text-sm">Mulai Belanja</Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {orders.map((order, idx) => {
              const st = STATUS_MAP[order.status] || STATUS_MAP.PENDING_PAYMENT;
              const Icon = st.icon;
              return (
                <motion.div key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                  <Link href={`/orders/${order.id}`} className="glass rounded-2xl p-5 flex items-center gap-4 hover:shadow-lg transition-all group">
                    <div className={`p-3 rounded-xl ${st.color}`}><Icon className="w-6 h-6" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm">{order.order_number}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                      </div>
                      <p className="text-sm text-gray-500">{order.items?.length || 0} item • {new Date(order.created_at || "").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-extrabold text-[var(--color-brand-600)]">Rp {order.total.toLocaleString("id-ID")}</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[var(--color-brand-600)] transition-colors shrink-0" />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
