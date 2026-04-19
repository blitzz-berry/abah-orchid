"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Phone, MapPin, Edit2, Save, X } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import api from "@/lib/api";
import { motion } from "framer-motion";

export default function ProfilePage() {
  const { user, isAuthenticated, login } = useAuthStore();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ full_name: "", phone: "" });
  const [addresses, setAddresses] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { router.push("/login"); return; }
    if (user) setFormData({ full_name: user.full_name || "", phone: user.phone || "" });
    const fetchAddr = async () => {
      try { const r = await api.get("/addresses"); setAddresses(r.data.data || []); } catch {}
    };
    fetchAddr();
  }, [isAuthenticated, router, user]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await api.put("/auth/me", formData);
      const updated = res.data.data || res.data;
      if (user) {
        const token = localStorage.getItem("access_token") || "";
        login({ ...user, ...formData }, token);
      }
      setIsEditing(false);
    } catch (e: any) {
      alert("Gagal menyimpan: " + (e.response?.data?.error || e.message));
    } finally { setIsSaving(false); }
  };

  if (!isAuthenticated || !user) return null;

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <h1 className="text-3xl font-extrabold tracking-tight mb-8">Profil Saya</h1>

        {/* Profile Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-brand-400)] to-[var(--color-leaf-500)] flex items-center justify-center text-white text-2xl font-bold">
                {user.full_name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div>
                <h2 className="text-xl font-bold">{user.full_name}</h2>
                <p className="text-sm text-gray-500">{user.email}</p>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-brand-50)] text-[var(--color-brand-600)] dark:bg-[var(--color-brand-900)] dark:text-[var(--color-brand-200)] mt-1 inline-block capitalize">{user.role}</span>
              </div>
            </div>
            <button onClick={() => setIsEditing(!isEditing)} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors">
              {isEditing ? <X className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
            </button>
          </div>

          {isEditing ? (
            <div className="flex flex-col gap-4">
              <div><label className="text-sm font-medium mb-1 block">Nama</label><input value={formData.full_name} onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" /></div>
              <div><label className="text-sm font-medium mb-1 block">Telepon</label><input value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" /></div>
              <button onClick={handleSave} disabled={isSaving} className="self-end flex items-center gap-2 bg-black text-white dark:bg-white dark:text-black px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50">
                <Save className="w-4 h-4" /> {isSaving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/50 dark:bg-black/30"><User className="w-5 h-5 text-gray-400" /><div><div className="text-xs text-gray-500">Nama</div><div className="font-medium text-sm">{user.full_name}</div></div></div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/50 dark:bg-black/30"><Mail className="w-5 h-5 text-gray-400" /><div><div className="text-xs text-gray-500">Email</div><div className="font-medium text-sm">{user.email}</div></div></div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/50 dark:bg-black/30"><Phone className="w-5 h-5 text-gray-400" /><div><div className="text-xs text-gray-500">Telepon</div><div className="font-medium text-sm">{user.phone || "-"}</div></div></div>
            </div>
          )}
        </motion.div>

        {/* Addresses */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2"><MapPin className="w-5 h-5 text-[var(--color-leaf-600)]" /> Alamat Tersimpan</h3>
          </div>
          {addresses.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">Belum ada alamat tersimpan.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {addresses.map((addr: any) => (
                <div key={addr.id} className="p-4 border border-gray-200 dark:border-gray-800 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm">{addr.label || "Alamat"}</span>
                    {addr.is_default && <span className="text-[10px] font-bold px-2 py-0.5 bg-[var(--color-leaf-50)] text-[var(--color-leaf-600)] rounded-full">Default</span>}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{addr.recipient_name} • {addr.phone}</p>
                  <p className="text-sm text-gray-500">{addr.full_address}, {addr.city}, {addr.province} {addr.postal_code}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
