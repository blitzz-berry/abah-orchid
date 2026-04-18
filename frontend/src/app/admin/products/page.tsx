"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Plus, Edit2, Trash2, PackagePlus, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // States for Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "", price: 0, unit_type: "PER_POHON" });

  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<any>(null);
  const [stockData, setStockData] = useState({ quantity: 0, note: "" });

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/products");
      setProducts(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/products", {
        ...formData,
        price: Number(formData.price),
      });
      setIsAddModalOpen(false);
      setFormData({ name: "", description: "", price: 0, unit_type: "PER_POHON" });
      fetchProducts();
    } catch (e: any) {
      alert("Failed to add product: " + e.message);
    }
  };

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct) return;
    try {
      await api.post(`/products/${activeProduct.id}/adjust-stock`, {
        quantity: Number(stockData.quantity),
        note: stockData.note,
      });
      setIsStockModalOpen(false);
      setActiveProduct(null);
      setStockData({ quantity: 0, note: "" });
      fetchProducts();
    } catch (e: any) {
      alert("Failed to adjust stock: " + e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus anggrek ini permanen?")) return;
    try {
      await api.delete(`/products/${id}`);
      fetchProducts();
    } catch (e) {
      alert("Gagal menghapus produk");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col md:flex-row">
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-10 w-full flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link href="/admin" className="text-gray-500 hover:text-black dark:hover:text-white"><ArrowLeft className="w-5 h-5"/></Link>
              <h1 className="text-3xl font-extrabold">Manajemen Anggrek</h1>
            </div>
            <p className="text-gray-500">Kelola katalog produk, harga, dan opname stok gudang.</p>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-[var(--color-brand-600)] text-white px-5 py-2.5 rounded-xl font-bold shadow-sm hover:scale-105 transition-transform"
          >
            <Plus className="w-5 h-5" /> Tambah Anggrek Baru
          </button>
        </div>

        <div className="bg-white dark:bg-black rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-900">
                  <th className="p-4 font-bold text-gray-500 text-sm">PRODUK</th>
                  <th className="p-4 font-bold text-gray-500 text-sm">TIPE UNIT</th>
                  <th className="p-4 font-bold text-gray-500 text-sm">HARGA</th>
                  <th className="p-4 font-bold text-gray-500 text-sm">STOK TERSEDIA</th>
                  <th className="p-4 font-bold text-gray-500 text-sm text-right">AKSI</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="p-8 text-center"><div className="w-6 h-6 border-2 border-t-[var(--color-brand-600)] rounded-full animate-spin mx-auto"></div></td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-500">Katalog kosong</td></tr>
                ) : (
                  products.map((p) => (
                    <motion.tr 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={p.id} className="border-b border-gray-100 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors"
                    >
                      <td className="p-4">
                        <div className="font-bold">{p.name}</div>
                        <div className="text-xs text-gray-500 truncate max-w-[200px]">{p.description}</div>
                      </td>
                      <td className="p-4">
                        <span className="bg-gray-100 dark:bg-zinc-800 text-xs px-2 py-1 rounded font-medium">{p.unit_type}</span>
                      </td>
                      <td className="p-4 font-medium">Rp {p.price.toLocaleString('id-ID')}</td>
                      <td className="p-4">
                        {p.inventory?.quantity <= 5 ? (
                          <span className="flex items-center gap-1 text-red-500 font-bold"><AlertCircle className="w-4 h-4"/> {p.inventory?.quantity || 0}</span>
                        ) : (
                          <span className="font-medium text-emerald-600">{p.inventory?.quantity || 0}</span>
                        )}
                      </td>
                      <td className="p-4 flex gap-2 justify-end">
                        <button 
                          onClick={() => { setActiveProduct(p); setStockData({ quantity: p.inventory?.quantity || 0, note: "" }); setIsStockModalOpen(true); }}
                          className="p-2 bg-[var(--color-leaf-50)] text-[var(--color-leaf-600)] rounded-lg hover:bg-[var(--color-leaf-100)] transition-colors" title="Koreksi Stok (Opname)"
                        >
                          <PackagePlus className="w-4 h-4" />
                        </button>
                        <button className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(p.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Tambah Produk */}
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-md shadow-2xl">
              <h2 className="text-2xl font-bold mb-6">Tambah Anggrek</h2>
              <form onSubmit={handleAddSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Nama Varietas</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Deskripsi</label>
                  <textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3" rows={3}></textarea>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-1 block">Harga (Rp)</label>
                    <input type="number" required value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3" />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-1 block">Unit</label>
                    <select value={formData.unit_type} onChange={e => setFormData({...formData, unit_type: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3">
                      <option value="PER_POHON">Per Pohon</option>
                      <option value="PER_BATCH">Per Batch</option>
                      <option value="PER_VARIETAS">Per Varietas</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold hover:bg-gray-100 dark:hover:bg-zinc-800">Batal</button>
                  <button type="submit" className="bg-[var(--color-brand-600)] text-white px-5 py-2.5 rounded-xl font-bold">Simpan</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Koreksi Stok */}
        {isStockModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
              <h2 className="text-xl font-bold mb-2">Koreksi Fisik Stok</h2>
              <p className="text-gray-500 text-sm mb-6">Sesuaikan angka stok {activeProduct?.name} dengan fisik di gudang/kebun.</p>
              <form onSubmit={handleStockSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Jumlah Real Tersedia</label>
                  <input type="number" required value={stockData.quantity} onChange={e => setStockData({...stockData, quantity: Number(e.target.value)})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Catatan Opname</label>
                  <input placeholder="Cth: Anggrek layu 2 pot" required value={stockData.note} onChange={e => setStockData({...stockData, note: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3" />
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button type="button" onClick={() => setIsStockModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold hover:bg-gray-100 dark:hover:bg-zinc-800">Batal</button>
                  <button type="submit" className="bg-[var(--color-leaf-600)] text-white px-5 py-2.5 rounded-xl font-bold">Update Stok</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
