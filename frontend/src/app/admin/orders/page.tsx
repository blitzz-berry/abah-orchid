"use client";

import { useEffect, useState } from "react";
import { CheckCircle, ExternalLink, Eye, FileText, Package, RotateCcw, Search, Truck, X } from "lucide-react";
import { motion } from "framer-motion";
import api from "@/lib/api";
import { onRealtimeEvent } from "@/lib/realtime";
import { createAuthorizedUploadObjectURL, openUploadURL, resolveUploadURL } from "@/lib/uploads";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableRowsSkeleton } from "@/components/ui/loading";
import { cn } from "@/lib/utils";

const STATUSES = ["PENDING_PAYMENT", "PAID", "PROCESSING", "CANCELLATION_REQUESTED", "SHIPPED", "DELIVERED", "COMPLETED", "RETURN_REQUESTED", "RETURN_APPROVED", "REFUNDED", "CANCELLED"];
const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Menunggu Bayar",
  PAID: "Dibayar",
  PROCESSING: "Diproses",
  CANCELLATION_REQUESTED: "Permintaan Batal",
  SHIPPED: "Dikirim",
  DELIVERED: "Diterima",
  COMPLETED: "Selesai",
  RETURN_REQUESTED: "Pengajuan Retur",
  RETURN_APPROVED: "Retur Disetujui",
  REFUNDED: "Refund Selesai",
  CANCELLED: "Batal",
};
const STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
  PAID: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200",
  PROCESSING: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-900 dark:bg-fuchsia-950/30 dark:text-fuchsia-200",
  CANCELLATION_REQUESTED: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200",
  SHIPPED: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-200",
  DELIVERED: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
  COMPLETED: "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200",
  RETURN_REQUESTED: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200",
  RETURN_APPROVED: "border-lime-200 bg-lime-50 text-lime-700 dark:border-lime-900 dark:bg-lime-950/30 dark:text-lime-200",
  REFUNDED: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-200",
  CANCELLED: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [quickFilter, setQuickFilter] = useState<"all" | "cancellation" | "return" | "refund" | "manual">("all");
  const [focusOrderID, setFocusOrderID] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [proofPreview, setProofPreview] = useState<{ url: string; sourceURL: string; objectURL?: string; orderNumber: string; payment: any } | null>(null);
  const [trackingInput, setTrackingInput] = useState("");
  const [refundTarget, setRefundTarget] = useState<any>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);
  const [detailOrder, setDetailOrder] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelAction, setCancelAction] = useState<"cancel" | "approve" | "reject">("cancel");
  const [isSubmittingCancelAction, setIsSubmittingCancelAction] = useState(false);
  const [returnTarget, setReturnTarget] = useState<any>(null);
  const [returnDecisionReason, setReturnDecisionReason] = useState("");
  const [returnAction, setReturnAction] = useState<"approve" | "reject">("approve");
  const [isSubmittingReturnAction, setIsSubmittingReturnAction] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await api.get("/admin/orders");
        setOrders(response.data.data || []);
      } catch {
        setOrders([]);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchOrders();
  }, []);

  useEffect(() => {
    return onRealtimeEvent((event) => {
      if (event.type !== "order.changed" && event.type !== "payment.changed") return;
      void api.get("/admin/orders").then((response) => {
        setOrders(response.data.data || []);
      }).catch(() => undefined);
      if (detailOrder?.id && detailOrder.id === event.order_id) {
        void api.get(`/admin/orders/${detailOrder.id}`).then((response) => {
          setDetailOrder(response.data.data || null);
        }).catch(() => undefined);
      }
    });
  }, [detailOrder?.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const focus = params.get("focus");
    if (status && STATUSES.includes(status)) {
      setFilterStatus(status);
      if (status === "CANCELLATION_REQUESTED") {
        setQuickFilter("cancellation");
      } else if (status === "RETURN_REQUESTED" || status === "RETURN_APPROVED") {
        setQuickFilter("return");
      } else if (status === "REFUNDED") {
        setQuickFilter("refund");
      }
    }
    if (focus) {
      setFocusOrderID(focus);
    }
  }, []);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await api.put(`/admin/orders/${id}/status`, { status });
      setOrders((prev) => prev.map((order) => order.id === id ? { ...order, status } : order));
    } catch (e: any) {
      alert("Gagal: " + (e.response?.data?.error || e.message));
    }
  };

  const handleConfirmPayment = async (id: string) => {
    try {
      await api.post(`/admin/orders/${id}/confirm-payment`);
      setOrders((prev) => prev.map((order) => order.id === id ? {
        ...order,
        status: "PAID",
        payments: order.payments?.map((payment: any) => ({ ...payment, status: "PAID" })) || order.payments,
      } : order));
    } catch (e: any) {
      alert("Gagal: " + (e.response?.data?.error || e.message));
    }
  };

  const handleInputTracking = async () => {
    if (!selected || !trackingInput.trim()) return;
    try {
      await api.put(`/admin/orders/${selected.id}/tracking`, { tracking_number: trackingInput.trim() });
      setOrders((prev) => prev.map((order) => order.id === selected.id ? { ...order, tracking_number: trackingInput.trim(), status: "SHIPPED" } : order));
      setTrackingInput("");
      setSelected(null);
    } catch (e: any) {
      alert("Gagal: " + (e.response?.data?.error || e.message));
    }
  };

  const handleOpenRefund = (order: any) => {
    setRefundTarget(order);
    setRefundReason(order.return_reason || order.refund_reason || "");
    setRefundAmount(order.refund_amount ? String(order.refund_amount) : String(order.total || ""));
  };

  const openReturnDecisionDialog = (order: any, action: "approve" | "reject") => {
    setReturnTarget(order);
    setReturnAction(action);
    setReturnDecisionReason(action === "approve" ? (order.return_reason || "") : "");
  };

  const openCancelDialog = (order: any, action: "cancel" | "approve" | "reject") => {
    setCancelTarget(order);
    setCancelAction(action);
    setCancelReason(action === "approve" ? (order.cancellation_reason || "") : "");
  };

  const handleResolveReturn = async (order: any) => {
    try {
      await api.put(`/admin/orders/${order.id}/status`, { status: "COMPLETED" });
      setOrders((prev) => prev.map((item) => item.id === order.id ? { ...item, status: "COMPLETED" } : item));
    } catch (e: any) {
      alert("Gagal menyelesaikan retur: " + (e.response?.data?.error || e.message));
    }
  };

  const handleSubmitReturnDecision = async () => {
    if (!returnTarget || isSubmittingReturnAction) return;
    const reason = returnDecisionReason.trim();
    if (!reason) {
      alert("Alasan wajib diisi.");
      return;
    }

    const endpoint = returnAction === "approve"
      ? `/admin/orders/${returnTarget.id}/approve-return`
      : `/admin/orders/${returnTarget.id}/reject-return`;

    setIsSubmittingReturnAction(true);
    try {
      const response = await api.post(endpoint, { reason });
      const nextStatus = response.data.data?.status;
      if (nextStatus) {
        setOrders((prev) => prev.map((order) => order.id === returnTarget.id ? {
          ...order,
          status: nextStatus,
          return_reason: order.return_reason || reason,
          return_rejected_reason: returnAction === "reject" ? reason : order.return_rejected_reason,
          return_approved_at: returnAction === "approve" ? new Date().toISOString() : order.return_approved_at,
        } : order));
      }
      setReturnTarget(null);
      setReturnDecisionReason("");
    } catch (e: any) {
      alert("Gagal memproses retur: " + (e.response?.data?.error || e.message));
    } finally {
      setIsSubmittingReturnAction(false);
    }
  };

  const handleRefundOrder = async () => {
    if (!refundTarget || isRefunding) return;
    const reason = refundReason.trim();
    const amount = Number(refundAmount);

    if (!reason) {
      alert("Alasan refund wajib diisi.");
      return;
    }

    if (!Number.isFinite(amount) || amount < 0) {
      alert("Nominal refund tidak valid.");
      return;
    }

    setIsRefunding(true);
    try {
      await api.post(`/admin/orders/${refundTarget.id}/refund`, { reason, amount });
      setOrders((prev) => prev.map((order) => order.id === refundTarget.id ? {
        ...order,
        status: "REFUNDED",
        refund_reason: reason,
        refund_amount: amount,
        payments: order.payments?.map((payment: any) => ({ ...payment, status: "REFUNDED" })) || order.payments,
      } : order));
      setRefundTarget(null);
      setRefundReason("");
      setRefundAmount("");
    } catch (e: any) {
      alert("Gagal memproses refund: " + (e.response?.data?.error || e.message));
    } finally {
      setIsRefunding(false);
    }
  };

  const handleSubmitCancelAction = async () => {
    if (!cancelTarget || isSubmittingCancelAction) return;
    const reason = cancelReason.trim();
    if (!reason) {
      alert("Alasan wajib diisi.");
      return;
    }

    const endpoint = cancelAction === "approve"
      ? `/admin/orders/${cancelTarget.id}/approve-cancel`
      : cancelAction === "reject"
        ? `/admin/orders/${cancelTarget.id}/reject-cancel`
        : `/admin/orders/${cancelTarget.id}/cancel`;

    setIsSubmittingCancelAction(true);
    try {
      const response = await api.post(endpoint, { reason });
      const nextStatus = response.data.data?.status;
      if (nextStatus) {
        setOrders((prev) => prev.map((order) => order.id === cancelTarget.id ? {
          ...order,
          status: nextStatus,
          cancellation_reason: cancelAction === "reject" ? order.cancellation_reason : reason,
          cancellation_rejected_reason: cancelAction === "reject" ? reason : order.cancellation_rejected_reason,
          refund_reason: nextStatus === "REFUNDED" ? reason : order.refund_reason,
          refund_amount: nextStatus === "REFUNDED" ? order.total : order.refund_amount,
        } : order));
      }
      setCancelTarget(null);
      setCancelReason("");
    } catch (e: any) {
      alert("Gagal memproses pembatalan: " + (e.response?.data?.error || e.message));
    } finally {
      setIsSubmittingCancelAction(false);
    }
  };

  const closeProofPreview = () => {
    if (proofPreview?.objectURL) URL.revokeObjectURL(proofPreview.objectURL);
    setProofPreview(null);
  };

  const handlePreviewProof = async (sourceURL: string, orderNumber: string, payment: any) => {
    try {
      if (proofPreview?.objectURL) URL.revokeObjectURL(proofPreview.objectURL);
      const url = await createAuthorizedUploadObjectURL(sourceURL);
      setProofPreview({ url, sourceURL, objectURL: url.startsWith("blob:") ? url : undefined, orderNumber, payment });
    } catch (e: any) {
      alert("Gagal membuka bukti: " + (e.response?.data?.error || e.message));
    }
  };

  const handleOpenDetail = async (orderID: string) => {
    setDetailLoading(true);
    try {
      const response = await api.get(`/admin/orders/${orderID}`);
      setDetailOrder(response.data.data || null);
    } catch (e: any) {
      alert("Gagal memuat detail pesanan: " + (e.response?.data?.error || e.message));
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!focusOrderID) return;
    void handleOpenDetail(focusOrderID);
    setFocusOrderID(null);
  }, [focusOrderID]);

  const filtered = orders.filter((order) => {
    if (filterStatus !== "all" && order.status !== filterStatus) return false;
    const payment = order.payments?.[0] || order.payment || null;
    const isManualTransfer = payment?.method === "manual_bank_transfer" || payment?.method === "bank_transfer";
    if (quickFilter === "cancellation" && order.status !== "CANCELLATION_REQUESTED") return false;
    if (quickFilter === "return" && order.status !== "RETURN_REQUESTED" && order.status !== "RETURN_APPROVED") return false;
    if (quickFilter === "refund" && order.status !== "REFUNDED") return false;
    if (quickFilter === "manual" && !isManualTransfer) return false;
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    return order.order_number?.toLowerCase().includes(keyword) || order.shipping_name?.toLowerCase().includes(keyword);
  });

  const filteredPendingCancellation = filtered.filter((order) => order.status === "CANCELLATION_REQUESTED").length;
  const filteredPendingReturn = filtered.filter((order) => order.status === "RETURN_REQUESTED" || order.status === "RETURN_APPROVED").length;
  const filteredManualPayments = filtered.filter((order) => {
    const payment = order.payments?.[0] || order.payment || null;
    return payment?.method === "manual_bank_transfer" || payment?.method === "bank_transfer";
  }).length;
  const filteredRevenue = filtered.reduce((sum, order) => sum + Number(order.total || 0), 0);

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold mb-1">Manajemen Pesanan</h1>
        <p className="text-muted-foreground text-sm">Kelola pembayaran, status proses, resi, dan pengiriman pelanggan.</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          { label: "Pesanan Tampil", value: filtered.length, helper: "setelah filter aktif", icon: Package, tone: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
          { label: "Perlu Review Batal", value: filteredPendingCancellation, helper: "menunggu keputusan admin", icon: RotateCcw, tone: "text-rose-600 bg-rose-50 dark:bg-rose-900/20" },
          { label: "Retur / Refund", value: filteredPendingReturn, helper: "retur aktif di daftar ini", icon: CheckCircle, tone: "text-orange-600 bg-orange-50 dark:bg-orange-900/20" },
          { label: "Nilai Order", value: `Rp ${filteredRevenue.toLocaleString("id-ID")}`, helper: `${filteredManualPayments} pembayaran manual`, icon: FileText, tone: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-zinc-900">
            <div className={`mb-3 inline-flex rounded-xl p-2.5 ${item.tone}`}>
              <item.icon className="h-4 w-4" />
            </div>
            <div className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-gray-500">{item.label}</div>
            <div className="text-lg font-extrabold">{item.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{item.helper}</div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-zinc-900">
        <div className="border-b border-gray-100 p-6 dark:border-gray-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold">Daftar Pesanan</h2>
              <p className="mt-1 text-sm text-muted-foreground">Gunakan filter cepat untuk fokus ke pembatalan, retur, refund, atau pembayaran manual.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative w-full sm:w-72">
                <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari order/nama..." className="pl-9" />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  {STATUSES.map((status) => <SelectItem key={status} value={status}>{STATUS_LABELS[status] || status}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "all", label: "Semua" },
              { value: "cancellation", label: "Pembatalan" },
              { value: "return", label: "Retur" },
              { value: "refund", label: "Refund" },
              { value: "manual", label: "Pembayaran Manual" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setQuickFilter(item.value as "all" | "cancellation" | "return" | "refund" | "manual")}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  quickFilter === item.value
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "border border-gray-200 bg-white text-muted-foreground hover:bg-gray-50 dark:border-gray-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-zinc-950">
                <th className="p-4 text-xs font-bold uppercase text-gray-500">Order</th>
                <th className="p-4 text-xs font-bold uppercase text-gray-500">Pelanggan</th>
                <th className="p-4 text-xs font-bold uppercase text-gray-500">Total</th>
                <th className="p-4 text-xs font-bold uppercase text-gray-500">Status</th>
                <th className="p-4 text-xs font-bold uppercase text-gray-500">Pembayaran</th>
                <th className="p-4 text-xs font-bold uppercase text-gray-500">Tanggal</th>
                <th className="p-4 text-right text-xs font-bold uppercase text-gray-500">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableRowsSkeleton columns={7} rows={6} />
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-sm text-gray-500">Tidak ada pesanan</td></tr>
              ) : filtered.map((order) => {
                const payment = order.payments?.[0] || order.payment || null;
                const proofURL = payment?.proof_image_url ? resolveUploadURL(payment.proof_image_url) : "";
                const isManualTransfer = payment?.method === "manual_bank_transfer" || payment?.method === "bank_transfer";

                return (
                  <motion.tr key={order.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-gray-100 align-top transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-zinc-900/50">
                    <td className="p-4">
                      <div className="font-bold text-sm">{order.order_number}</div>
                      <div className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString("id-ID")}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-medium">{order.shipping_name || order.user?.full_name}</div>
                      <div className="text-xs text-gray-500">{order.shipping_phone}</div>
                    </td>
                    <td className="p-4 text-sm font-semibold">Rp {order.total?.toLocaleString("id-ID")}</td>
                    <td className="p-4">
                      <Badge variant="outline" className={cn("font-semibold", STATUS_STYLES[order.status])}>{STATUS_LABELS[order.status] || order.status}</Badge>
                    </td>
                    <td className="p-4">
                      {payment ? (
                        <div className="space-y-1 text-xs">
                          <div className="font-semibold">{paymentMethodLabel(payment.method)}</div>
                          <div className="text-gray-500">{paymentStatusLabel(payment.status)}</div>
                          {order.cancellation_reason && <div className="text-rose-600 dark:text-rose-300">Alasan batal: {order.cancellation_reason}</div>}
                          {order.cancellation_rejected_reason && <div className="text-slate-600 dark:text-slate-300">Catatan penolakan: {order.cancellation_rejected_reason}</div>}
                          {order.return_reason && <div className="text-orange-600 dark:text-orange-300">Alasan retur: {order.return_reason}</div>}
                          {order.return_rejected_reason && <div className="text-slate-600 dark:text-slate-300">Catatan retur ditolak: {order.return_rejected_reason}</div>}
                          {order.refund_reason && <div className="text-slate-600 dark:text-slate-300">Alasan refund: {order.refund_reason}</div>}
                          {proofURL ? (
                            <button type="button" onClick={() => void handlePreviewProof(proofURL, order.order_number, payment)} className="inline-flex items-center gap-1 rounded-lg px-0 py-0 font-bold text-[var(--color-brand-600)] hover:underline">
                              <Eye className="h-3.5 w-3.5" /> Lihat bukti
                            </button>
                          ) : isManualTransfer ? (
                            <div className="text-amber-600">Menunggu unggah bukti</div>
                          ) : (
                            <div className="text-gray-500">Belum ada bukti</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">Belum ada data</span>
                      )}
                    </td>
                    <td className="p-4 text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString("id-ID")}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button onClick={() => void handleOpenDetail(order.id)} className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-200 dark:hover:bg-zinc-700">Detail</button>
                        {order.status === "PENDING_PAYMENT" && <button onClick={() => openCancelDialog(order, "cancel")} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100 dark:bg-red-500/10">Batalkan</button>}
                        {order.status === "PAID" && <button onClick={() => handleUpdateStatus(order.id, "PROCESSING")} className="rounded-xl bg-[var(--color-leaf-50)] px-3 py-2 text-xs font-bold text-[var(--color-leaf-700)] hover:bg-[var(--color-leaf-100)]">Proses</button>}
                        {(order.status === "PAID" || order.status === "PROCESSING") && <button onClick={() => openCancelDialog(order, "cancel")} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100 dark:bg-red-500/10">Batalkan</button>}
                        {order.status === "PROCESSING" && <button onClick={() => { setSelected(order); setTrackingInput(""); }} className="inline-flex items-center gap-1 rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-200 dark:hover:bg-zinc-700"><Truck className="h-3.5 w-3.5" /> Resi</button>}
                        {order.status === "SHIPPED" && <button onClick={() => handleUpdateStatus(order.id, "DELIVERED")} className="rounded-xl bg-[var(--color-leaf-50)] px-3 py-2 text-xs font-bold text-[var(--color-leaf-700)] hover:bg-[var(--color-leaf-100)]">Tandai Diterima</button>}
                        {order.status === "PENDING_PAYMENT" && payment?.status === "WAITING_CONFIRMATION" && <button onClick={() => handleConfirmPayment(order.id)} className="inline-flex items-center gap-1 rounded-xl bg-[var(--color-leaf-600)] px-3 py-2 text-xs font-bold text-white"><CheckCircle className="h-3.5 w-3.5" /> Konfirmasi</button>}
                        {order.status === "CANCELLATION_REQUESTED" && <button onClick={() => openCancelDialog(order, "approve")} className="rounded-xl bg-[var(--color-leaf-50)] px-3 py-2 text-xs font-bold text-[var(--color-leaf-700)] hover:bg-[var(--color-leaf-100)]">Setujui Batal</button>}
                        {order.status === "CANCELLATION_REQUESTED" && <button onClick={() => openCancelDialog(order, "reject")} className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-200 dark:hover:bg-zinc-700">Tolak</button>}
                        {order.status === "RETURN_REQUESTED" && <button onClick={() => openReturnDecisionDialog(order, "approve")} className="inline-flex items-center gap-1 rounded-xl bg-[var(--color-leaf-50)] px-3 py-2 text-xs font-bold text-[var(--color-leaf-700)] hover:bg-[var(--color-leaf-100)]"><RotateCcw className="h-3.5 w-3.5" /> Setujui Retur</button>}
                        {order.status === "RETURN_REQUESTED" && <button onClick={() => openReturnDecisionDialog(order, "reject")} className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-200 dark:hover:bg-zinc-700">Tolak Retur</button>}
                        {order.status === "RETURN_APPROVED" && <button onClick={() => handleOpenRefund(order)} className="inline-flex items-center gap-1 rounded-xl bg-[var(--color-leaf-50)] px-3 py-2 text-xs font-bold text-[var(--color-leaf-700)] hover:bg-[var(--color-leaf-100)]"><RotateCcw className="h-3.5 w-3.5" /> Refund</button>}
                        {order.status === "RETURN_APPROVED" && <button onClick={() => void handleResolveReturn(order)} className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-200 dark:hover:bg-zinc-700">Tutup Retur</button>}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Input Resi</h2>
                <p className="text-sm text-gray-500">{selected.order_number}</p>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Nomor resi</label>
                <input value={trackingInput} onChange={(event) => setTrackingInput(event.target.value)} placeholder="Nomor resi pengiriman" className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-black" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setSelected(null)} className="rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-gray-100 dark:hover:bg-zinc-800">Batal</button>
                <button onClick={handleInputTracking} className="rounded-xl bg-[var(--color-leaf-600)] px-5 py-2.5 text-sm font-bold text-white">Kirim</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {proofPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Bukti Pembayaran</h2>
                <p className="text-sm text-gray-500">{proofPreview.orderNumber} - {paymentStatusLabel(proofPreview.payment?.status || "")}</p>
              </div>
              <button onClick={closeProofPreview} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              {isPDFProof(proofPreview.sourceURL) ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 p-10 text-center dark:border-gray-800">
                  <FileText className="mb-3 size-12 text-muted-foreground" />
                  <div className="mb-1 font-semibold">Bukti pembayaran berupa PDF</div>
                  <p className="text-sm text-muted-foreground">Buka file di tab baru untuk melihat detail bukti transfer.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-zinc-950">
                  <img src={proofPreview.url} alt={`Bukti pembayaran ${proofPreview.orderNumber}`} className="max-h-[65vh] w-full object-contain" />
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <button onClick={() => void openUploadURL(proofPreview.sourceURL)} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-zinc-800">Buka Tab Baru <ExternalLink className="h-4 w-4" /></button>
                {proofPreview.payment?.status === "WAITING_CONFIRMATION" && (
                  <button onClick={() => { void handleConfirmPayment(proofPreview.payment.order_id); closeProofPreview(); }} className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-leaf-600)] px-4 py-2.5 text-sm font-bold text-white"><CheckCircle className="h-4 w-4" /> Konfirmasi Pembayaran</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Proses Refund</h2>
                <p className="text-sm text-gray-500">{refundTarget.order_number}{refundTarget.return_reason ? ` - Retur: ${refundTarget.return_reason}` : ""}</p>
              </div>
              <button onClick={() => { setRefundTarget(null); setRefundReason(""); setRefundAmount(""); }} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Alasan refund</label>
                <input value={refundReason} onChange={(event) => setRefundReason(event.target.value)} placeholder="Contoh: tanaman rusak saat diterima" className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-black" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Nominal refund</label>
                <input type="number" min="0" step="1000" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} placeholder="0" className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-black" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => { setRefundTarget(null); setRefundReason(""); setRefundAmount(""); }} className="rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-gray-100 dark:hover:bg-zinc-800">Batal</button>
                <button onClick={handleRefundOrder} disabled={isRefunding} className="rounded-xl bg-[var(--color-leaf-600)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{isRefunding ? "Memproses..." : "Konfirmasi Refund"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {returnTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">{returnAction === "approve" ? "Setujui Retur" : "Tolak Retur"}</h2>
                <p className="text-sm text-gray-500">{returnTarget.order_number}{returnTarget.return_reason ? ` - Alasan pelanggan: ${returnTarget.return_reason}` : ""}</p>
              </div>
              <button onClick={() => { setReturnTarget(null); setReturnDecisionReason(""); }} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">{returnAction === "approve" ? "Catatan persetujuan" : "Alasan penolakan"}</label>
                <input value={returnDecisionReason} onChange={(event) => setReturnDecisionReason(event.target.value)} placeholder={returnAction === "approve" ? "Contoh: retur disetujui, lanjut proses refund." : "Contoh: kondisi produk tidak memenuhi syarat retur."} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-black" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => { setReturnTarget(null); setReturnDecisionReason(""); }} className="rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-gray-100 dark:hover:bg-zinc-800">Batal</button>
                <button onClick={handleSubmitReturnDecision} disabled={isSubmittingReturnAction} className="rounded-xl bg-[var(--color-leaf-600)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{isSubmittingReturnAction ? "Memproses..." : returnAction === "approve" ? "Setujui" : "Tolak"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">{cancelAction === "approve" ? "Setujui Pembatalan" : cancelAction === "reject" ? "Tolak Pembatalan" : "Batalkan Pesanan"}</h2>
                <p className="text-sm text-gray-500">{cancelTarget.order_number}</p>
              </div>
              <button onClick={() => { setCancelTarget(null); setCancelReason(""); }} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">{cancelAction === "reject" ? "Alasan penolakan" : "Alasan"}</label>
                <input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder={cancelAction === "reject" ? "Contoh: pesanan sudah siap dikirim" : "Tulis alasan pembatalan"} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-black" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => { setCancelTarget(null); setCancelReason(""); }} className="rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-gray-100 dark:hover:bg-zinc-800">Tutup</button>
                <button onClick={handleSubmitCancelAction} disabled={isSubmittingCancelAction} className="rounded-xl bg-[var(--color-leaf-600)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{isSubmittingCancelAction ? "Memproses..." : cancelAction === "approve" ? "Setujui" : cancelAction === "reject" ? "Tolak" : "Batalkan Pesanan"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(detailOrder || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-zinc-900">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">Detail Pesanan</h2>
                <p className="text-sm text-gray-500">{detailOrder?.order_number || "Memuat detail pesanan..."}</p>
              </div>
              <button onClick={() => setDetailOrder(null)} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
            </div>

            {detailLoading && !detailOrder ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Memuat detail pesanan...</div>
            ) : detailOrder ? (
              <div className="space-y-3 text-sm">
                <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                  <div className="mb-3 text-sm font-semibold">Informasi Pesanan</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-3"><span className="text-gray-500">Status</span><Badge variant="outline" className={cn("font-semibold", STATUS_STYLES[detailOrder.status])}>{STATUS_LABELS[detailOrder.status] || detailOrder.status}</Badge></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Pelanggan</span><span className="text-right">{detailOrder.shipping_name || detailOrder.user?.full_name || "-"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Telepon</span><span>{detailOrder.shipping_phone || "-"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Alamat</span><span className="max-w-[280px] text-right">{detailOrder.shipping_address || "-"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Resi</span><span>{detailOrder.tracking_number || "-"}</span></div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">Item Pesanan</div>
                    <div className="text-xs text-gray-500">{detailOrder.items?.length || 0} produk</div>
                  </div>
                  <div className="space-y-3">
                    {(detailOrder.items || []).length === 0 ? (
                      <div className="text-sm text-gray-500">Belum ada item pesanan.</div>
                    ) : (
                      (detailOrder.items || []).map((item: any) => (
                        <div key={item.id} className="flex gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-zinc-800">
                            {item.product_image_url ? (
                              <img
                                src={resolveUploadURL(item.product_image_url)}
                                alt={item.product_name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">No Image</div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="line-clamp-2 text-sm font-semibold">{item.product_name || "-"}</div>
                            <div className="mt-1 text-xs text-gray-500">
                              {item.quantity || 0} x {formatCurrency(item.product_price)}
                              {item.unit_type ? ` / ${item.unit_type}` : ""}
                            </div>
                            <div className="mt-2 text-sm font-bold text-[var(--color-leaf-700)] dark:text-[var(--color-leaf-300)]">
                              {formatCurrency(item.subtotal)}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                  <div className="mb-3 text-sm font-semibold">Rincian Harga</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Subtotal Produk</span><span>{formatCurrency(detailOrder.subtotal)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Ongkir</span><span>{formatCurrency(detailOrder.shipping_cost)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Asuransi</span><span>{formatCurrency(detailOrder.insurance_cost)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Packing</span><span>{formatCurrency(detailOrder.packing_cost)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Diskon</span><span>- {formatCurrency(detailOrder.discount)}</span></div>
                    <div className="border-t border-gray-100 pt-2 dark:border-gray-800">
                      <div className="flex justify-between gap-3 text-sm font-bold">
                        <span>Total Bayar</span>
                        <span>{formatCurrency(detailOrder.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                  <div className="mb-3 text-sm font-semibold">Ringkasan</div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <div className="text-xs text-gray-500">Alasan pembatalan</div>
                      <div>{detailOrder.cancellation_reason || "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Alasan retur</div>
                      <div>{detailOrder.return_reason || "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Alasan refund</div>
                      <div>{detailOrder.refund_reason || "-"}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                  <div className="mb-3 text-sm font-semibold">Riwayat Status</div>
                  <div className="space-y-2">
                    {(detailOrder.status_history || []).length === 0 ? (
                      <div className="text-sm text-gray-500">Belum ada riwayat status.</div>
                    ) : (
                      [...detailOrder.status_history]
                        .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
                        .slice(0, 3)
                        .map((entry: any) => (
                          <div key={entry.id} className="rounded-xl border border-gray-100 p-3 text-sm dark:border-gray-800">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-semibold">{STATUS_LABELS[entry.to_status] || entry.to_status}</div>
                              <div className="text-xs text-gray-500">{entry.created_at ? new Date(entry.created_at).toLocaleString("id-ID") : "-"}</div>
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              {entry.note || (entry.from_status ? `${STATUS_LABELS[entry.from_status] || entry.from_status} -> ${STATUS_LABELS[entry.to_status] || entry.to_status}` : "-")}
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button onClick={() => setDetailOrder(null)} className="rounded-xl px-4 py-2 text-sm font-bold hover:bg-gray-100 dark:hover:bg-zinc-800">Tutup</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function isPDFProof(url: string) {
  return url.split("?")[0].toLowerCase().endsWith(".pdf");
}

function paymentMethodLabel(method: string) {
  switch (method) {
    case "manual_bank_transfer":
    case "bank_transfer":
      return "Transfer Manual";
    default:
      return method?.replace(/_/g, " ") || "-";
  }
}

function paymentStatusLabel(status: string) {
  switch (status) {
    case "WAITING_PROOF":
      return "Menunggu bukti";
    case "WAITING_CONFIRMATION":
      return "Menunggu konfirmasi";
    case "PAID":
      return "Dibayar";
    case "PENDING":
      return "Menunggu";
    case "EXPIRED":
      return "Kedaluwarsa";
    case "REFUNDED":
      return "Refund selesai";
    default:
      return status?.replace(/_/g, " ") || "-";
  }
}

function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return `Rp ${amount.toLocaleString("id-ID")}`;
}
