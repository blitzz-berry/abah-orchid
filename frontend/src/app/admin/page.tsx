"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, DollarSign, Package, TrendingUp, ChevronRight, ShoppingBag, Boxes } from "lucide-react";
import api from "@/lib/api";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SalesPoint = {
  label: string;
  revenue: number;
  orders: number;
};

type TopProduct = {
  product_id: string;
  name: string;
  quantity: number;
  revenue: number;
};

type DashboardResponse = {
  kpi: {
    revenue: number;
    orders: number;
    customers: number;
    low_stock: number;
    aov: number;
    paid_orders: number;
  };
  sales_series: SalesPoint[];
  order_statuses: Record<string, number>;
  top_products: TopProduct[];
  customer_segments: {
    b2b: number;
    b2c: number;
  };
  low_stock_products: Array<{
    id: string;
    name: string;
    inventory?: {
      quantity: number;
      low_stock_threshold: number;
    };
  }>;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Pending",
  PAID: "Paid",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [analyticsRes, ordersRes] = await Promise.allSettled([
          api.get("/admin/analytics/overview"),
          api.get("/admin/orders"),
        ]);

        if (analyticsRes.status === "fulfilled") {
          setDashboard(analyticsRes.value.data.data || null);
        }
        if (ordersRes.status === "fulfilled") {
          setRecentOrders((ordersRes.value.data.data || []).slice(0, 5));
        }
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, []);

  const maxRevenue = useMemo(() => {
    const salesSeries = dashboard?.sales_series ?? [];
    if (!salesSeries.length) return 0;
    return Math.max(...salesSeries.map((point) => point.revenue), 0);
  }, [dashboard]);

  const salesSeries = dashboard?.sales_series ?? [];
  const orderStatuses = dashboard?.order_statuses ?? {};
  const topProducts = dashboard?.top_products ?? [];
  const customerSegments = dashboard?.customer_segments ?? { b2b: 0, b2c: 0 };
  const lowStockProducts = dashboard?.low_stock_products ?? [];

  const cards = dashboard ? [
    { title: "Total Penjualan", value: `Rp ${dashboard.kpi.revenue.toLocaleString("id-ID")}`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20", helper: `${dashboard.kpi.paid_orders} order sukses` },
    { title: "Total Pesanan", value: dashboard.kpi.orders.toLocaleString("id-ID"), icon: Package, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20", helper: "di semua status aktif" },
    { title: "Total Pelanggan", value: dashboard.kpi.customers.toLocaleString("id-ID"), icon: Users, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20", helper: `${customerSegments.b2b} B2B / ${customerSegments.b2c} B2C` },
    { title: "Average Order Value", value: `Rp ${Math.round(dashboard.kpi.aov).toLocaleString("id-ID")}`, icon: ShoppingBag, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20", helper: `${dashboard.kpi.low_stock} produk low stock` },
  ] : [];
  const heightClass = (value: number, max: number) => {
    if (max <= 0) return "h-[10px]";
    const bucket = Math.max(Math.ceil((value / max) * 10), 1);
    return ["h-[18px]", "h-[36px]", "h-[54px]", "h-[72px]", "h-[90px]", "h-[108px]", "h-[126px]", "h-[144px]", "h-[162px]", "h-[180px]"][bucket - 1] || "h-[10px]";
  };
  const widthClass = (value: number, total: number) => {
    if (total <= 0) return "w-0";
    const bucket = Math.max(Math.round((value / total) * 10), 0);
    return ["w-0", "w-[10%]", "w-[20%]", "w-[30%]", "w-[40%]", "w-[50%]", "w-[60%]", "w-[70%]", "w-[80%]", "w-[90%]", "w-full"][bucket] || "w-0";
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div><h1 className="text-3xl font-extrabold mb-1">Dashboard</h1><p className="text-gray-500 text-sm">Ringkasan operasional OrchidMart dari data transaksi nyata.</p></div>
      </div>

      {isLoading || !dashboard ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-[var(--color-brand-500)] rounded-full animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
            {cards.map((card, index) => (
              <motion.div key={card.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}>
                <Card>
                  <CardContent className="p-5">
                    <div className={`mb-3 inline-flex rounded-md p-2.5 ${card.bg} ${card.color}`}><card.icon className="w-5 h-5" /></div>
                    <h3 className="text-sm text-muted-foreground font-medium mb-1">{card.title}</h3>
                    <p className="text-2xl font-extrabold mb-1">{card.value}</p>
                    <p className="text-xs text-muted-foreground">{card.helper}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6 mb-8">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-[var(--color-brand-600)]" /> Tren Penjualan 7 Hari</CardTitle>
                <span className="text-xs text-muted-foreground">Revenue per hari</span>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-3 items-end min-h-[220px]">
                  {salesSeries.map((point) => {
                    return (
                      <div key={point.label} className="flex flex-col items-center gap-3">
                        <div className="text-[10px] text-muted-foreground font-medium text-center">Rp {Math.round(point.revenue / 1000).toLocaleString("id-ID")}k</div>
                        <div className="w-full flex justify-center">
                          <div className={`w-full max-w-[36px] rounded-t-md bg-[var(--color-brand-600)] ${heightClass(point.revenue, maxRevenue)}`} />
                        </div>
                        <div className="text-[11px] font-semibold text-center">{point.label}</div>
                        <div className="text-[10px] text-muted-foreground">{point.orders} order</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status Pesanan</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {Object.keys(orderStatuses).length === 0 ? (
                  <p className="text-muted-foreground text-sm">Belum ada distribusi status pesanan.</p>
                ) : (
                  Object.entries(orderStatuses).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between rounded-md border p-3">
                      <span className="text-sm font-medium">{STATUS_LABELS[status] || status}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Produk Terlaris</CardTitle>
                <Link href="/admin/products" className="text-xs text-[var(--color-brand-600)] font-medium hover:underline flex items-center gap-1">Kelola <ChevronRight className="w-3 h-3" /></Link>
              </CardHeader>
              <CardContent>
              {topProducts.length === 0 ? (
                <p className="text-muted-foreground text-sm">Belum ada transaksi berhasil.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {topProducts.map((product, index) => (
                    <div key={product.product_id} className="flex items-center justify-between rounded-md border p-3">
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground mb-1">#{index + 1}</div>
                        <div className="font-medium text-sm truncate">{product.name}</div>
                        <div className="text-xs text-muted-foreground">{product.quantity} item terjual</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm">Rp {Math.round(product.revenue).toLocaleString("id-ID")}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Segment Pelanggan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "B2B", value: customerSegments.b2b, color: "bg-blue-500" },
                  { label: "B2C", value: customerSegments.b2c, color: "bg-emerald-500" },
                ].map((segment) => {
                  const total = customerSegments.b2b + customerSegments.b2c || 1;
                  return (
                    <div key={segment.label}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{segment.label}</span>
                        <span className="text-sm font-bold">{segment.value}</span>
                      </div>
                      <div className="h-3 rounded-full bg-muted overflow-hidden">
                        <div className={`${segment.color} h-full rounded-full ${widthClass(segment.value, total)}`} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Boxes className="w-4 h-4 text-amber-500" /> Alert Stok</CardTitle>
                <Link href="/admin/inventory" className="text-xs text-[var(--color-brand-600)] font-medium hover:underline flex items-center gap-1">Inventori <ChevronRight className="w-3 h-3" /></Link>
              </CardHeader>
              <CardContent>
              {lowStockProducts.length === 0 ? (
                <p className="text-sm text-emerald-600 font-medium">Tidak ada produk yang perlu direstock sekarang.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {lowStockProducts.map((product) => (
                    <div key={product.id} className="rounded-md border border-amber-100 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/20">
                      <div className="font-medium text-sm">{product.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">Sisa {product.inventory?.quantity ?? 0} dari threshold {product.inventory?.low_stock_threshold ?? 5}</div>
                    </div>
                  ))}
                </div>
              )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Pesanan Terbaru</CardTitle>
              <Link href="/admin/orders" className="text-xs text-[var(--color-brand-600)] font-medium hover:underline flex items-center gap-1">Lihat Semua <ChevronRight className="w-3 h-3" /></Link>
            </CardHeader>
            <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">Belum ada pesanan</p>
            ) : (
              <div className="flex flex-col gap-2">
                {recentOrders.map((order) => (
                  <Link key={order.id} href="/admin/orders" className="flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-muted/50">
                    <div>
                      <div className="font-medium text-sm">{order.order_number}</div>
                      <div className="text-xs text-muted-foreground">{order.user?.full_name || order.shipping_name || "Pelanggan"}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm">Rp {order.total?.toLocaleString("id-ID") || "0"}</div>
                      <div className="text-[10px] font-medium text-muted-foreground">{order.status?.replace(/_/g, " ")}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
