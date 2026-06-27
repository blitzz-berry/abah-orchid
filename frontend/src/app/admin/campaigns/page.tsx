"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Megaphone, Plus, Edit2, Trash2, X, Search } from "lucide-react";
import { TableRowsSkeleton } from "@/components/ui/loading";

type PromoForm = {
  id?: string;
  name: string;
  description: string;
  discount_type: "PERCENTAGE" | "FIXED";
  discount_value: number;
  rule_type: string;
  rule_value: string;
  is_active: boolean;
};

const emptyForm: PromoForm = {
  name: "",
  description: "",
  discount_type: "PERCENTAGE",
  discount_value: 10,
  rule_type: "DAY_OF_WEEK",
  rule_value: "Friday",
  is_active: true,
};

export default function AdminCampaignsPage() {
  const [promos, setPromos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<PromoForm>(emptyForm);
  const [search, setSearch] = useState("");

  const fetchPromos = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/admin/promotions");
      setPromos(response.data || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchPromos();
  }, []);

  const filtered = promos.filter((promo) => 
    `${promo.name} ${promo.description || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const openCreateModal = () => {
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (promo: any) => {
    setForm({
      id: promo.id,
      name: promo.name,
      description: promo.description || "",
      discount_type: promo.discount_type,
      discount_value: Number(promo.discount_value || 0),
      rule_type: promo.rule_type,
      rule_value: promo.rule_value,
      is_active: promo.is_active,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      ...form,
      discount_value: Number(form.discount_value),
    };
    try {
      if (form.id) {
        // Mock update as there is no put endpoint for full promo update defined yet, maybe wait for next step.
        // For now, toggle handles the active status. We will just use Create for now or rely on toggle.
        // To be fully functional, you'd need PUT /promotions/:id.
      } else {
        await api.post("/admin/promotions", payload);
      }
      setIsModalOpen(false);
      await fetchPromos();
    } catch (e: any) {
      alert("Gagal menyimpan campaign: " + (e.response?.data?.error || e.message));
    }
  };

  const handleDelete = async (promo: any) => {
    if (!confirm(`Hapus campaign ${promo.name}?`)) return;
    try {
      await api.delete(`/admin/promotions/${promo.id}`);
      await fetchPromos();
    } catch (e: any) {
      alert("Gagal menghapus campaign: " + (e.response?.data?.error || e.message));
    }
  };

  const handleToggle = async (promo: any) => {
    try {
      await api.put(`/admin/promotions/${promo.id}/toggle`);
      await fetchPromos();
    } catch (e: any) {
      alert("Gagal mengubah status: " + (e.response?.data?.error || e.message));
    }
  };

  const activeCount = promos.filter((p) => p.is_active).length;

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold mb-1 flex items-center gap-2">
            Promosi & Campaign
          </h1>
          <p className="text-gray-500 text-sm">Kelola potongan harga otomatis seperti Jumat Berkah</p>
        </div>
        <button onClick={openCreateModal} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-leaf-600)] px-4 py-3 text-sm font-bold text-white transition-transform hover:scale-[1.02]">
          <Plus className="h-4 w-4" />
          Buat Campaign
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Metric label="Total Campaign" value={promos.length.toString()} />
        <Metric label="Campaign Aktif" value={activeCount.toString()} />
        <Metric label="Campaign Inaktif" value={(promos.length - activeCount).toString()} />
      </div>

      <div className="mb-6 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama campaign..." className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm dark:border-gray-800 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-leaf-500)]" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-zinc-950">
                <th className="p-4 text-xs font-bold uppercase text-gray-500">Info Campaign</th>
                <th className="p-4 text-xs font-bold uppercase text-gray-500">Diskon</th>
                <th className="p-4 text-xs font-bold uppercase text-gray-500">Syarat Berlaku</th>
                <th className="p-4 text-xs font-bold uppercase text-gray-500">Status</th>
                <th className="p-4 text-right text-xs font-bold uppercase text-gray-500">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableRowsSkeleton columns={5} rows={4} />
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-sm text-gray-500">Belum ada campaign</td></tr>
              ) : filtered.map((promo) => (
                <tr key={promo.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="p-4">
                    <div className="font-bold text-sm text-[var(--fg)]">{promo.name}</div>
                    <div className="text-xs text-gray-500">{promo.description || "-"}</div>
                  </td>
                  <td className="p-4 text-sm font-semibold">
                    <span className="bg-[var(--color-leaf-50)] text-[var(--color-leaf-700)] dark:bg-[var(--color-leaf-900)] dark:text-[var(--color-leaf-300)] px-2 py-1 rounded-md text-xs">
                      {promo.discount_type === 'PERCENTAGE' ? `${promo.discount_value}%` : `Rp ${promo.discount_value.toLocaleString('id-ID')}`}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-700 dark:text-gray-300">
                    {formatRule(promo.rule_type, promo.rule_value)}
                  </td>
                  <td className="p-4">
                    <button onClick={() => handleToggle(promo)} className="flex items-center gap-2 group">
                      <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${promo.is_active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                        <div className={`absolute top-0.5 bg-white w-4 h-4 rounded-full transition-all ${promo.is_active ? 'right-0.5' : 'left-0.5'}`}></div>
                      </div>
                      <span className={`text-xs font-bold ${promo.is_active ? 'text-emerald-600' : 'text-gray-500'}`}>
                        {promo.is_active ? 'Aktif' : 'Inaktif'}
                      </span>
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleDelete(promo)} className="rounded-xl bg-red-50 p-2 text-red-600 hover:bg-red-100 dark:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
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
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Buat Campaign</h2>
                <p className="text-sm text-gray-500">Otomatis berlaku saat sesuai kondisi</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <TextInput label="Nama Campaign (Misal: Jumat Berkah)" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} />
              <TextInput label="Deskripsi (Opsional)" value={form.description} onChange={(value) => setForm((prev) => ({ ...prev, description: value }))} />
              
              <div className="flex gap-4">
                <div className="flex-1">
                  <SelectInput label="Tipe Diskon" value={form.discount_type} onChange={(value) => setForm((prev) => ({ ...prev, discount_type: value as any }))} options={[{value: 'PERCENTAGE', label: 'Persentase'}, {value: 'FIXED', label: 'Nominal Rp'}]} />
                </div>
                <div className="flex-1">
                  <NumberInput label="Nilai" value={form.discount_value} onChange={(value) => setForm((prev) => ({ ...prev, discount_value: value }))} />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <SelectInput label="Syarat Berlaku" value={form.rule_type} onChange={(value) => setForm((prev) => ({ ...prev, rule_type: value }))} options={[{value: 'DAY_OF_WEEK', label: 'Hari (DAY_OF_WEEK)'}]} />
                </div>
                <div className="flex-1">
                  <SelectInput label="Hari" value={form.rule_value} onChange={(value) => setForm((prev) => ({ ...prev, rule_value: value }))} options={[{value: 'Monday', label: 'Senin'}, {value: 'Tuesday', label: 'Selasa'}, {value: 'Wednesday', label: 'Rabu'}, {value: 'Thursday', label: 'Kamis'}, {value: 'Friday', label: 'Jumat'}, {value: 'Saturday', label: 'Sabtu'}, {value: 'Sunday', label: 'Minggu'}]} />
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm font-medium dark:border-gray-800 mt-2">
                <input type="checkbox" checked={form.is_active} onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))} />
                Aktif (Langsung jalankan campaign)
              </label>

              <div className="mt-4 flex justify-end gap-2">
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
      <div className="text-2xl font-extrabold">{value}</div>
    </div>
  );
}

function TextInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <input required type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm dark:border-gray-800 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-[var(--color-leaf-500)]" />
    </div>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <input required type="number" min={0} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm dark:border-gray-800 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-[var(--color-leaf-500)]" />
    </div>
  );
}

function SelectInput({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: {value: string, label: string}[] }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm dark:border-gray-800 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-[var(--color-leaf-500)]">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function formatRule(ruleType: string, ruleValue: string) {
  if (ruleType === "DAY_OF_WEEK") {
    const days: Record<string, string> = {
      Monday: "Senin",
      Tuesday: "Selasa",
      Wednesday: "Rabu",
      Thursday: "Kamis",
      Friday: "Jumat",
      Saturday: "Sabtu",
      Sunday: "Minggu",
    };
    return (
      <span>
        Berlaku setiap hari <span className="font-bold text-[var(--fg)]">{days[ruleValue] || ruleValue}</span>
      </span>
    );
  }
  return (
    <span>
      {ruleType}: <span className="font-bold text-[var(--fg)]">{ruleValue}</span>
    </span>
  );
}
