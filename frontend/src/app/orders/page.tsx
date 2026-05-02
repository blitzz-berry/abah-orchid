"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, ChevronRight, Clock, CreditCard, Package, ReceiptText, RotateCcw, Search, Truck, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/useAuthStore";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import api from "@/lib/api";
import { resolveUploadURL } from "@/lib/uploads";
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

const FILTERS = [
  { value: "", label: "Semua" },
  { value: "PENDING_PAYMENT", label: "Belum Bayar" },
  { value: "PAID", label: "Dibayar" },
  { value: "PROCESSING", label: "Diproses" },
  { value: "SHIPPED", label: "Dikirim" },
  { value: "COMPLETED", label: "Selesai" },
  { value: "CANCELLED", label: "Batal" },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    const fetchOrders = async () => {
      try {
        const response = await api.get("/orders");
        setOrders(response.data.data || []);
      } catch {
        setOrders([]);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchOrders();
  }, [isAuthenticated, router]);

  const filteredOrders = orders.filter((order) => {
    if (filterStatus && order.status !== filterStatus) return false;
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    return order.order_number.toLowerCase().includes(keyword) ||
      order.shipping_name.toLowerCase().includes(keyword) ||
      order.items?.some((item) => item.product_name.toLowerCase().includes(keyword));
  });

  const activeOrders = orders.filter((order) => !["COMPLETED", "CANCELLED", "REFUNDED"].includes(order.status)).length;
  const pendingPayment = orders.filter((order) => order.status === "PENDING_PAYMENT").length;

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <div className="flex flex-col gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">Pesanan Saya</h1>
            <p className="text-sm text-gray-500">Pantau semua riwayat pesanan, pembayaran, dan pengiriman lu di sini.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SummaryCard label="Total Pesanan" value={orders.length} />
            <SummaryCard label="Sedang Berjalan" value={activeOrders} tone="brand" />
            <SummaryCard label="Menunggu Bayar" value={pendingPayment} tone="amber" />
          </div>

          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nomor order, nama, produk..." className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 text-sm" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((filter) => (
                <button key={filter.value || "all"} onClick={() => setFilterStatus(filter.value)} className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${filterStatus === filter.value ? "border-[var(--color-brand-500)] bg-[var(--color-brand-50)] text-[var(--color-brand-700)] dark:bg-[var(--color-brand-900)]/30 dark:text-[var(--color-brand-200)]" : "border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800"}`}>
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-gray-200 border-t-[var(--color-leaf-500)] rounded-full animate-spin" /></div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Belum Ada Pesanan</h2>
            <p className="text-gray-500 mb-6">Yuk mulai belanja anggrek.</p>
            <Link href="/products" className="bg-black text-white dark:bg-white dark:text-black px-6 py-3 rounded-xl font-bold text-sm">Mulai Belanja</Link>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Pesanan tidak ditemukan</h2>
            <p className="text-gray-500 text-sm">Coba ubah kata kunci atau filter status.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredOrders.map((order, idx) => <OrderHistoryCard key={order.id} order={order} idx={idx} />)}
          </div>
        )}

        {!isLoading && orders.length > 0 && (
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-500">
            <RotateCcw className="w-4 h-4" /> Menampilkan {filteredOrders.length} dari {orders.length} pesanan. Riwayat terbaru ada di paling atas.
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: "brand" | "amber" }) {
  const valueColor = tone === "brand" ? "text-[var(--color-brand-600)]" : tone === "amber" ? "text-amber-600" : "";
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-2xl font-extrabold mt-1 ${valueColor}`}>{value}</div>
    </div>
  );
}

