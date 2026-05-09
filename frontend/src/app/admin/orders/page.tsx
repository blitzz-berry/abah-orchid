"use client";

import { useEffect, useState } from "react";
import { CheckCircle, ExternalLink, Eye, FileText, Search, Truck } from "lucide-react";
import { motion } from "framer-motion";
import api from "@/lib/api";
import { createAuthorizedUploadObjectURL, openUploadURL, resolveUploadURL } from "@/lib/uploads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const STATUSES = ["PENDING_PAYMENT", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED"];
const STATUS_LABELS: Record<string, string> = { PENDING_PAYMENT: "Menunggu Bayar", PAID: "Dibayar", PROCESSING: "Diproses", SHIPPED: "Dikirim", DELIVERED: "Diterima", COMPLETED: "Selesai", CANCELLED: "Batal" };
const STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
  PAID: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200",
  PROCESSING: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-900 dark:bg-fuchsia-950/30 dark:text-fuchsia-200",
  SHIPPED: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-200",
  DELIVERED: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
  COMPLETED: "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200",
  CANCELLED: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [proofPreview, setProofPreview] = useState<{ url: string; sourceURL: string; objectURL?: string; orderNumber: string; payment: any } | null>(null);
  const [trackingInput, setTrackingInput] = useState("");

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

  const filtered = orders.filter((order) => {
    if (filterStatus !== "all" && order.status !== filterStatus) return false;
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    return order.order_number?.toLowerCase().includes(keyword) || order.shipping_name?.toLowerCase().includes(keyword);
  });

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold mb-1">Manajemen Pesanan</h1>
        <p className="text-muted-foreground text-sm">Kelola pembayaran, status proses, resi, dan pengiriman pelanggan.</p>
      </div>

      <Card>
        <CardHeader className="gap-4 border-b pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle>Daftar Pesanan</CardTitle>
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
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Order</TableHead>
                <TableHead>Pelanggan</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pembayaran</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Memuat pesanan...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Tidak ada pesanan</TableCell></TableRow>
              ) : filtered.map((order) => {
                const payment = order.payments?.[0] || order.payment || null;
                const proofURL = payment?.proof_image_url ? resolveUploadURL(payment.proof_image_url) : "";
                const isManualTransfer = payment?.method === "manual_bank_transfer" || payment?.method === "bank_transfer";

                return (
                  <motion.tr key={order.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b transition-colors hover:bg-muted/50">
                    <TableCell className="font-semibold">{order.order_number}</TableCell>
                    <TableCell>
                      <div>{order.shipping_name || order.user?.full_name}</div>
                      <div className="text-xs text-muted-foreground">{order.shipping_phone}</div>
                    </TableCell>
                    <TableCell className="font-medium">Rp {order.total?.toLocaleString("id-ID")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("font-semibold", STATUS_STYLES[order.status])}>{STATUS_LABELS[order.status] || order.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {payment ? (
                        <div className="space-y-1 text-xs">
                          <div className="font-semibold">{paymentMethodLabel(payment.method)}</div>
                          <div className="text-muted-foreground">{paymentStatusLabel(payment.status)}</div>
                          {proofURL ? (
                            <Button type="button" variant="link" size="sm" onClick={() => void handlePreviewProof(proofURL, order.order_number, payment)} className="h-auto px-0 py-0 text-xs">
                              <Eye /> Lihat bukti
                            </Button>
                          ) : isManualTransfer ? (
                            <div className="text-amber-600">Menunggu unggah bukti</div>
                          ) : (
                            <div className="text-muted-foreground">Belum ada bukti</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Belum ada data</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{new Date(order.created_at).toLocaleDateString("id-ID")}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        {order.status === "PAID" && <Button size="sm" variant="secondary" onClick={() => handleUpdateStatus(order.id, "PROCESSING")}>Proses</Button>}
                        {order.status === "PROCESSING" && <Button size="sm" variant="secondary" onClick={() => { setSelected(order); setTrackingInput(""); }}><Truck /> Resi</Button>}
                        {order.status === "SHIPPED" && <Button size="sm" variant="secondary" onClick={() => handleUpdateStatus(order.id, "DELIVERED")}>Tandai Diterima</Button>}
                        {order.status === "PENDING_PAYMENT" && payment?.status === "WAITING_CONFIRMATION" && <Button size="sm" onClick={() => handleConfirmPayment(order.id)}><CheckCircle /> Konfirmasi</Button>}
                      </div>
                    </TableCell>
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Input Resi</DialogTitle>
            <DialogDescription>{selected?.order_number}</DialogDescription>
          </DialogHeader>
          <Input value={trackingInput} onChange={(event) => setTrackingInput(event.target.value)} placeholder="Nomor resi pengiriman" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Batal</Button>
            <Button onClick={handleInputTracking}>Kirim</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(proofPreview)} onOpenChange={(open) => { if (!open) closeProofPreview(); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Bukti Pembayaran</DialogTitle>
            <DialogDescription>{proofPreview?.orderNumber} - {paymentStatusLabel(proofPreview?.payment?.status || "")}</DialogDescription>
          </DialogHeader>
          {proofPreview && (
            <>
              {isPDFProof(proofPreview.sourceURL) ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center">
                  <FileText className="mb-3 size-12 text-muted-foreground" />
                  <div className="font-semibold mb-1">Bukti pembayaran berupa PDF</div>
                  <p className="text-sm text-muted-foreground mb-5">Buka file di tab baru untuk melihat detail bukti transfer.</p>
                  <Button type="button" onClick={() => void openUploadURL(proofPreview.sourceURL)}>Buka PDF <ExternalLink /></Button>
                </div>
              ) : (
                <div className="rounded-lg bg-muted overflow-hidden">
                  <img src={proofPreview.url} alt={`Bukti pembayaran ${proofPreview.orderNumber}`} className="max-h-[65vh] w-full object-contain" />
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => void openUploadURL(proofPreview.sourceURL)}>Buka Tab Baru <ExternalLink /></Button>
                {proofPreview.payment?.status === "WAITING_CONFIRMATION" && (
                  <Button onClick={() => { void handleConfirmPayment(proofPreview.payment.order_id); closeProofPreview(); }}>
                    <CheckCircle /> Konfirmasi Pembayaran
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
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
    default:
      return status?.replace(/_/g, " ") || "-";
  }
}
