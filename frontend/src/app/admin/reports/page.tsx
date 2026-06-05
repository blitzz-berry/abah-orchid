"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Boxes, CalendarDays, FileSpreadsheet, FileText, PackageCheck, ReceiptText, RefreshCw, TrendingUp } from "lucide-react";
import api from "@/lib/api";
import { TableRowsSkeleton } from "@/components/ui/loading";

type ReportOrderItem = {
  product_name: string;
  quantity: number;
  subtotal: number;
};

type ReportOrder = {
  id: string;
  order_number: string;
  order_date: string;
  customer_name: string;
  status: string;
  payment_method: string;
  subtotal: number;
  discount: number;
  shipping_cost: number;
  total: number;
  items: ReportOrderItem[];
};

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

type ReportStockProduct = {
  product_id: string;
  name: string;
  category: string;
  quantity: number;
  low_stock_threshold: number;
  stock_status: string;
  price: number;
  stock_value: number;
};

type RestockRecommendation = {
  product_id: string;
  name: string;
  quantity: number;
  sold: number;
  revenue: number;
  priority: string;
};

type AdminInventoryProduct = {
  id: string;
  name: string;
  status?: string;
  price: number;
  category?: {
    name?: string;
  };
  inventory?: {
    quantity?: number;
    low_stock_threshold?: number;
  } | null;
};

type MonthlySalesReport = {
  period: {
    month: string;
    start_date: string;
    end_date: string;
  };
  summary: {
    revenue: number;
    orders: number;
    items_sold: number;
    discount: number;
    shipping: number;
    average_order: number;
    success_status: string[];
  };
  stock_summary: {
    total_products: number;
    active_products: number;
    total_stock_items: number;
    low_stock_products: number;
    out_of_stock_products: number;
    stock_value: number;
  };
  daily_sales: SalesPoint[];
  top_products: TopProduct[];
  orders: ReportOrder[];
  stock: {
    products: ReportStockProduct[];
    restock_recommendations: RestockRecommendation[];
  };
};

const STATUS_LABELS: Record<string, string> = {
  PAID: "Dibayar",
  PROCESSING: "Diproses",
  SHIPPED: "Dikirim",
  DELIVERED: "Diterima",
  COMPLETED: "Selesai",
};

const emptyStockSummary: MonthlySalesReport["stock_summary"] = {
  total_products: 0,
  active_products: 0,
  total_stock_items: 0,
  low_stock_products: 0,
  out_of_stock_products: 0,
  stock_value: 0,
};

const emptyStockReport: MonthlySalesReport["stock"] = {
  products: [],
  restock_recommendations: [],
};

