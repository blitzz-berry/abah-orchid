"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Package, Truck, MapPin, CreditCard, CheckCircle, Star, Upload, ExternalLink, Clock } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import api from "@/lib/api";
import { openUploadURL, resolveUploadURL } from "@/lib/uploads";
import { motion } from "framer-motion";
import type { Order, Payment } from "@/types";

type ReviewDraft = {
  rating: number;
  comment: string;
  submitted: boolean;
};

const MAX_PAYMENT_PROOF_SIZE = 10 * 1024 * 1024;
const ACCEPTED_PAYMENT_PROOF_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export default function OrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [reviewForms, setReviewForms] = useState<Record<string, ReviewDraft>>({});
  const proofInputRef = useRef<HTMLInputElement | null>(null);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    const fetchOrder = async () => {
      try {
        const [orderResponse, paymentResponse] = await Promise.allSettled([
          api.get(`/orders/${id}`),
          api.get(`/payments/${id}/status`),
        ]);
        if (orderResponse.status === "fulfilled") {
          const nextOrder = orderResponse.value.data.data || orderResponse.value.data;
          setOrder(nextOrder);
          setPayment(nextOrder.payments?.[0] || nextOrder.payment || null);
        }
        if (paymentResponse.status === "fulfilled") {
          setPayment(paymentResponse.value.data.data || null);
        }
      } finally {
        setIsLoading(false);
      }
    };
    if (id) void fetchOrder();
  }, [id, isAuthenticated, router]);

  const activePayment = payment || order?.payments?.[0] || order?.payment || null;
  const isManualTransfer = activePayment?.method === "manual_bank_transfer" || activePayment?.method === "bank_transfer";
  const isMidtransPayment = activePayment?.provider === "midtrans";
  const canUploadProof = order?.status === "PENDING_PAYMENT" && isManualTransfer && ["PENDING", "WAITING_PROOF"].includes(activePayment?.status || "");
  const proofImageURL = activePayment?.proof_image_url ? resolveUploadURL(activePayment.proof_image_url) : "";
  const proofUploadMessage = getProofUploadMessage(order?.status || "", activePayment);

  const handleConfirmDelivery = async () => {
    setIsConfirming(true);
    try {
      await api.post(`/orders/${id}/confirm-delivery`);
      setOrder((prev) => prev ? { ...prev, status: "COMPLETED" } : prev);
    } catch (e: any) {
      alert("Gagal: " + (e.response?.data?.error || e.message));
    } finally {
      setIsConfirming(false);
    }
  };

  const updateReviewDraft = (productID: string, next: Partial<ReviewDraft>) => {
    setReviewForms((prev) => ({
      ...prev,
      [productID]: {
        rating: prev[productID]?.rating || 0,
        comment: prev[productID]?.comment || "",
        submitted: prev[productID]?.submitted || false,
        ...next,
      },
    }));
  };

  const handleSubmitReview = async (productID: string) => {
    const form = reviewForms[productID];
    if (!form || form.rating < 1) {
      alert("Pilih rating dulu.");
      return;
    }
    try {
      await api.post("/reviews", {
        order_id: id,
        product_id: productID,
        rating: form.rating,
        comment: form.comment,
      });
      updateReviewDraft(productID, { submitted: true });
    } catch (e: any) {
      alert("Gagal kirim review: " + (e.response?.data?.error || e.message));
    }
  };

  const handleUploadProof = () => {
    if (!canUploadProof || isUploadingProof) return;
    proofInputRef.current?.click();
  };

  const handleProofFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setProofFile(null);
      return;
    }
    if (!order) {
      alert("Data pesanan belum tersedia.");
      event.target.value = "";
      return;
    }
    if (!ACCEPTED_PAYMENT_PROOF_TYPES.includes(file.type)) {
      alert("Format file harus JPG, PNG, WEBP, atau PDF.");
      event.target.value = "";
      setProofFile(null);
      return;
    }
    if (file.size <= 0 || file.size > MAX_PAYMENT_PROOF_SIZE) {
      alert("Ukuran file harus antara 1 byte sampai 10MB.");
      event.target.value = "";
      setProofFile(null);
      return;
    }

    const payload = new FormData();
    payload.append("file", file);
    setProofFile(file);
    setIsUploadingProof(true);
    try {
      const response = await api.post(`/payments/${order.id}/upload-proof-file`, payload);
      setPayment(response.data.data?.payment || response.data.data || null);
      setProofFile(null);
      event.target.value = "";
      alert("Bukti transfer berhasil diupload. Admin akan konfirmasi pembayaran.");
    } catch (e: any) {
      alert("Upload bukti gagal: " + (e.response?.data?.error || e.message));
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handleContinuePayment = async () => {
    if (!order) return;
    try {
      const response = await api.post(`/payments/${order.id}/pay`);
      const paymentURL = response.data.payment_url || response.data.data?.payment_url;
      if (paymentURL) window.location.href = paymentURL;
    } catch (e: any) {
      alert("Gagal membuka pembayaran: " + (e.response?.data?.error || e.message));
    }
  };

  const handleOpenProof = async () => {
    if (!activePayment?.proof_image_url) return;
    try {
      await openUploadURL(activePayment.proof_image_url);
    } catch (e: any) {
      alert("Gagal membuka bukti transfer: " + (e.response?.data?.error || e.message));
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-[var(--bg)]">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-[var(--color-leaf-500)] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col min-h-screen bg-[var(--bg)]">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold mb-2">Pesanan tidak ditemukan</h1>
          <Link href="/orders" className="text-[var(--color-brand-600)] hover:underline">Kembali</Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <Link href="/orders" className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[var(--color-brand-600)] mb-6">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Pesanan
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold">{order.order_number}</h1>
            <p className="text-sm text-gray-500">{new Date(order.created_at || "").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
          </div>
          <span className="px-3 py-1 rounded-full text-sm font-bold bg-[var(--color-brand-50)] text-[var(--color-brand-600)] dark:bg-[var(--color-brand-900)] dark:text-[var(--color-brand-200)]">{orderStatusLabel(order.status)}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5">
              <h3 className="font-bold mb-4 flex items-center gap-2"><Package className="w-5 h-5" /> Item Pesanan</h3>
              <div className="flex flex-col gap-3">
                {order.items?.map((item) => (
                  <div key={item.id} className="p-3 border border-gray-100 dark:border-gray-800 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden shrink-0">
                        {item.product_image_url ? (
                          <img src={resolveUploadURL(item.product_image_url)} alt={item.product_name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-5 h-5 text-gray-400 m-3.5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{item.product_name}</div>
                        <div className="text-xs text-gray-500">{item.quantity} x Rp {item.product_price.toLocaleString("id-ID")}</div>
                      </div>
                      <div className="font-bold text-sm">Rp {item.subtotal.toLocaleString("id-ID")}</div>
                    </div>
                    {order.status === "COMPLETED" && (
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                        <div className="text-sm font-semibold mb-2 flex items-center gap-2"><Star className="w-4 h-4 text-amber-500" /> Review Produk</div>
                        {reviewForms[item.product_id]?.submitted ? (
                          <div className="text-sm text-emerald-600 font-medium">Review berhasil dikirim.</div>
                        ) : (
                          <>
                            <div className="flex gap-2 mb-3">
                              {[1, 2, 3, 4, 5].map((rating) => (
                                <button key={rating} type="button" onClick={() => updateReviewDraft(item.product_id, { rating })} className={`text-xl ${rating <= (reviewForms[item.product_id]?.rating || 0) ? "text-amber-500" : "text-gray-300"}`}>★</button>
                              ))}
                            </div>
                            <textarea value={reviewForms[item.product_id]?.comment || ""} onChange={(e) => updateReviewDraft(item.product_id, { comment: e.target.value })} rows={3} placeholder="Tulis pengalaman lu dengan produk ini..." className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm mb-3" />
                            <button onClick={() => handleSubmitReview(item.product_id)} className="px-4 py-2 rounded-xl bg-black text-white dark:bg-white dark:text-black text-sm font-bold">Kirim Review</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-5">
              <h3 className="font-bold mb-4 flex items-center gap-2"><MapPin className="w-5 h-5 text-[var(--color-leaf-600)]" /> Pengiriman</h3>
              <div className="text-sm space-y-1">
                <p className="font-medium">{order.shipping_name} - {order.shipping_phone}</p>
                <p className="text-gray-500">{order.shipping_address}</p>
                <p className="text-gray-500">{order.shipping_city}, {order.shipping_province} {order.shipping_postal_code}</p>
                {order.courier_code && <p className="mt-2"><span className="font-medium uppercase">{order.courier_code}</span> {order.courier_service}</p>}
                {order.tracking_number && <p className="flex items-center gap-2 mt-2"><Truck className="w-4 h-4" /> <span className="font-mono font-bold">{order.tracking_number}</span></p>}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass rounded-2xl p-5">
              <h3 className="font-bold mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5 text-[var(--color-brand-600)]" /> Pembayaran</h3>
              {activePayment ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                      <div className="text-gray-500 text-xs mb-1">Metode</div>
                      <div className="font-bold">{paymentMethodLabel(activePayment.method)}</div>
                    </div>
                    <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                      <div className="text-gray-500 text-xs mb-1">Status</div>
                      <div className="font-bold">{paymentStatusLabel(activePayment.status)}</div>
                    </div>
                  </div>

                  {activePayment.expired_at && order.status === "PENDING_PAYMENT" && (
                    <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 p-3 text-sm text-amber-900 dark:text-amber-100">
                      <Clock className="w-4 h-4" /> Batas pembayaran: {new Date(activePayment.expired_at).toLocaleString("id-ID")}
                    </div>
                  )}

                  {isManualTransfer && (
                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-sm">
                      <div className="font-bold mb-2">Rekening Transfer Manual</div>
                      <div className="space-y-1 text-gray-600 dark:text-gray-300">
                        <p>BCA 1234567890 a.n. OrchidMart</p>
                        <p>BNI 0987654321 a.n. OrchidMart</p>
                        <p>BRI 1122334455 a.n. OrchidMart</p>
                        <p>Mandiri 5566778899 a.n. OrchidMart</p>
                      </div>
                      <p className="mt-3 text-xs text-gray-500">Transfer sesuai total pesanan lalu upload bukti. Admin akan konfirmasi manual.</p>
                    </div>
                  )}

                  {proofImageURL && (
                    <button type="button" onClick={handleOpenProof} className="inline-flex items-center gap-2 text-sm font-bold text-[var(--color-brand-600)] hover:underline">
                      Lihat bukti transfer <ExternalLink className="w-4 h-4" />
                    </button>
                  )}

                  {isManualTransfer && (
                    <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-4">
                      <div className="text-sm font-medium mb-3">Upload Bukti Transfer</div>
                      {canUploadProof ? (
                        <>
                          <input ref={proofInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleProofFileChange} className="hidden" />
                          {proofFile && <p className="text-xs text-gray-500 mb-3">{proofFile.name}</p>}
                          <button onClick={handleUploadProof} disabled={isUploadingProof} className="px-4 py-2 rounded-xl bg-black text-white dark:bg-white dark:text-black text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50">
                            <Upload className="w-4 h-4" /> {isUploadingProof ? "Mengupload..." : "Upload Bukti"}
                          </button>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">{proofUploadMessage}</p>
                      )}
                    </div>
                  )}

                  {isMidtransPayment && order.status === "PENDING_PAYMENT" && (
                    <button onClick={handleContinuePayment} className="px-4 py-2 rounded-xl bg-black text-white dark:bg-white dark:text-black text-sm font-bold inline-flex items-center gap-2">
                      Lanjutkan Pembayaran <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Data pembayaran belum tersedia.</p>
              )}
            </motion.div>
          </div>

          <div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass rounded-2xl p-5 sticky top-24">
              <h3 className="font-bold mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5" /> Ringkasan</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>Rp {order.subtotal.toLocaleString("id-ID")}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Ongkir</span><span>Rp {order.shipping_cost.toLocaleString("id-ID")}</span></div>
                {order.discount > 0 && <div className="flex justify-between text-green-600"><span>Diskon</span><span>- Rp {order.discount.toLocaleString("id-ID")}</span></div>}
                <div className="flex justify-between font-extrabold text-lg border-t border-gray-200 dark:border-gray-800 pt-3 mt-3"><span>Total</span><span className="text-[var(--color-brand-600)]">Rp {order.total.toLocaleString("id-ID")}</span></div>
              </div>

              {order.status === "DELIVERED" && (
                <button onClick={handleConfirmDelivery} disabled={isConfirming} className="w-full mt-6 py-3 bg-[var(--color-leaf-600)] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform disabled:opacity-50">
                  <CheckCircle className="w-5 h-5" /> {isConfirming ? "Memproses..." : "Konfirmasi Diterima"}
                </button>
              )}

              {order.note && <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-sm"><span className="font-bold text-amber-700">Catatan:</span> {order.note}</div>}
            </motion.div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function paymentMethodLabel(method: string) {
  switch (method) {
    case "manual_bank_transfer":
    case "bank_transfer":
      return "Transfer Bank Manual";
    case "midtrans_bank_transfer":
      return "Virtual Account Midtrans";
    case "midtrans_ewallet":
      return "E-Wallet Midtrans";
    case "midtrans_card":
      return "Kartu Kredit/Debit";
    case "midtrans":
      return "Midtrans";
    default:
      return method.replace(/_/g, " ");
  }
}

function paymentStatusLabel(status: string) {
  switch (status) {
    case "WAITING_PROOF":
      return "Menunggu Bukti Transfer";
    case "WAITING_CONFIRMATION":
      return "Menunggu Konfirmasi Admin";
    case "PENDING":
      return "Menunggu Pembayaran";
    case "PAID":
      return "Dibayar";
    case "EXPIRED":
      return "Kedaluwarsa";
    case "REFUNDED":
      return "Refund";
    default:
      return status.replace(/_/g, " ");
  }
}

function getProofUploadMessage(orderStatus: string, payment: Payment | null) {
  if (!payment) return "Data pembayaran belum tersedia.";
  if (payment.status === "WAITING_CONFIRMATION") return "Bukti transfer sudah diupload dan sedang menunggu konfirmasi admin.";
  if (payment.status === "PAID") return "Pembayaran sudah dikonfirmasi.";
  if (payment.status === "EXPIRED") return "Pembayaran sudah kedaluwarsa.";
  if (orderStatus !== "PENDING_PAYMENT") return `Upload bukti hanya tersedia saat status pesanan ${orderStatusLabel("PENDING_PAYMENT")}. Status sekarang: ${orderStatusLabel(orderStatus)}.`;
  return "Upload bukti belum tersedia untuk pembayaran ini.";
}

function orderStatusLabel(status: string) {
  switch (status) {
    case "PENDING_PAYMENT":
      return "Menunggu Pembayaran";
    case "PAID":
      return "Dibayar";
    case "PROCESSING":
      return "Diproses";
    case "SHIPPED":
      return "Dikirim";
    case "DELIVERED":
      return "Terkirim";
    case "COMPLETED":
      return "Selesai";
    case "CANCELLED":
      return "Dibatalkan";
    case "RETURN_REQUESTED":
      return "Pengajuan Retur";
    case "REFUNDED":
      return "Refund";
    default:
      return status.replace(/_/g, " ");
  }
}
