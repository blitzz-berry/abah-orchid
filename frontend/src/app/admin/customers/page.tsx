"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Search, Users, ShoppingCart, User } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);

  useEffect(() => {
    const f = async () => { try { const r = await api.get("/admin/customers"); setCustomers(r.data.data || []); } catch {} finally { setIsLoading(false); } };
    f();
  }, []);

  const handleViewDetail = async (customer: any) => {
    setSelected(customer);
    try { const r = await api.get(`/admin/customers/${customer.id}`); setCustomerOrders(r.data.data?.orders || []); } catch { setCustomerOrders([]); }
  };

  const filtered = customers.filter(c => !search || c.full_name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()));
  const totalCustomers = customers.length;
  const b2bCount = customers.filter(c => c.customer_type === "B2B").length;

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8"><h1 className="text-3xl font-extrabold mb-1">Pelanggan</h1><p className="text-gray-500 text-sm">Kelola data pelanggan terdaftar</p></div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Pelanggan", value: totalCustomers, icon: Users, color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20" },
          { label: "Pelanggan B2B", value: b2bCount, icon: ShoppingCart, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
          { label: "Pelanggan B2C", value: totalCustomers - b2bCount, icon: User, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" },
        ].map((k, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
            <div className={`p-2 w-max rounded-xl mb-2 ${k.color}`}><k.icon className="w-4 h-4" /></div>
            <div className="text-xs text-gray-500 mb-0.5">{k.label}</div>
            <div className="text-lg font-extrabold">{k.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="relative mb-6 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama/email..." className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm" /></div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left"><thead><tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-950">
            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Pelanggan</th>
            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Email</th>
            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Telepon</th>
            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Tipe</th>
            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Terdaftar</th>
            <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Aksi</th>
          </tr></thead>
          <tbody>{isLoading ? <tr><td colSpan={6} className="p-8 text-center"><div className="w-6 h-6 border-2 border-t-[var(--color-brand-600)] rounded-full animate-spin mx-auto" /></td></tr>
          : filtered.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-gray-500 text-sm">Tidak ada pelanggan</td></tr>
          : filtered.map(c => (
            <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-900/50">
              <td className="p-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-brand-400)] to-[var(--color-leaf-500)] flex items-center justify-center text-white text-xs font-bold">{c.full_name?.charAt(0)?.toUpperCase()}</div><span className="font-bold text-sm">{c.full_name}</span></div></td>
              <td className="p-4 text-sm text-gray-500">{c.email}</td>
              <td className="p-4 text-sm">{c.phone || "-"}</td>
              <td className="p-4"><span className={`text-[10px] font-bold px-2 py-1 rounded-full ${c.customer_type === "B2B" ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-600"}`}>{c.customer_type || "B2C"}</span></td>
              <td className="p-4 text-xs text-gray-500">{new Date(c.created_at).toLocaleDateString("id-ID")}</td>
              <td className="p-4 text-right"><button onClick={() => handleViewDetail(c)} className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-zinc-700">Detail</button></td>
            </motion.tr>
          ))}</tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--color-brand-400)] to-[var(--color-leaf-500)] flex items-center justify-center text-white text-xl font-bold">{selected.full_name?.charAt(0)?.toUpperCase()}</div>
              <div><h2 className="text-xl font-bold">{selected.full_name}</h2><p className="text-sm text-gray-500">{selected.email}</p></div>
            </div>
            <div className="space-y-2 text-sm mb-6">
              <div className="flex justify-between"><span className="text-gray-500">Telepon</span><span>{selected.phone || "-"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Tipe</span><span className="font-bold">{selected.customer_type || "B2C"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Bergabung</span><span>{new Date(selected.created_at).toLocaleDateString("id-ID")}</span></div>
            </div>
            <h3 className="font-bold mb-3">Riwayat Pesanan ({customerOrders.length})</h3>
            {customerOrders.length === 0 ? <p className="text-gray-500 text-sm">Belum ada pesanan</p> : (
              <div className="flex flex-col gap-2">{customerOrders.slice(0, 5).map((o: any) => (
                <div key={o.id} className="flex justify-between p-3 border border-gray-100 dark:border-gray-800 rounded-xl text-sm">
                  <div><div className="font-medium">{o.order_number}</div><div className="text-xs text-gray-500">{o.status?.replace(/_/g, " ")}</div></div>
                  <div className="font-bold">Rp {o.total?.toLocaleString("id-ID")}</div>
                </div>
              ))}</div>
            )}
            <button onClick={() => setSelected(null)} className="w-full mt-6 py-2.5 border border-gray-200 dark:border-gray-800 rounded-xl font-bold text-sm hover:bg-gray-100 dark:hover:bg-zinc-800">Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
}
