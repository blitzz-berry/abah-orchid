"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Plus, Edit2, Trash2, PackagePlus, AlertCircle, Search } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "", price: 0, unit_type: "PER_POHON", category_id: "", weight_gram: 500, size: "", condition: "" });
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<any>(null);
  const [stockData, setStockData] = useState({ quantity: 0, note: "" });
  const [categories, setCategories] = useState<any[]>([]);

  const fetchProducts = async () => {
    setIsLoading(true);
    try { const r = await api.get("/products"); setProducts(r.data.data || []); } catch {} finally { setIsLoading(false); }
  };

  useEffect(() => {
    fetchProducts();
    api.get("/categories").then(r => setCategories(r.data.data || [])).catch(() => {});
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/products", { ...formData, price: Number(formData.price), weight_gram: Number(formData.weight_gram) });
      setIsAddModalOpen(false);
      setFormData({ name: "", description: "", price: 0, unit_type: "PER_POHON", category_id: "", weight_gram: 500, size: "", condition: "" });
      fetchProducts();
    } catch (e: any) { alert("Gagal: " + (e.response?.data?.error || e.message)); }
  };

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct) return;
    try {
      await api.post(`/products/${activeProduct.id}/adjust-stock`, { quantity: Number(stockData.quantity), note: stockData.note });
      setIsStockModalOpen(false);
      fetchProducts();
    } catch (e: any) { alert("Gagal: " + (e.response?.data?.error || e.message)); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus produk ini?")) return;
    try { await api.delete(`/products/${id}`); fetchProducts(); } catch { alert("Gagal menghapus"); }
  };

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div><h1 className="text-3xl font-extrabold mb-1">Manajemen Produk</h1><p className="text-gray-500 text-sm">Kelola katalog, harga, dan stok anggrek</p></div>
        <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 bg-[var(--color-brand-600)] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:scale-105 transition-transform"><Plus className="w-4 h-4" /> Tambah Produk</button>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari produk..." className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm" />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-950">
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Produk</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Unit</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Harga</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Stok</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Aksi</th>
            </tr></thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="p-8 text-center"><div className="w-6 h-6 border-2 border-t-[var(--color-brand-600)] rounded-full animate-spin mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500 text-sm">Tidak ada produk</td></tr>
              ) : filtered.map(p => (
                <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                  <td className="p-4"><div className="font-bold text-sm">{p.name}</div><div className="text-xs text-gray-500 truncate max-w-[200px]">{p.category?.name || "-"}</div></td>
                  <td className="p-4"><span className="bg-gray-100 dark:bg-zinc-800 text-xs px-2 py-1 rounded font-medium">{p.unit_type?.replace(/_/g, " ")}</span></td>
                  <td className="p-4 font-medium text-sm">Rp {p.price?.toLocaleString("id-ID")}</td>
                  <td className="p-4">{(p.inventory?.quantity ?? 0) <= 5 ? <span className="flex items-center gap-1 text-red-500 font-bold text-sm"><AlertCircle className="w-4 h-4" />{p.inventory?.quantity ?? 0}</span> : <span className="font-medium text-emerald-600 text-sm">{p.inventory?.quantity ?? 0}</span>}</td>
                  <td className="p-4"><div className="flex gap-1.5 justify-end">
                    <button onClick={() => { setActiveProduct(p); setStockData({ quantity: p.inventory?.quantity || 0, note: "" }); setIsStockModalOpen(true); }} className="p-2 bg-[var(--color-leaf-50)] text-[var(--color-leaf-600)] rounded-lg hover:bg-[var(--color-leaf-100)]" title="Koreksi Stok"><PackagePlus className="w-4 h-4" /></button>
                    <button className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(p.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 className="w-4 h-4" /></button>
                  </div></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-5">Tambah Produk</h2>
            <form onSubmit={handleAddSubmit} className="flex flex-col gap-4">
              <div><label className="text-sm font-medium mb-1 block">Nama</label><input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" /></div>
              <div><label className="text-sm font-medium mb-1 block">Deskripsi</label><textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" rows={3} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium mb-1 block">Harga (Rp)</label><input type="number" required value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" /></div>
                <div><label className="text-sm font-medium mb-1 block">Unit</label><select value={formData.unit_type} onChange={e => setFormData({...formData, unit_type: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm"><option value="PER_POHON">Per Pohon</option><option value="PER_BATCH">Per Batch</option><option value="PER_VARIETAS">Per Varietas</option></select></div>
                <div><label className="text-sm font-medium mb-1 block">Ukuran</label><select value={formData.size} onChange={e => setFormData({...formData, size: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm"><option value="">-</option><option value="seedling">Seedling</option><option value="remaja">Remaja</option><option value="dewasa">Dewasa</option><option value="berbunga">Berbunga</option></select></div>
                <div><label className="text-sm font-medium mb-1 block">Berat (gram)</label><input type="number" value={formData.weight_gram} onChange={e => setFormData({...formData, weight_gram: Number(e.target.value)})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" /></div>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-100 dark:hover:bg-zinc-800">Batal</button>
                <button type="submit" className="bg-[var(--color-brand-600)] text-white px-5 py-2.5 rounded-xl font-bold text-sm">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Modal */}
      {isStockModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-xl font-bold mb-2">Koreksi Stok</h2>
            <p className="text-gray-500 text-sm mb-5">{activeProduct?.name}</p>
            <form onSubmit={handleStockSubmit} className="flex flex-col gap-4">
              <div><label className="text-sm font-medium mb-1 block">Jumlah Stok</label><input type="number" required value={stockData.quantity} onChange={e => setStockData({...stockData, quantity: Number(e.target.value)})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" /></div>
              <div><label className="text-sm font-medium mb-1 block">Catatan</label><input required placeholder="Alasan koreksi" value={stockData.note} onChange={e => setStockData({...stockData, note: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" /></div>
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setIsStockModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-100 dark:hover:bg-zinc-800">Batal</button>
                <button type="submit" className="bg-[var(--color-leaf-600)] text-white px-5 py-2.5 rounded-xl font-bold text-sm">Update</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
