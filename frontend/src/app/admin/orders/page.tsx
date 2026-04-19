"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Search, Truck, CheckCircle, Clock, Package, XCircle, Eye } from "lucide-react";
import { motion } from "framer-motion";

const STATUSES = ["", "PENDING_PAYMENT", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED"];
const STATUS_LABELS: Record<string, string> = { PENDING_PAYMENT: "Menunggu Bayar", PAID: "Dibayar", PROCESSING: "Diproses", SHIPPED: "Dikirim", DELIVERED: "Diterima", COMPLETED: "Selesai", CANCELLED: "Batal" };
const STATUS_COLORS: Record<string, string> = { PENDING_PAYMENT: "text-amber-600 bg-amber-50", PAID: "text-blue-600 bg-blue-50", PROCESSING: "text-purple-600 bg-purple-50", SHIPPED: "text-cyan-600 bg-cyan-50", DELIVERED: "text-emerald-600 bg-emerald-50", COMPLETED: "text-green-600 bg-green-50", CANCELLED: "text-red-600 bg-red-50" };

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [trackingInput, setTrackingInput] = useState("");

  useEffect(() => {
    const f = async () => { try { const r = await api.get("/admin/orders"); setOrders(r.data.data || []); } catch {} finally { setIsLoading(false); } };
    f();
  }, []);

  const handleUpdateStatus = async (id: string, status: string) => {
    try { await api.put(`/admin/orders/${id}/status`, { status }); setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o)); } catch (e: any) { alert("Gagal: " + (e.response?.data?.error || e.message)); }
  };

  const handleInputTracking = async (id: string) => {
    if (!trackingInput) return;
    try { await api.put(`/admin/orders/${id}/tracking`, { tracking_number: trackingInput }); setOrders(prev => prev.map(o => o.id === id ? { ...o, tracking_number: trackingInput, status: "SHIPPED" } : o)); setTrackingInput(""); setSelected(null); } catch (e: any) { alert("Gagal: " + (e.response?.data?.error || e.message)); }
  };

  const filtered = orders.filter(o => {
    if (filterStatus && o.status !== filterStatus) return false;
    if (search && !o.order_number?.toLowerCase().includes(search.toLowerCase()) && !o.shipping_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8"><h1 className="text-3xl font-extrabold mb-1">Manajemen Pesanan</h1><p className="text-gray-500 text-sm">Kelola dan proses pesanan pelanggan</p></div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari order/nama..." className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm" /></div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2.5 text-sm font-medium"><option value="">Semua Status</option>{STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}</select>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-950">
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Order</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Pelanggan</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Total</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Status</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Tanggal</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Aksi</th>
            </tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={6} className="p-8 text-center"><div className="w-6 h-6 border-2 border-t-[var(--color-brand-600)] rounded-full animate-spin mx-auto" /></td></tr>
              : filtered.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-gray-500 text-sm">Tidak ada pesanan</td></tr>
              : filtered.map(o => (
                <motion.tr key={o.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                  <td className="p-4 font-bold text-sm">{o.order_number}</td>
                  <td className="p-4"><div className="text-sm">{o.shipping_name || o.user?.full_name}</div><div className="text-xs text-gray-500">{o.shipping_phone}</div></td>
                  <td className="p-4 font-medium text-sm">Rp {o.total?.toLocaleString("id-ID")}</td>
                  <td className="p-4"><span className={`text-[10px] font-bold px-2 py-1 rounded-full ${STATUS_COLORS[o.status] || "bg-gray-100"}`}>{STATUS_LABELS[o.status] || o.status}</span></td>
                  <td className="p-4 text-xs text-gray-500">{new Date(o.created_at).toLocaleDateString("id-ID")}</td>
                  <td className="p-4"><div className="flex gap-1.5 justify-end">
                    {o.status === "PAID" && <button onClick={() => handleUpdateStatus(o.id, "PROCESSING")} className="text-xs px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg font-bold hover:bg-purple-100">Proses</button>}
                    {o.status === "PROCESSING" && <button onClick={() => { setSelected(o); setTrackingInput(""); }} className="text-xs px-3 py-1.5 bg-cyan-50 text-cyan-600 rounded-lg font-bold hover:bg-cyan-100 flex items-center gap-1"><Truck className="w-3 h-3" /> Resi</button>}
                    {o.status === "PENDING_PAYMENT" && <button onClick={() => handleUpdateStatus(o.id, "PAID")} className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg font-bold hover:bg-emerald-100"><CheckCircle className="w-3 h-3 inline mr-1" />Konfirmasi</button>}
                  </div></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tracking Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-xl font-bold mb-2">Input Resi</h2>
            <p className="text-gray-500 text-sm mb-5">{selected.order_number}</p>
            <input value={trackingInput} onChange={e => setTrackingInput(e.target.value)} placeholder="Nomor resi pengiriman" className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setSelected(null)} className="px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-100 dark:hover:bg-zinc-800">Batal</button>
              <button onClick={() => handleInputTracking(selected.id)} className="bg-cyan-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm">Kirim</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
