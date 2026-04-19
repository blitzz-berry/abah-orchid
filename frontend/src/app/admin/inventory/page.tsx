"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Search, AlertTriangle, Package, ArrowUpDown, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [tab, setTab] = useState<"stock" | "movements">("stock");

  useEffect(() => {
    const f = async () => {
      try {
        const [pRes, mRes] = await Promise.allSettled([api.get("/products"), api.get("/admin/inventory/movements")]);
        if (pRes.status === "fulfilled") setProducts(pRes.value.data.data || []);
        if (mRes.status === "fulfilled") setMovements(mRes.value.data.data || []);
      } catch {} finally { setIsLoading(false); }
    };
    f();
  }, []);

  const filtered = products.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (showLowOnly && (p.inventory?.quantity ?? 0) > (p.inventory?.low_stock_threshold ?? 5)) return false;
    return true;
  });

  const totalItems = products.reduce((a, p) => a + (p.inventory?.quantity ?? 0), 0);
  const totalValue = products.reduce((a, p) => a + (p.price * (p.inventory?.quantity ?? 0)), 0);
  const lowStockCount = products.filter(p => (p.inventory?.quantity ?? 0) <= (p.inventory?.low_stock_threshold ?? 5)).length;
  const outOfStock = products.filter(p => (p.inventory?.quantity ?? 0) === 0).length;

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8"><h1 className="text-3xl font-extrabold mb-1">Inventori</h1><p className="text-gray-500 text-sm">Monitor stok dan riwayat pergerakan barang</p></div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Item", value: totalItems.toLocaleString("id-ID"), icon: Package, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
          { label: "Nilai Inventori", value: `Rp ${totalValue.toLocaleString("id-ID")}`, icon: TrendingDown, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" },
          { label: "Stok Rendah", value: lowStockCount.toString(), icon: AlertTriangle, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20" },
          { label: "Habis", value: outOfStock.toString(), icon: AlertTriangle, color: "text-red-600 bg-red-50 dark:bg-red-900/20" },
        ].map((k, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
            <div className={`p-2 w-max rounded-xl mb-2 ${k.color}`}><k.icon className="w-4 h-4" /></div>
            <div className="text-xs text-gray-500 mb-0.5">{k.label}</div>
            <div className="text-lg font-extrabold">{k.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab("stock")} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${tab === "stock" ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-gray-100 dark:hover:bg-zinc-800"}`}>Stok Produk</button>
        <button onClick={() => setTab("movements")} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${tab === "movements" ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-gray-100 dark:hover:bg-zinc-800"}`}>Riwayat Movement</button>
      </div>

      {tab === "stock" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari..." className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm" /></div>
            <button onClick={() => setShowLowOnly(!showLowOnly)} className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${showLowOnly ? "border-amber-500 bg-amber-50 text-amber-600" : "border-gray-200 dark:border-gray-800"}`}><AlertTriangle className="w-4 h-4 inline mr-1" /> Stok Rendah Only</button>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left"><thead><tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-950">
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">Produk</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">Unit</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">Stok</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">Threshold</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">Status</th>
              </tr></thead>
              <tbody>{isLoading ? <tr><td colSpan={5} className="p-8 text-center"><div className="w-6 h-6 border-2 border-t-[var(--color-brand-600)] rounded-full animate-spin mx-auto" /></td></tr>
              : filtered.map(p => {
                const qty = p.inventory?.quantity ?? 0;
                const thresh = p.inventory?.low_stock_threshold ?? 5;
                const isLow = qty <= thresh && qty > 0;
                const isOut = qty === 0;
                return (
                  <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="p-4"><div className="font-bold text-sm">{p.name}</div><div className="text-xs text-gray-500">{p.category?.name}</div></td>
                    <td className="p-4 text-xs"><span className="bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded font-medium">{p.unit_type?.replace(/_/g, " ")}</span></td>
                    <td className="p-4 font-bold text-sm">{qty}</td>
                    <td className="p-4 text-sm text-gray-500">{thresh}</td>
                    <td className="p-4">{isOut ? <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-red-50 text-red-600">HABIS</span> : isLow ? <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-600">RENDAH</span> : <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-600">AMAN</span>}</td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          </div>
        </>
      )}

      {tab === "movements" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left"><thead><tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-950">
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Produk</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Tipe</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Qty</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Catatan</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Tanggal</th>
            </tr></thead>
            <tbody>{movements.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-gray-500 text-sm">Belum ada riwayat</td></tr>
            : movements.map(m => (
              <tr key={m.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-4 text-sm font-medium">{m.product?.name || m.product_id}</td>
                <td className="p-4"><span className={`text-[10px] font-bold px-2 py-1 rounded-full ${m.movement_type === "STOCK_IN" ? "bg-emerald-50 text-emerald-600" : m.movement_type === "STOCK_OUT" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>{m.movement_type}</span></td>
                <td className="p-4 font-bold text-sm">{m.quantity > 0 ? "+" : ""}{m.quantity}</td>
                <td className="p-4 text-xs text-gray-500">{m.note || "-"}</td>
                <td className="p-4 text-xs text-gray-500">{new Date(m.created_at).toLocaleDateString("id-ID")}</td>
              </tr>
            ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
