"use client";

import { useEffect, useState } from "react";
import { Users, DollarSign, Package, TrendingUp, AlertTriangle } from "lucide-react";
import api from "@/lib/api";
import { motion } from "framer-motion";

export default function AdminDashboard() {
  const [kpi, setKpi] = useState({
    revenue: 0,
    orders: 0,
    customers: 0,
    low_stock: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchKPI = async () => {
      try {
        const res = await api.get("/admin/kpi");
        setKpi(res.data.data);
      } catch (error) {
        console.error("Failed to fetch KPIs", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchKPI();
  }, []);

  const statCards = [
    { title: "Total Penjualan", value: `Rp ${kpi.revenue.toLocaleString('id-ID')}`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30", border: "border-emerald-200 dark:border-emerald-800" },
    { title: "Pesanan Aktif", value: kpi.orders.toString(), icon: Package, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30", border: "border-blue-200 dark:border-blue-800" },
    { title: "Total Pelanggan", value: kpi.customers.toString(), icon: Users, color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900/30", border: "border-purple-200 dark:border-purple-800" },
    { title: "Peringatan Stok Low", value: kpi.low_stock.toString(), icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30", border: "border-amber-200 dark:border-amber-800" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col md:flex-row">
      {/* Sidebar Setup (Basic) */}
      <aside className="w-full md:w-64 bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 p-6 flex flex-col hidden md:flex">
        <h2 className="text-xl font-extrabold tracking-tight mb-8 text-[var(--color-leaf-600)]">OrchidAdmin</h2>
        <nav className="flex flex-col gap-2 flex-1">
          <a href="#" className="p-3 bg-black text-white dark:bg-white dark:text-black rounded-xl font-medium">Dashboard</a>
          <a href="#" className="p-3 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-xl font-medium transition-colors">Manajemen Produk</a>
          <a href="#" className="p-3 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-xl font-medium transition-colors">Pesanan Sales</a>
          <a href="#" className="p-3 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-xl font-medium transition-colors">Analisis Tren</a>
        </nav>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-extrabold mb-2">Ikhtisar Bisnis</h1>
            <p className="text-gray-500">Memonitor penjualan anggrek dan operasional gudang.</p>
          </div>
          <button className="flex items-center gap-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors">
            <TrendingUp className="w-4 h-4" /> Export Laporan
          </button>
        </div>

        {isLoading ? (
           <div className="flex justify-center py-20">
             <div className="w-8 h-8 border-4 border-gray-200 border-t-[var(--color-brand-500)] rounded-full animate-spin"></div>
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {statCards.map((stat, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                key={idx} 
                className={`bg-white dark:bg-black border ${stat.border} p-6 rounded-2xl shadow-sm flex flex-col`}
              >
                <div className={`p-3 w-max ${stat.bg} ${stat.color} rounded-xl mb-4`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <h3 className="text-gray-500 font-medium mb-1">{stat.title}</h3>
                <p className="text-3xl font-extrabold text-black dark:text-white">{stat.value}</p>
              </motion.div>
            ))}
          </div>
        )}

        <div className="glass rounded-3xl p-8 text-center mt-8">
           <h3 className="text-xl font-bold mb-2">Area Grafik Analitik</h3>
           <p className="text-gray-500">Integrasi Recharts/Chart.js dapat ditempatkan disini untuk visualisasi Tren Penjualan dan Stok Opname sesuai PRD.</p>
        </div>
      </main>
    </div>
  );
}