export default function AdminReportsPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState<MonthlySalesReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeDay, setActiveDay] = useState<string | null>(null);

  const fetchReport = useCallback(async (selectedMonth: string) => {
    setIsLoading(true);
    setError("");
    try {
      const response = await api.get("/admin/reports/sales/monthly", { params: { month: selectedMonth } });
      setReport(response.data.data || null);
    } catch (err: any) {
      setReport(null);
      setError(err.response?.data?.error || "Gagal memuat laporan penjualan.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReport(month);
  }, [fetchReport, month]);

  const maxDailyRevenue = useMemo(() => {
    return Math.max(...(report?.daily_sales || []).map((point) => point.revenue), 0);
  }, [report]);

  useEffect(() => {
    const dailySales = report?.daily_sales || [];
    if (!dailySales.length) {
      setActiveDay(null);
      return;
    }
    const bestDay = [...dailySales].sort((a, b) => b.revenue - a.revenue || b.orders - a.orders)[0];
    setActiveDay(bestDay?.label || dailySales[0].label);
  }, [report]);

  const activePoint = useMemo(() => {
    const dailySales = report?.daily_sales || [];
    return dailySales.find((point) => point.label === activeDay) || dailySales[0] || null;
  }, [activeDay, report]);

  const bestPoint = useMemo(() => {
    const dailySales = report?.daily_sales || [];
    return [...dailySales].sort((a, b) => b.revenue - a.revenue || b.orders - a.orders)[0] || null;
  }, [report]);

  const stockSummary = report?.stock_summary || emptyStockSummary;
  const stockReport = report?.stock || emptyStockReport;

  const cards = report ? [
    { label: "Omzet Bulanan", value: formatCurrency(report.summary.revenue), helper: `${report.summary.orders} transaksi sukses`, icon: TrendingUp, tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200" },
    { label: "Item Terjual", value: report.summary.items_sold.toLocaleString("id-ID"), helper: "total kuantitas produk", icon: PackageCheck, tone: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200" },
    { label: "Rata-rata Order", value: formatCurrency(report.summary.average_order), helper: "average order value", icon: ReceiptText, tone: "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-200" },
    { label: "Diskon", value: formatCurrency(report.summary.discount), helper: `${formatCurrency(report.summary.shipping)} ongkir tercatat`, icon: BarChart3, tone: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200" },
  ] : [];
  const stockCards = report ? [
    { label: "Produk Aktif", value: stockSummary.active_products.toLocaleString("id-ID"), helper: `${stockSummary.total_products} total produk`, icon: Boxes, tone: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-200" },
    { label: "Total Stok", value: stockSummary.total_stock_items.toLocaleString("id-ID"), helper: "akumulasi item tersedia", icon: PackageCheck, tone: "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-200" },
    { label: "Stok Menipis", value: stockSummary.low_stock_products.toLocaleString("id-ID"), helper: `${stockSummary.out_of_stock_products} produk habis`, icon: AlertTriangle, tone: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-200" },
    { label: "Nilai Stok", value: formatCurrency(stockSummary.stock_value), helper: "estimasi harga jual stok", icon: ReceiptText, tone: "bg-lime-50 text-lime-700 dark:bg-lime-950/30 dark:text-lime-200" },
  ] : [];

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="mb-1 text-3xl font-extrabold">Laporan Penjualan & Stok</h1>
          <p className="text-sm text-gray-500">Rekap transaksi bulanan dan ketersediaan stok untuk UMKM Abah Orchid Bogor.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold dark:border-gray-800 dark:bg-zinc-900">
            <CalendarDays className="h-4 w-4 text-[var(--color-leaf-600)]" />
            <input
              type="month"
              value={month}
              max={new Date().toISOString().slice(0, 7)}
              onChange={(event) => setMonth(event.target.value)}
              className="bg-transparent text-sm outline-none"
            />
          </label>
          <button onClick={() => void fetchReport(month)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-4 py-3 text-sm font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
            <RefreshCw className="h-4 w-4" /> Tampilkan
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      {isLoading || !report ? (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left">
              <tbody>
                <TableRowsSkeleton columns={7} rows={7} />
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-none dark:border-gray-800 dark:bg-zinc-900">
                <div className={`mb-3 inline-flex rounded-xl p-2.5 ${card.tone}`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <div className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-gray-500">{card.label}</div>
                <div className="text-2xl font-extrabold">{card.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{card.helper}</div>
              </div>
            ))}
          </div>

          <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {stockCards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-none dark:border-gray-800 dark:bg-zinc-900">
                <div className={`mb-3 inline-flex rounded-xl p-2.5 ${card.tone}`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <div className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-gray-500">{card.label}</div>
                <div className="text-2xl font-extrabold">{card.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{card.helper}</div>
              </div>
            ))}
          </div>

          <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-zinc-900">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Tren Harian</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{formatMonth(report.period.month)} berdasarkan order sukses.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => void exportExcel(report, setError)} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-zinc-800">
                    <FileSpreadsheet className="h-4 w-4" /> Excel
                  </button>
                  <button onClick={() => exportPDF(report)} className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-leaf-600)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--color-leaf-700)]">
                    <FileText className="h-4 w-4" /> PDF
                  </button>
                </div>
              </div>
              <SalesLineChart
                activePoint={activePoint}
                bestPoint={bestPoint}
                maxRevenue={maxDailyRevenue}
                points={report.daily_sales}
                onActiveChange={setActiveDay}
              />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-zinc-900">
              <h2 className="mb-1 text-xl font-bold">Produk Terlaris</h2>
              <p className="mb-5 text-sm text-muted-foreground">Diurutkan dari kontribusi kuantitas dan omzet.</p>
              <div className="space-y-3">
                {report.top_products.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-200 p-5 text-center text-sm text-muted-foreground dark:border-gray-800">Belum ada produk terjual pada bulan ini.</p>
                ) : (
                  report.top_products.slice(0, 5).map((product, index) => (
                    <div key={product.product_id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                      <div className="mb-1 text-xs font-bold text-[var(--color-leaf-600)]">#{index + 1}</div>
                      <div className="line-clamp-2 text-sm font-bold">{product.name}</div>
                      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500">
                        <span>{product.quantity} item</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{formatCurrency(product.revenue)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-zinc-900">
              <div className="border-b border-gray-100 p-6 dark:border-gray-800">
                <h2 className="text-xl font-bold">Laporan Stok Produk</h2>
                <p className="mt-1 text-sm text-muted-foreground">Sisa stok, batas minimum, status stok, dan estimasi nilai stok produk.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-zinc-950">
                      <th className="p-4 text-xs font-bold uppercase text-gray-500">Produk</th>
                      <th className="p-4 text-xs font-bold uppercase text-gray-500">Kategori</th>
                      <th className="p-4 text-right text-xs font-bold uppercase text-gray-500">Stok</th>
                      <th className="p-4 text-right text-xs font-bold uppercase text-gray-500">Minimum</th>
                      <th className="p-4 text-xs font-bold uppercase text-gray-500">Status</th>
                      <th className="p-4 text-right text-xs font-bold uppercase text-gray-500">Harga</th>
                      <th className="p-4 text-right text-xs font-bold uppercase text-gray-500">Nilai Stok</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockReport.products.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">Belum ada data stok produk.</td>
                      </tr>
                    ) : (
                      stockReport.products.map((product) => (
                        <tr key={product.product_id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-zinc-950/70">
                          <td className="p-4 text-sm font-bold">{product.name}</td>
                          <td className="p-4 text-sm text-gray-500">{product.category}</td>
                          <td className="p-4 text-right text-sm font-semibold">{product.quantity}</td>
                          <td className="p-4 text-right text-sm text-gray-500">{product.low_stock_threshold}</td>
                          <td className="p-4 text-sm">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${stockStatusClass(product.stock_status)}`}>
                              {product.stock_status}
                            </span>
                          </td>
                          <td className="p-4 text-right text-sm font-semibold">{formatCurrency(product.price)}</td>
                          <td className="p-4 text-right text-sm font-bold">{formatCurrency(product.stock_value)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-zinc-900">
              <h2 className="mb-1 text-xl font-bold">Rekomendasi Restock</h2>
              <p className="mb-5 text-sm text-muted-foreground">Produk yang laku di periode ini dan stoknya sudah menipis atau habis.</p>
              <div className="space-y-3">
                {stockReport.restock_recommendations.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-200 p-5 text-center text-sm text-muted-foreground dark:border-gray-800">Belum ada rekomendasi restock dari data bulan ini.</p>
                ) : (
                  stockReport.restock_recommendations.slice(0, 8).map((product) => (
                    <div key={product.product_id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <div className="line-clamp-2 text-sm font-bold">{product.name}</div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${product.priority === "Tinggi" ? "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-200" : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200"}`}>
                          {product.priority}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500">
                        <span>Sisa {product.quantity} | Terjual {product.sold}</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{formatCurrency(product.revenue)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-zinc-900">
            <div className="flex flex-col gap-3 border-b border-gray-100 p-6 dark:border-gray-800 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-bold">Detail Transaksi</h2>
                <p className="mt-1 text-sm text-muted-foreground">Data siap direkap untuk arsip bulanan.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-zinc-950">
                    <th className="p-4 text-xs font-bold uppercase text-gray-500">Tanggal</th>
                    <th className="p-4 text-xs font-bold uppercase text-gray-500">No. Order</th>
                    <th className="p-4 text-xs font-bold uppercase text-gray-500">Pelanggan</th>
                    <th className="p-4 text-xs font-bold uppercase text-gray-500">Item</th>
                    <th className="p-4 text-xs font-bold uppercase text-gray-500">Status</th>
                    <th className="p-4 text-xs font-bold uppercase text-gray-500">Pembayaran</th>
                    <th className="p-4 text-right text-xs font-bold uppercase text-gray-500">Subtotal</th>
                    <th className="p-4 text-right text-xs font-bold uppercase text-gray-500">Diskon</th>
                    <th className="p-4 text-right text-xs font-bold uppercase text-gray-500">Ongkir</th>
                    <th className="p-4 text-right text-xs font-bold uppercase text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.orders.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-sm text-muted-foreground">Belum ada penjualan sukses pada bulan ini.</td>
                    </tr>
                  ) : (
                    report.orders.map((order) => (
                      <tr key={order.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-zinc-950/70">
                        <td className="p-4 text-sm">{formatDate(order.order_date)}</td>
                        <td className="p-4 text-sm font-bold">{order.order_number}</td>
                        <td className="p-4 text-sm">{order.customer_name}</td>
                        <td className="p-4 text-sm text-gray-500">{order.items.reduce((sum, item) => sum + item.quantity, 0)} item</td>
                        <td className="p-4 text-sm">{STATUS_LABELS[order.status] || order.status}</td>
                        <td className="p-4 text-sm capitalize">{paymentMethodLabel(order.payment_method)}</td>
                        <td className="p-4 text-right text-sm font-semibold">{formatCurrency(order.subtotal)}</td>
                        <td className="p-4 text-right text-sm font-semibold">{formatCurrency(order.discount)}</td>
                        <td className="p-4 text-right text-sm font-semibold">{formatCurrency(order.shipping_cost)}</td>
                        <td className="p-4 text-right text-sm font-bold">{formatCurrency(order.total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SalesLineChart({
  activePoint,
  bestPoint,
  maxRevenue,
  points,
  onActiveChange,
}: {
  activePoint: SalesPoint | null;
  bestPoint: SalesPoint | null;
  maxRevenue: number;
  points: SalesPoint[];
  onActiveChange: (label: string) => void;
}) {
  const width = 720;
  const height = 260;
  const paddingX = 42;
  const paddingY = 28;
  const chartHeight = height - paddingY * 2;
  const chartWidth = width - paddingX * 2;
  const safeMax = Math.max(maxRevenue, 1);

  const chartPoints = points.map((point, index) => {
    const x = points.length <= 1 ? width / 2 : paddingX + (index / (points.length - 1)) * chartWidth;
    const y = height - paddingY - (point.revenue / safeMax) * chartHeight;
    return { ...point, x, y };
  });

  const active = chartPoints.find((point) => point.label === activePoint?.label) || chartPoints[0] || null;
  const path = chartPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const areaPath = chartPoints.length
    ? `${path} L ${chartPoints[chartPoints.length - 1].x.toFixed(2)} ${height - paddingY} L ${chartPoints[0].x.toFixed(2)} ${height - paddingY} Z`
    : "";
  const activeLeft = active ? `${(active.x / width) * 100}%` : "50%";
  const gridRows = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-zinc-950">
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-zinc-900">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Hari aktif</div>
          <div className="mt-2 text-lg font-extrabold">{active ? formatShortDate(active.label) : "-"}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-zinc-900">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Omzet hari itu</div>
          <div className="mt-2 text-lg font-extrabold text-[var(--color-leaf-700)] dark:text-[var(--color-leaf-300)]">{formatCurrency(active?.revenue || 0)}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-zinc-900">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Order</div>
          <div className="mt-2 text-lg font-extrabold">{(active?.orders || 0).toLocaleString("id-ID")} transaksi</div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="font-semibold text-gray-700 dark:text-gray-200">
          {bestPoint && bestPoint.revenue > 0 ? `Puncak penjualan: ${formatShortDate(bestPoint.label)} (${formatCurrency(bestPoint.revenue)})` : "Belum ada omzet di periode ini"}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="h-2 w-2 rounded-full bg-[var(--color-leaf-600)]" />
          <span>Omzet harian</span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-zinc-900">
        {active && (
          <div
            className="pointer-events-none absolute top-4 z-10 -translate-x-1/2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold shadow-lg dark:border-gray-800 dark:bg-zinc-950"
            style={{ left: activeLeft }}
          >
            <div>{formatShortDate(active.label)}</div>
            <div className="mt-1 text-[var(--color-leaf-700)] dark:text-[var(--color-leaf-300)]">{formatCurrency(active.revenue)}</div>
            <div className="mt-0.5 text-gray-500">{active.orders} order</div>
          </div>
        )}

        <svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] w-full" role="img" aria-label="Line chart tren penjualan harian">
          <defs>
            <linearGradient id="salesLineFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgb(22, 163, 74)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="rgb(22, 163, 74)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {gridRows.map((row) => {
            const y = paddingY + row * chartHeight;
            const label = compactCurrency(safeMax * (1 - row));
            return (
              <g key={row}>
                <line x1={paddingX} x2={width - paddingX} y1={y} y2={y} stroke="currentColor" className="text-gray-200 dark:text-gray-800" strokeDasharray="4 6" />
                <text x={paddingX - 8} y={y + 4} textAnchor="end" className="fill-gray-400 text-[10px]">{label}</text>
              </g>
            );
          })}

          {areaPath && <path d={areaPath} fill="url(#salesLineFill)" />}
          {path && <path d={path} fill="none" stroke="rgb(22, 163, 74)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />}

          {active && (
            <line x1={active.x} x2={active.x} y1={paddingY} y2={height - paddingY} stroke="rgb(22, 163, 74)" strokeDasharray="5 7" strokeOpacity="0.45" />
          )}

          {chartPoints.map((point) => {
            const isActive = point.label === active?.label;
            const isBest = point.label === bestPoint?.label && point.revenue > 0;
            return (
              <g key={point.label}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isActive ? 8 : isBest ? 6 : 5}
                  className={isActive ? "fill-white stroke-[var(--color-leaf-600)]" : isBest ? "fill-emerald-500 stroke-white" : "fill-white stroke-gray-300 dark:stroke-gray-600"}
                  strokeWidth={isActive ? 4 : 3}
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="16"
                  fill="transparent"
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer outline-none"
                  onClick={() => onActiveChange(point.label)}
                  onFocus={() => onActiveChange(point.label)}
                  onMouseEnter={() => onActiveChange(point.label)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onActiveChange(point.label);
                    }
                  }}
                />
              </g>
            );
          })}

          {chartPoints.map((point, index) => {
            const shouldShow = index === 0 || index === chartPoints.length - 1 || new Date(point.label).getDate() % 5 === 0;
            if (!shouldShow) return null;
            return (
              <text key={`label-${point.label}`} x={point.x} y={height - 6} textAnchor="middle" className="fill-gray-400 text-[10px] font-semibold">
                {new Date(point.label).getDate()}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function formatCurrency(value: number | string | null | undefined) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

function compactCurrency(value: number) {
  if (value >= 1000000) return `Rp ${(value / 1000000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`;
  if (value >= 1000) return `Rp ${Math.round(value / 1000).toLocaleString("id-ID")}rb`;
  return formatCurrency(value);
}

function formatMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

function paymentMethodLabel(value: string) {
  if (value === "manual_bank_transfer" || value === "bank_transfer") return "Transfer Manual";
  return value?.replace(/_/g, " ") || "-";
}

function stockStatusClass(status: string) {
  switch (status) {
    case "Stok Habis":
      return "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-200";
    case "Stok Menipis":
      return "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200";
    default:
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200";
  }
}

function stockStatus(quantity: number, threshold: number) {
  if (quantity <= 0) return "Stok Habis";
  if (threshold > 0 && quantity <= threshold) return "Stok Menipis";
  return "Stok Aman";
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function reportRows(report: MonthlySalesReport) {
  return report.orders.map((order) => [
    formatDate(order.order_date),
    order.order_number,
    order.customer_name,
    order.items.map((item) => `${item.product_name} (${item.quantity})`).join(", "),
    STATUS_LABELS[order.status] || order.status,
    paymentMethodLabel(order.payment_method),
    formatCurrency(order.subtotal),
    formatCurrency(order.discount),
    formatCurrency(order.shipping_cost),
    formatCurrency(order.total),
  ]);
}

async function exportExcel(report: MonthlySalesReport, onError?: (message: string) => void) {
  let stockReport = report.stock || emptyStockReport;
  try {
    stockReport = await resolveExportStockReport(report);
  } catch {
    onError?.("Gagal memuat data stok terbaru untuk export. Export tetap memakai data laporan yang tersedia.");
  }
  const stockSummary = buildStockSummary(stockReport.products);
  const stockSummaryRows = buildStockSummaryRows(stockSummary);
  const stockProductRows = stockReport.products.length > 0
    ? stockReport.products.map((product) => [product.name, product.category, product.quantity, product.low_stock_threshold, product.stock_status, formatCurrency(product.price), formatCurrency(product.stock_value)])
    : [["Belum ada data stok produk", "-", "-", "-", "-", "-", "-"]];
  const restockRows = stockReport.restock_recommendations.length > 0
    ? stockReport.restock_recommendations.map((product) => [product.name, product.quantity, product.sold, formatCurrency(product.revenue), product.priority])
    : [["Tidak ada produk yang perlu direstock", "-", "-", "-", "Stok Aman"]];
  const workbook = createXlsxWorkbook([
    {
      name: "Ringkasan",
      rows: [
        ["Laporan Penjualan dan Stok Abah Orchid Bogor"],
        ["Periode", formatMonth(report.period.month)],
        [],
        ["Ringkasan Penjualan", ""],
        ["Omzet", formatCurrency(report.summary.revenue)],
        ["Order Sukses", report.summary.orders],
        ["Item Terjual", report.summary.items_sold],
        ["Rata-rata Order", formatCurrency(report.summary.average_order)],
        ["Diskon", formatCurrency(report.summary.discount)],
        ["Ongkir", formatCurrency(report.summary.shipping)],
        [],
        ["Ringkasan Stok Real", "Dihitung dari sheet Stok Produk"],
        ...stockSummaryRows,
      ],
    },
    {
      name: "Penjualan",
      rows: [
        ["Tanggal", "No. Order", "Pelanggan", "Item", "Status", "Pembayaran", "Subtotal", "Diskon", "Ongkir", "Total"],
        ...reportRows(report),
      ],
    },
    {
      name: "Produk Terlaris",
      rows: [
        ["Peringkat", "Nama Produk", "Jumlah Terjual", "Total Penjualan"],
        ...report.top_products.map((product, index) => [index + 1, product.name, product.quantity, formatCurrency(product.revenue)]),
      ],
    },
    {
      name: "Stok Produk",
      rows: [
        ["Nama Produk", "Kategori", "Stok Saat Ini", "Batas Minimum", "Status Stok", "Harga Produk", "Estimasi Nilai Stok"],
        ...stockProductRows,
      ],
    },
    {
      name: "Rekomendasi Restock",
      rows: [
        ["Nama Produk", "Sisa Stok", "Terjual", "Total Penjualan", "Prioritas"],
        ...restockRows,
      ],
    },
  ]);
  downloadBlob(workbook, `laporan-orchidmart-${report.period.month}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

async function resolveExportStockReport(report: MonthlySalesReport): Promise<MonthlySalesReport["stock"]> {
  const currentStock = report.stock || emptyStockReport;
  if (currentStock.products.length > 0) {
    return {
      products: currentStock.products,
      restock_recommendations: currentStock.restock_recommendations.length > 0
        ? currentStock.restock_recommendations
        : buildRestockRecommendations(currentStock.products, report.top_products),
    };
  }

  const response = await api.get("/admin/inventory");
  const products = normalizeInventoryProducts(response.data?.data || []);
  return {
    products,
    restock_recommendations: buildRestockRecommendations(products, report.top_products),
  };
}

function normalizeInventoryProducts(products: AdminInventoryProduct[]): ReportStockProduct[] {
  return products.map((product) => {
    const quantity = Number(product.inventory?.quantity || 0);
    const threshold = Number(product.inventory?.low_stock_threshold || 0);
    const price = Number(product.price || 0);
    return {
      product_id: product.id,
      name: product.name,
      category: product.category?.name || "-",
      quantity,
      low_stock_threshold: threshold,
      stock_status: stockStatus(quantity, threshold),
      price,
      stock_value: quantity * price,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "id-ID"));
}

function buildRestockRecommendations(products: ReportStockProduct[], topProducts: TopProduct[]): RestockRecommendation[] {
  const salesByProduct = new Map(topProducts.map((product) => [product.product_id, product]));
  return products
    .filter((product) => product.stock_status === "Stok Menipis" || product.stock_status === "Stok Habis")
    .map((product) => {
      const sales = salesByProduct.get(product.product_id);
      const sold = sales?.quantity || 0;
      return {
        product_id: product.product_id,
        name: product.name,
        quantity: product.quantity,
        sold,
        revenue: sales?.revenue || 0,
        priority: product.stock_status === "Stok Habis" || sold >= Math.max(product.low_stock_threshold, 1) * 2 ? "Tinggi" : "Sedang",
      };
    })
    .sort((a, b) => (a.priority === b.priority ? a.quantity - b.quantity : a.priority === "Tinggi" ? -1 : 1));
}

function buildStockSummary(products: ReportStockProduct[]): MonthlySalesReport["stock_summary"] {
  return products.reduce<MonthlySalesReport["stock_summary"]>((summary, product) => {
    summary.total_products += 1;
    summary.active_products += product.stock_status !== "Stok Habis" ? 1 : 0;
    summary.total_stock_items += product.quantity;
    summary.stock_value += product.stock_value;
    if (product.stock_status === "Stok Menipis") summary.low_stock_products += 1;
    if (product.stock_status === "Stok Habis") summary.out_of_stock_products += 1;
    return summary;
  }, { ...emptyStockSummary });
}

function buildStockSummaryRows(summary: MonthlySalesReport["stock_summary"]): Array<Array<string | number>> {
  const stockRisk = summary.low_stock_products + summary.out_of_stock_products;
  const safeProducts = Math.max(summary.total_products - stockRisk, 0);
  return [
    ["Total Produk Tercatat", summary.total_products],
    ["Produk Dengan Stok Tersedia", summary.active_products],
    ["Produk Stok Aman", safeProducts],
    ["Produk Stok Menipis", summary.low_stock_products],
    ["Produk Stok Habis", summary.out_of_stock_products],
    ["Total Item Stok Tersedia", summary.total_stock_items],
    ["Estimasi Nilai Stok", formatCurrency(summary.stock_value)],
    ["Kesimpulan Stok", stockRisk > 0 ? `${stockRisk} produk perlu dipantau/restock` : "Semua produk berada pada status stok aman"],
  ];
}

type XlsxSheet = {
  name: string;
  rows: Array<Array<string | number>>;
};

function createXlsxWorkbook(sheets: XlsxSheet[]) {
  const files = [
    {
      path: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
    },
    {
      path: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      path: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, index) => `<sheet name="${escapeHtml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`,
    },
    {
      path: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    {
      path: "xl/styles.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE5F4EA"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`,
    },
    ...sheets.map((sheet, index) => ({
      path: `xl/worksheets/sheet${index + 1}.xml`,
      content: xlsxWorksheet(sheet.rows),
    })),
  ];
  return zipFiles(files);
}

function xlsxWorksheet(rows: Array<Array<string | number>>) {
  const maxColumns = Math.max(...rows.map((row) => row.length), 1);
  const columns = Array.from({ length: maxColumns }, (_, index) => `<col min="${index + 1}" max="${index + 1}" width="${index === 0 ? 28 : 18}" customWidth="1"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${columns}</cols><sheetData>${rows.map((row, rowIndex) => xlsxRow(row, rowIndex + 1)).join("")}</sheetData></worksheet>`;
}

function xlsxRow(row: Array<string | number>, rowNumber: number) {
  const isHeader = rowNumber === 1;
  return `<row r="${rowNumber}">${row.map((cell, columnIndex) => xlsxCell(cell, rowNumber, columnIndex, isHeader)).join("")}</row>`;
}

function xlsxCell(value: string | number, rowNumber: number, columnIndex: number, isHeader: boolean) {
  const cellRef = `${columnName(columnIndex + 1)}${rowNumber}`;
  const style = isHeader ? ' s="1"' : "";
  if (typeof value === "number") {
    return `<c r="${cellRef}"${style}><v>${value}</v></c>`;
  }
  return `<c r="${cellRef}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeHtml(value)}</t></is></c>`;
}

function columnName(index: number) {
  let name = "";
  while (index > 0) {
    const remainder = (index - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    index = Math.floor((index - 1) / 26);
  }
  return name;
}

function zipFiles(files: Array<{ path: string; content: string }>) {
  const encoder = new TextEncoder();
  const fileRecords: Uint8Array[] = [];
  const centralRecords: Uint8Array[] = [];
  let offset = 0;
  const now = new Date();
  const time = ((now.getHours() & 31) << 11) | ((now.getMinutes() & 63) << 5) | Math.floor(now.getSeconds() / 2);
  const date = (((now.getFullYear() - 1980) & 127) << 9) | (((now.getMonth() + 1) & 15) << 5) | (now.getDate() & 31);

  for (const file of files) {
    const name = encoder.encode(file.path);
    const content = encoder.encode(file.content);
    const crc = crc32(content);
    const localHeader = zipHeader(30, [
      [0, 0x04034b50, 4],
      [4, 20, 2],
      [6, 0x0800, 2],
      [8, 0, 2],
      [10, time, 2],
      [12, date, 2],
      [14, crc, 4],
      [18, content.length, 4],
      [22, content.length, 4],
      [26, name.length, 2],
      [28, 0, 2],
    ]);
    const localRecord = concatBytes([localHeader, name, content]);
    fileRecords.push(localRecord);

    const centralHeader = zipHeader(46, [
      [0, 0x02014b50, 4],
      [4, 20, 2],
      [6, 20, 2],
      [8, 0x0800, 2],
      [10, 0, 2],
      [12, time, 2],
      [14, date, 2],
      [16, crc, 4],
      [20, content.length, 4],
      [24, content.length, 4],
      [28, name.length, 2],
      [30, 0, 2],
      [32, 0, 2],
      [34, 0, 2],
      [36, 0, 2],
      [38, 0, 4],
      [42, offset, 4],
    ]);
    centralRecords.push(concatBytes([centralHeader, name]));
    offset += localRecord.length;
  }

  const centralDirectory = concatBytes(centralRecords);
  const endRecord = zipHeader(22, [
    [0, 0x06054b50, 4],
    [4, 0, 2],
    [6, 0, 2],
    [8, files.length, 2],
    [10, files.length, 2],
    [12, centralDirectory.length, 4],
    [16, offset, 4],
    [20, 0, 2],
  ]);

  return new Blob([concatBytes([...fileRecords, centralDirectory, endRecord])], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function zipHeader(length: number, fields: Array<[number, number, 2 | 4]>) {
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  for (const [offset, value, size] of fields) {
    if (size === 2) view.setUint16(offset, value, true);
    else view.setUint32(offset, value >>> 0, true);
  }
  return new Uint8Array(buffer);
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ crc32Table[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const crc32Table = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function exportPDF(report: MonthlySalesReport) {
  const rows = reportRows(report);
  const stockSummary = report.stock_summary || emptyStockSummary;
  const stockReport = report.stock || emptyStockReport;
  const doc = window.open("", "_blank");
  if (!doc) return;
  doc.opener = null;
  doc.document.write(`
    <html>
      <head>
        <title>Laporan Penjualan ${escapeHtml(report.period.month)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; margin: 28px; }
          h1 { margin: 0 0 4px; font-size: 22px; }
          p { margin: 0 0 16px; color: #4b5563; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0; }
          .box { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; }
          .label { color: #6b7280; font-size: 11px; text-transform: uppercase; }
          .value { font-weight: 700; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
          th, td { border: 1px solid #d1d5db; padding: 7px; text-align: left; vertical-align: top; }
          th { background: #f3f4f6; }
          .right { text-align: right; }
          @media print { button { display: none; } body { margin: 12mm; } }
        </style>
      </head>
      <body>
        <button onclick="window.print()" style="margin-bottom:16px;padding:9px 14px;border-radius:8px;border:1px solid #d1d5db;background:white;font-weight:700;">Cetak / Simpan PDF</button>
        <h1>Laporan Penjualan dan Stok OrchidMart</h1>
        <p>Periode ${escapeHtml(formatMonth(report.period.month))} (${escapeHtml(report.period.start_date)} sampai ${escapeHtml(report.period.end_date)})</p>
        <div class="summary">
          <div class="box"><div class="label">Omzet</div><div class="value">${escapeHtml(formatCurrency(report.summary.revenue))}</div></div>
          <div class="box"><div class="label">Order</div><div class="value">${report.summary.orders}</div></div>
          <div class="box"><div class="label">Item Terjual</div><div class="value">${report.summary.items_sold}</div></div>
          <div class="box"><div class="label">Rata-rata Order</div><div class="value">${escapeHtml(formatCurrency(report.summary.average_order))}</div></div>
          <div class="box"><div class="label">Produk Aktif</div><div class="value">${stockSummary.active_products}</div></div>
          <div class="box"><div class="label">Total Stok</div><div class="value">${stockSummary.total_stock_items}</div></div>
          <div class="box"><div class="label">Stok Menipis</div><div class="value">${stockSummary.low_stock_products}</div></div>
          <div class="box"><div class="label">Nilai Stok</div><div class="value">${escapeHtml(formatCurrency(stockSummary.stock_value))}</div></div>
        </div>
        <h2>Detail Penjualan</h2>
        <table>
          <thead><tr>${["Tanggal", "No. Order", "Pelanggan", "Item", "Status", "Pembayaran", "Subtotal", "Diskon", "Ongkir", "Total"].map((head) => `<th>${escapeHtml(head)}</th>`).join("")}</tr></thead>
          <tbody>
            ${rows.map((row) => `<tr>${row.map((cell, index) => `<td class="${index >= 6 ? "right" : ""}">${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
        <h2>Stok Produk</h2>
        <table>
          <thead><tr>${["Produk", "Kategori", "Stok", "Minimum", "Status", "Harga", "Nilai Stok"].map((head) => `<th>${escapeHtml(head)}</th>`).join("")}</tr></thead>
          <tbody>
            ${stockReport.products.map((product) => `<tr>${[
              product.name,
              product.category,
              String(product.quantity),
              String(product.low_stock_threshold),
              product.stock_status,
              formatCurrency(product.price),
              formatCurrency(product.stock_value),
            ].map((cell, index) => `<td class="${index === 2 || index === 3 || index === 5 || index === 6 ? "right" : ""}">${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
        <h2>Rekomendasi Restock</h2>
        <table>
          <thead><tr>${["Produk", "Sisa Stok", "Terjual", "Total Penjualan", "Prioritas"].map((head) => `<th>${escapeHtml(head)}</th>`).join("")}</tr></thead>
          <tbody>
            ${stockReport.restock_recommendations.length === 0
              ? `<tr><td colspan="5">Belum ada rekomendasi restock dari data bulan ini.</td></tr>`
              : stockReport.restock_recommendations.map((product) => `<tr>${[
                product.name,
                String(product.quantity),
                String(product.sold),
                formatCurrency(product.revenue),
                product.priority,
              ].map((cell, index) => `<td class="${index === 1 || index === 2 || index === 3 ? "right" : ""}">${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </body>
    </html>
  `);
  doc.document.close();
}

function downloadBlob(content: string | Blob, filename: string, type: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
