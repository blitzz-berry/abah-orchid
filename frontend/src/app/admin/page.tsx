"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, DollarSign, Package, AlertTriangle, TrendingUp, ArrowUpRight, ArrowDownRight, ChevronRight } from "lucide-react";
import api from "@/lib/api";
import { motion } from "framer-motion";

export default function AdminDashboard() {
  const [kpi, setKpi] = useState({ revenue: 0, orders: 0, customers: 0, low_stock: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [kpiRes, ordRes] = await Promise.allSettled([api.get("/admin/kpi"), api.get("/admin/orders?limit=5")]);
        if (kpiRes.status === "fulfilled") setKpi(kpiRes.value.data.data || kpiRes.value.data);
        if (ordRes.status === "fulfilled") setRecentOrders((ordRes.value.data.data || []).slice(0, 5));
      } catch {} finally { setIsLoading(false); }
    };
    fetchData();
  }, []);

  const cards = [
    { title: "Total Penjualan", value: `Rp ${kpi.revenue.toLocaleString("id-ID")}`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20", trend: "+12%", up: true },
    { title: "Pesanan", value: kpi.orders.toString(), icon: Package, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20", trend: "+8%", up: true },
    { title: "Pelanggan", value: kpi.customers.toString(), icon: Users, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20", trend: "+5%", up: true },
    { title: "Stok Rendah", value: kpi.low_stock.toString(), icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20", trend: kpi.low_stock > 0 ? "Perlu restock" : "Aman", up: false },
  ];

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div><h1 className="text-3xl font-extrabold mb-1">Dashboard</h1><p className="text-gray-500 text-sm">Monitor penjualan dan operasional anggrek</p></div>
        <div className="flex gap-2">
          <select className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 px-4 py-2 rounded-xl text-sm font-medium"><option>30 Hari Terakhir</option><option>7 Hari</option><option>3 Bulan</option><option>1 Tahun</option></select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-[var(--color-brand-500)] rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {cards.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2.5 ${s.bg} ${s.color} rounded-xl`}><s.icon className="w-5 h-5" /></div>
                  <span className={`text-xs font-bold flex items-center gap-0.5 ${s.up ? "text-emerald-600" : "text-amber-600"}`}>
                    {s.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />} {s.trend}
                  </span>
                </div>
                <h3 className="text-sm text-gray-500 font-medium mb-1">{s.title}</h3>
                <p className="text-2xl font-extrabold">{s.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Recent Orders */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Pesanan Terbaru</h3>
                <Link href="/admin/orders" className="text-xs text-[var(--color-brand-600)] font-medium hover:underline flex items-center gap-1">Lihat Semua <ChevronRight className="w-3 h-3" /></Link>
              </div>
              {recentOrders.length === 0 ? (
                <p className="text-gray-500 text-sm py-4 text-center">Belum ada pesanan</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {recentOrders.map((o: any) => (
                    <Link key={o.id} href={`/admin/orders`} className="flex items-center justify-between p-3 border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                      <div><div className="font-medium text-sm">{o.order_number}</div><div className="text-xs text-gray-500">{o.user?.full_name || "Customer"}</div></div>
                      <div className="text-right"><div className="font-bold text-sm">Rp {o.total?.toLocaleString("id-ID") || "0"}</div><div className="text-[10px] font-medium text-gray-500">{o.status?.replace(/_/g, " ")}</div></div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Chart Placeholder */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex flex-col">
              <h3 className="font-bold mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-[var(--color-brand-600)]" /> Grafik Penjualan</h3>
              <div className="flex-1 flex items-center justify-center text-gray-400 min-h-[200px] border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                <div className="text-center"><TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">Grafik Recharts/Chart.js</p><p className="text-xs text-gray-400">Integrasi chart sesuai PRD DASH-S04</p></div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