function OrderHistoryCard({ order, idx }: { order: Order; idx: number }) {
  const status = STATUS_MAP[order.status] || STATUS_MAP.PENDING_PAYMENT;
  const Icon = status.icon;
  const payment = order.payments?.[0] || order.payment || null;
  const firstItem = order.items?.[0];
  const productImageURL = firstItem?.product_image_url ? resolveUploadURL(firstItem.product_image_url) : "";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 overflow-hidden hover:shadow-lg transition-shadow">
        <Link href={`/orders/${order.id}`} className="block p-5">
          <div className="flex flex-col md:flex-row md:items-start gap-4">
            <div className={`p-3 rounded-xl ${status.color} w-fit`}><Icon className="w-6 h-6" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-extrabold text-sm">{order.order_number}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-black flex items-center justify-center shrink-0 overflow-hidden">
                  {productImageURL ? (
                    <img src={productImageURL} alt={firstItem?.product_name || "Produk pesanan"} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{firstItem?.product_name || "Pesanan produk"}</div>
                  <p className="text-sm text-gray-500 mt-1">{order.items?.length || 0} item | {new Date(order.created_at || "").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-3">
                    <span className="inline-flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> {payment ? paymentMethodLabel(payment.method) : "Pembayaran belum tersedia"}</span>
                    {order.courier_code && <span className="inline-flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> {order.courier_code.toUpperCase()} {order.courier_service}</span>}
                    {order.tracking_number && <span className="inline-flex items-center gap-1"><ReceiptText className="w-3.5 h-3.5" /> {order.tracking_number}</span>}
                  </div>
                </div>
              </div>
            </div>
            <div className="md:text-right shrink-0">
              <div className="text-xs text-gray-500 mb-1">Total</div>
              <div className="font-extrabold text-lg text-[var(--color-brand-600)]">Rp {order.total.toLocaleString("id-ID")}</div>
            </div>
            <ChevronRight className="hidden md:block w-5 h-5 text-gray-400 shrink-0 mt-1" />
          </div>
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-zinc-950/70">
          <div className="text-xs text-gray-500">{nextStepText(order.status, payment?.status)}</div>
          <div className="flex gap-2">
            {order.status === "PENDING_PAYMENT" && payment?.method === "manual_bank_transfer" && (
              <Link href={`/orders/${order.id}`} className="px-3 py-2 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold hover:bg-amber-100">Upload Bukti</Link>
            )}
            {order.status === "DELIVERED" && (
              <Link href={`/orders/${order.id}`} className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100">Konfirmasi Terima</Link>
            )}
            {order.status === "COMPLETED" && (
              <Link href={`/orders/${order.id}`} className="px-3 py-2 rounded-lg bg-[var(--color-brand-50)] text-[var(--color-brand-700)] text-xs font-bold hover:bg-[var(--color-brand-100)]">Beri Review</Link>
            )}
            <Link href={`/orders/${order.id}`} className="px-3 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black text-xs font-bold">Detail</Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function paymentMethodLabel(method: string) {
  switch (method) {
    case "manual_bank_transfer":
    case "bank_transfer":
      return "Transfer Manual";
    case "midtrans_bank_transfer":
      return "Virtual Account";
    case "midtrans_ewallet":
      return "E-Wallet";
    case "midtrans_card":
      return "Kartu";
    default:
      return method?.replace(/_/g, " ") || "-";
  }
}

function nextStepText(orderStatus: string, paymentStatus?: string) {
  if (orderStatus === "PENDING_PAYMENT") {
    if (paymentStatus === "WAITING_CONFIRMATION") return "Bukti pembayaran lu sedang dicek admin.";
    return "Selesaikan pembayaran supaya pesanan bisa diproses.";
  }
  if (orderStatus === "PAID") return "Pembayaran sudah diterima, pesanan menunggu diproses.";
  if (orderStatus === "PROCESSING") return "Pesanan sedang disiapkan oleh admin.";
  if (orderStatus === "SHIPPED") return "Pesanan sedang dalam pengiriman.";
  if (orderStatus === "DELIVERED") return "Konfirmasi kalau pesanan sudah lu terima.";
  if (orderStatus === "COMPLETED") return "Pesanan selesai. Lu bisa kasih review produk.";
  if (orderStatus === "CANCELLED") return "Pesanan ini sudah dibatalkan.";
  return "Cek detail pesanan untuk informasi lengkap.";
}
