"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import type { Coupon } from "@/types";
import { CheckCircle2, Edit2, Plus, Search, TicketPercent, Trash2, X } from "lucide-react";
import { TableRowsSkeleton } from "@/components/ui/loading";

type CouponForm = {
  id?: string;
  code: string;
  description: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_purchase: number;
  max_discount: number;
  usage_limit: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
};

const emptyForm: CouponForm = {
  code: "",
  description: "",
  discount_type: "percentage",
  discount_value: 10,
  min_purchase: 0,
  max_discount: 0,
  usage_limit: 0,
  valid_from: new Date().toISOString().slice(0, 10),
  valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  is_active: true,
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<{ discount: number; code: string } | null>(null);
  const [previewSubtotal, setPreviewSubtotal] = useState(500000);
  const [currentTime, setCurrentTime] = useState(0);

  const fetchCoupons = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/admin/coupons");
      setCoupons(response.data.data || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchCoupons();
    setCurrentTime(Date.now());
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return coupons.filter((coupon) => `${coupon.code} ${coupon.description || ""}`.toLowerCase().includes(q));
  }, [coupons, search]);

  const openCreateModal = () => {
    setPreview(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (coupon: Coupon) => {
    setPreview(null);
    setForm({
      id: coupon.id,
      code: coupon.code,
      description: coupon.description || "",
      discount_type: coupon.discount_type,
      discount_value: Number(coupon.discount_value || 0),
      min_purchase: Number(coupon.min_purchase || 0),
      max_discount: Number(coupon.max_discount || 0),
      usage_limit: Number(coupon.usage_limit || 0),
      valid_from: coupon.valid_from?.slice(0, 10) || emptyForm.valid_from,
      valid_until: coupon.valid_until?.slice(0, 10) || emptyForm.valid_until,
      is_active: coupon.is_active,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      ...form,
      code: form.code.trim().toUpperCase(),
      discount_value: Number(form.discount_value),
      min_purchase: Number(form.min_purchase),
      max_discount: Number(form.max_discount),
      usage_limit: Number(form.usage_limit),
    };
    try {
      if (form.id) {
        await api.put(`/admin/coupons/${form.id}`, payload);
      } else {
        await api.post("/admin/coupons", payload);
      }
      setIsModalOpen(false);
      await fetchCoupons();
    } catch (e: any) {
      alert("Gagal menyimpan kupon: " + (e.response?.data?.error || e.message));
    }
  };

  const handleDelete = async (coupon: Coupon) => {
    if (!confirm(`Hapus kupon ${coupon.code}?`)) return;
    try {
      await api.delete(`/admin/coupons/${coupon.id}`);
      await fetchCoupons();
    } catch (e: any) {
      alert("Gagal menghapus kupon: " + (e.response?.data?.error || e.message));
    }
  };

  const handlePreview = async () => {
    try {
      const response = await api.post("/admin/coupons/preview", {
        code: form.code.trim().toUpperCase(),
        subtotal: Number(previewSubtotal),
      });
      setPreview(response.data.data);
    } catch (e: any) {
      setPreview(null);
      alert("Preview gagal: " + (e.response?.data?.error || e.message));
    }
  };

  const activeCount = coupons.filter((coupon) => coupon.is_active).length;
  const exhaustedCount = coupons.filter((coupon) => coupon.usage_limit > 0 && coupon.used_count >= coupon.usage_limit).length;

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold mb-1">Kupon</h1>
          <p className="text-gray-500 text-sm">Kelola promo checkout, masa berlaku, limit pemakaian, dan preview diskon</p>
        </div>
        <button onClick={openCreateModal} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-leaf-600)] px-4 py-3 text-sm font-bold text-white">
          <Plus className="h-4 w-4" />
          Buat Kupon
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Metric label="Total Kupon" value={coupons.length.toString()} />
        <Metric label="Aktif" value={activeCount.toString()} />
        <Metric label="Limit Habis" value={exhaustedCount.toString()} />
        <Metric label="Terpakai" value={coupons.reduce((sum, coupon) => sum + coupon.used_count, 0).toString()} />
      </div>

      <div className="mb-6 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari kode kupon..." className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm dark:border-gray-800 dark:bg-zinc-900" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-zinc-950">
                <th className="p-4 text-xs font-bold uppercase text-gray-500">Kode</th>
                <th className="p-4 text-xs font-bold uppercase text-gray-500">Diskon</th>
                <th className="p-4 text-xs font-bold uppercase text-gray-500">Minimum</th>
                <th className="p-4 text-xs font-bold uppercase text-gray-500">Pemakaian</th>
                <th className="p-4 text-xs font-bold uppercase text-gray-500">Berlaku</th>
                <th className="p-4 text-xs font-bold uppercase text-gray-500">Status</th>
                <th className="p-4 text-right text-xs font-bold uppercase text-gray-500">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableRowsSkeleton columns={7} rows={6} />
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-sm text-gray-500">Belum ada kupon</td></tr>
              ) : filtered.map((coupon) => (
                <tr key={coupon.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="p-4">
                    <div className="font-bold text-sm">{coupon.code}</div>
                    <div className="text-xs text-gray-500">{coupon.description || "-"}</div>
                  </td>
                  <td className="p-4 text-sm font-semibold">{formatDiscount(coupon)}</td>
                  <td className="p-4 text-sm">Rp {Number(coupon.min_purchase || 0).toLocaleString("id-ID")}</td>
                  <td className="p-4 text-sm">{coupon.used_count}/{coupon.usage_limit || "unlimited"}</td>
                  <td className="p-4 text-xs text-gray-500">{formatDate(coupon.valid_from)} - {formatDate(coupon.valid_until)}</td>
                  <td className="p-4"><StatusBadge coupon={coupon} currentTime={currentTime} /></td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEditModal(coupon)} className="rounded-xl bg-gray-100 p-2 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-200"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(coupon)} className="rounded-xl bg-red-50 p-2 text-red-600 hover:bg-red-100 dark:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">{form.id ? "Edit Kupon" : "Buat Kupon"}</h2>
                <p className="text-sm text-gray-500">Kode otomatis dinormalisasi ke huruf besar</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Kode" value={form.code} onChange={(value) => setForm((prev) => ({ ...prev, code: value.toUpperCase() }))} />
              <SelectInput label="Tipe Diskon" value={form.discount_type} onChange={(value) => setForm((prev) => ({ ...prev, discount_type: value as CouponForm["discount_type"] }))} />
              <NumberInput label="Nilai Diskon" value={form.discount_value} onChange={(value) => setForm((prev) => ({ ...prev, discount_value: value }))} />
              <NumberInput label="Minimum Belanja" value={form.min_purchase} onChange={(value) => setForm((prev) => ({ ...prev, min_purchase: value }))} />
              <NumberInput label="Maksimum Diskon" value={form.max_discount} onChange={(value) => setForm((prev) => ({ ...prev, max_discount: value }))} />
              <NumberInput label="Limit Pemakaian" value={form.usage_limit} onChange={(value) => setForm((prev) => ({ ...prev, usage_limit: value }))} />
              <TextInput label="Mulai Berlaku" type="date" value={form.valid_from} onChange={(value) => setForm((prev) => ({ ...prev, valid_from: value }))} />
              <TextInput label="Berakhir" type="date" value={form.valid_until} onChange={(value) => setForm((prev) => ({ ...prev, valid_until: value }))} />
              <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm font-medium dark:border-gray-800">
                <input type="checkbox" checked={form.is_active} onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))} />
                Aktif
              </label>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Deskripsi</label>
                <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} className="min-h-20 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-black" />
              </div>

              <div className="sm:col-span-2 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <NumberInput label="Subtotal Preview" value={previewSubtotal} onChange={setPreviewSubtotal} />
                  <button type="button" onClick={handlePreview} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-zinc-800">
                    <TicketPercent className="h-4 w-4" />
                    Preview
                  </button>
                </div>
                {preview && (
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    {preview.code}: Rp {preview.discount.toLocaleString("id-ID")}
                  </div>
                )}
              </div>

              <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-gray-100 dark:hover:bg-zinc-800">Batal</button>
                <button type="submit" className="rounded-xl bg-[var(--color-leaf-600)] px-5 py-2.5 text-sm font-bold text-white">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-zinc-900">
      <div className="mb-1 text-xs text-gray-500">{label}</div>
      <div className="text-lg font-extrabold">{value}</div>
    </div>
  );
}

function TextInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input required type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-black" />
    </div>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input required type="number" min={0} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-black" />
    </div>
  );
}

function SelectInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-black">
        <option value="percentage">Persentase</option>
        <option value="fixed">Nominal</option>
      </select>
    </div>
  );
}

function StatusBadge({ coupon, currentTime }: { coupon: Coupon; currentTime: number }) {
  const expired = currentTime > 0 && new Date(coupon.valid_until).getTime() < currentTime;
  const exhausted = coupon.usage_limit > 0 && coupon.used_count >= coupon.usage_limit;
  const active = coupon.is_active && !expired && !exhausted;
  const label = active ? "AKTIF" : expired ? "EXPIRED" : exhausted ? "LIMIT HABIS" : "NONAKTIF";
  const style = active ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-600";
  return <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${style}`}>{label}</span>;
}

function formatDiscount(coupon: Coupon) {
  if (coupon.discount_type === "percentage") {
    const max = coupon.max_discount > 0 ? `, max Rp ${Number(coupon.max_discount).toLocaleString("id-ID")}` : "";
    return `${coupon.discount_value}%${max}`;
  }
  return `Rp ${Number(coupon.discount_value).toLocaleString("id-ID")}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}
