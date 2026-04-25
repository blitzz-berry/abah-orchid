"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { AlertTriangle, Edit2, Package, Search, TrendingDown, X } from "lucide-react";
import { motion } from "framer-motion";
import type { Product, StockMovement } from "@/types";

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [tab, setTab] = useState<"stock" | "movements">("stock");
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [stockForm, setStockForm] = useState({ quantity: 0, low_stock_threshold: 5, note: "" });

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const [inventoryRes, movementRes] = await Promise.allSettled([
        api.get("/admin/inventory"),
        api.get("/admin/inventory/movements"),
      ]);
      if (inventoryRes.status === "fulfilled") setProducts(inventoryRes.value.data.data || []);
      if (movementRes.status === "fulfilled") setMovements(movementRes.value.data.data || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchInventory();
  }, []);

  const filtered = useMemo(() => {
    return products.filter((product) => {
      const haystack = `${product.name} ${product.category?.name || ""}`.toLowerCase();
      if (search && !haystack.includes(search.toLowerCase())) return false;
      if (showLowOnly && (product.inventory?.quantity ?? 0) > (product.inventory?.low_stock_threshold ?? 5)) return false;
      return true;
    });
  }, [products, search, showLowOnly]);

  const totalItems = products.reduce((acc, product) => acc + (product.inventory?.quantity ?? 0), 0);
  const totalValue = products.reduce((acc, product) => acc + product.price * (product.inventory?.quantity ?? 0), 0);
  const lowStockCount = products.filter((product) => {
    const qty = product.inventory?.quantity ?? 0;
    const threshold = product.inventory?.low_stock_threshold ?? 5;
    return qty > 0 && qty <= threshold;
  }).length;
  const outOfStock = products.filter((product) => (product.inventory?.quantity ?? 0) === 0).length;

  const openStockModal = (product: Product) => {
    setActiveProduct(product);
    setStockForm({
      quantity: product.inventory?.quantity ?? 0,
      low_stock_threshold: product.inventory?.low_stock_threshold ?? 5,
      note: "",
    });
  };

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct) return;
    try {
      await api.put(`/admin/inventory/${activeProduct.id}`, {
        quantity: Number(stockForm.quantity),
        low_stock_threshold: Number(stockForm.low_stock_threshold),
        note: stockForm.note,
      });
      setActiveProduct(null);
      await fetchInventory();
    } catch (e: any) {
      alert("Gagal update inventory: " + (e.response?.data?.error || e.message));
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold mb-1">Inventori</h1>
        <p className="text-gray-500 text-sm">Monitor stok, threshold stok rendah, nilai inventori, dan movement log</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Item", value: totalItems.toLocaleString("id-ID"), icon: Package, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
          { label: "Nilai Inventori", value: `Rp ${totalValue.toLocaleString("id-ID")}`, icon: TrendingDown, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" },
          { label: "Stok Rendah", value: lowStockCount.toString(), icon: AlertTriangle, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20" },
          { label: "Habis", value: outOfStock.toString(), icon: AlertTriangle, color: "text-red-600 bg-red-50 dark:bg-red-900/20" },
        ].map((kpi, index) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
            <div className={`p-2 w-max rounded-xl mb-2 ${kpi.color}`}><kpi.icon className="w-4 h-4" /></div>
            <div className="text-xs text-gray-500 mb-0.5">{kpi.label}</div>
            <div className="text-lg font-extrabold">{kpi.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab("stock")} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${tab === "stock" ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-gray-100 dark:hover:bg-zinc-800"}`}>Stok Produk</button>
        <button onClick={() => setTab("movements")} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${tab === "movements" ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-gray-100 dark:hover:bg-zinc-800"}`}>Riwayat Movement</button>
      </div>

      {tab === "stock" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk/kategori..." className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm" />
            </div>
            <button onClick={() => setShowLowOnly(!showLowOnly)} className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${showLowOnly ? "border-amber-500 bg-amber-50 text-amber-600" : "border-gray-200 dark:border-gray-800"}`}><AlertTriangle className="w-4 h-4 inline mr-1" /> Stok Rendah Only</button>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-950">
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Produk</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Unit</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Stok</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Threshold</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Nilai</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={7} className="p-8 text-center"><div className="w-6 h-6 border-2 border-t-[var(--color-brand-600)] rounded-full animate-spin mx-auto" /></td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-gray-500 text-sm">Tidak ada inventory</td></tr>
                  ) : filtered.map((product) => {
                    const qty = product.inventory?.quantity ?? 0;
                    const threshold = product.inventory?.low_stock_threshold ?? 5;
                    const isLow = qty <= threshold && qty > 0;
                    const isOut = qty === 0;
                    return (
                      <tr key={product.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="p-4"><div className="font-bold text-sm">{product.name}</div><div className="text-xs text-gray-500">{product.category?.name}</div></td>
                        <td className="p-4 text-xs"><span className="bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded font-medium">{product.unit_type?.replace(/_/g, " ")}</span></td>
                        <td className="p-4 font-bold text-sm">{qty}</td>
                        <td className="p-4 text-sm text-gray-500">{threshold}</td>
                        <td className="p-4 text-sm font-medium">Rp {(product.price * qty).toLocaleString("id-ID")}</td>
                        <td className="p-4">{isOut ? <Badge color="red" label="HABIS" /> : isLow ? <Badge color="amber" label="RENDAH" /> : <Badge color="emerald" label="AMAN" />}</td>
                        <td className="p-4 text-right"><button onClick={() => openStockModal(product)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-leaf-50)] text-[var(--color-leaf-600)] text-xs font-bold hover:bg-[var(--color-leaf-100)]"><Edit2 className="w-3.5 h-3.5" /> Update</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "movements" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-950">
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase">Produk</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase">Tipe</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase">Qty</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase">Referensi</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase">Catatan</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500 text-sm">Belum ada riwayat</td></tr>
                ) : movements.map((movement) => (
                  <tr key={movement.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="p-4 text-sm font-medium">{movement.product?.name || movement.product_id}</td>
                    <td className="p-4"><MovementBadge type={movement.movement_type} /></td>
                    <td className="p-4 font-bold text-sm">{movement.quantity}</td>
                    <td className="p-4 text-xs text-gray-500">{movement.reference_type || "-"}</td>
                    <td className="p-4 text-xs text-gray-500">{movement.note || "-"}</td>
                    <td className="p-4 text-xs text-gray-500">{new Date(movement.created_at || "").toLocaleString("id-ID")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-xl font-bold mb-1">Update Inventory</h2>
                <p className="text-gray-500 text-sm">{activeProduct.name}</p>
              </div>
              <button onClick={() => setActiveProduct(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleStockSubmit} className="flex flex-col gap-4">
              <NumberInput label="Jumlah Stok" value={stockForm.quantity} onChange={(value) => setStockForm((prev) => ({ ...prev, quantity: value }))} />
              <NumberInput label="Low Stock Threshold" value={stockForm.low_stock_threshold} onChange={(value) => setStockForm((prev) => ({ ...prev, low_stock_threshold: value }))} />
              <div>
                <label className="text-sm font-medium mb-1 block">Catatan Movement</label>
                <input required value={stockForm.note} onChange={(e) => setStockForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="Restock, opname, koreksi, dll" className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setActiveProduct(null)} className="px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-100 dark:hover:bg-zinc-800">Batal</button>
                <button type="submit" className="bg-[var(--color-leaf-600)] text-white px-5 py-2.5 rounded-xl font-bold text-sm">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <label className="text-sm font-medium mb-1 block">{label}</label>
      <input type="number" min={0} required value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" />
    </div>
  );
}

function Badge({ color, label }: { color: "red" | "amber" | "emerald"; label: string }) {
  const styles = {
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };
  return <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${styles[color]}`}>{label}</span>;
}

function MovementBadge({ type }: { type: string }) {
  const style = type === "STOCK_IN" ? "bg-emerald-50 text-emerald-600" : type === "STOCK_OUT" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600";
  return <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${style}`}>{type}</span>;
}
