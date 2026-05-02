"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Phone, MapPin, Edit2, Save, X, Plus, Trash2, Star } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import api from "@/lib/api";
import { motion } from "framer-motion";
import type { Address } from "@/types";

type AddressForm = Omit<Address, "id" | "user_id">;

const emptyAddressForm: AddressForm = {
  label: "",
  recipient_name: "",
  phone: "",
  province: "",
  city: "",
  district: "",
  postal_code: "",
  full_address: "",
  is_default: false,
};

export default function ProfilePage() {
  const { user, isAuthenticated, login } = useAuthStore();
  const router = useRouter();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: "", phone: "" });
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState<AddressForm>(emptyAddressForm);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  const fetchAddresses = async () => {
    try {
      const response = await api.get("/addresses");
      setAddresses(response.data.data || []);
    } catch {
      setAddresses([]);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    if (user) {
      setProfileForm({
        full_name: user.full_name || "",
        phone: user.phone || "",
      });
    }
    void fetchAddresses();
  }, [isAuthenticated, router, user]);

  const resetAddressForm = () => {
    setAddressForm(emptyAddressForm);
    setEditingAddressId(null);
    setIsAddressModalOpen(false);
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const res = await api.put("/auth/me", profileForm);
      const updatedUser = res.data.data || res.data;
      if (user) {
        login({ ...user, ...updatedUser });
      }
      setIsEditingProfile(false);
    } catch (e: any) {
      alert("Gagal menyimpan profil: " + (e.response?.data?.error || e.message));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const openCreateAddress = () => {
    setEditingAddressId(null);
    setAddressForm({
      ...emptyAddressForm,
      recipient_name: user?.full_name || "",
      phone: user?.phone || "",
      is_default: addresses.length === 0,
    });
    setIsAddressModalOpen(true);
  };

  const openEditAddress = (address: Address) => {
    setEditingAddressId(address.id);
    setAddressForm({
      label: address.label,
      recipient_name: address.recipient_name,
      phone: address.phone,
      province: address.province,
      city: address.city,
      district: address.district,
      postal_code: address.postal_code,
      full_address: address.full_address,
      is_default: address.is_default,
    });
    setIsAddressModalOpen(true);
  };

  const handleSaveAddress = async () => {
    setIsSavingAddress(true);
    try {
      if (editingAddressId) {
        await api.put(`/addresses/${editingAddressId}`, addressForm);
      } else {
        await api.post("/addresses", addressForm);
      }
      await fetchAddresses();
      resetAddressForm();
    } catch (e: any) {
      alert("Gagal menyimpan alamat: " + (e.response?.data?.error || e.message));
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm("Hapus alamat ini?")) return;
    try {
      await api.delete(`/addresses/${addressId}`);
      await fetchAddresses();
    } catch (e: any) {
      alert("Gagal menghapus alamat: " + (e.response?.data?.error || e.message));
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    try {
      await api.post(`/addresses/${addressId}/default`);
      await fetchAddresses();
    } catch (e: any) {
      alert("Gagal mengubah alamat default: " + (e.response?.data?.error || e.message));
    }
  };

  if (!isAuthenticated || !user) return null;

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <h1 className="text-3xl font-extrabold tracking-tight mb-8">Profil Saya</h1>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-brand-600)] flex items-center justify-center text-white text-2xl font-bold">
                {user.full_name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div>
                <h2 className="text-xl font-bold">{user.full_name}</h2>
                <p className="text-sm text-gray-500">{user.email}</p>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-brand-50)] text-[var(--color-brand-600)] dark:bg-[var(--color-brand-900)] dark:text-[var(--color-brand-200)] mt-1 inline-block capitalize">{user.role}</span>
              </div>
            </div>
            <button onClick={() => setIsEditingProfile(!isEditingProfile)} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors">
              {isEditingProfile ? <X className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
            </button>
          </div>

          {isEditingProfile ? (
            <div className="flex flex-col gap-4">
              <div><label className="text-sm font-medium mb-1 block">Nama</label><input value={profileForm.full_name} onChange={(e) => setProfileForm((prev) => ({ ...prev, full_name: e.target.value }))} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" /></div>
              <div><label className="text-sm font-medium mb-1 block">Telepon</label><input value={profileForm.phone} onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" /></div>
              <button onClick={handleSaveProfile} disabled={isSavingProfile} className="self-end flex items-center gap-2 bg-black text-white dark:bg-white dark:text-black px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50">
                <Save className="w-4 h-4" /> {isSavingProfile ? "Menyimpan..." : "Simpan"}
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

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4 gap-4">
            <h3 className="text-lg font-bold flex items-center gap-2"><MapPin className="w-5 h-5 text-[var(--color-leaf-600)]" /> Alamat Tersimpan</h3>
            <button onClick={openCreateAddress} className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-leaf-600)] text-white rounded-xl text-sm font-bold">
              <Plus className="w-4 h-4" /> Tambah Alamat
            </button>
          </div>
          {addresses.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">Belum ada alamat tersimpan.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {addresses.map((addr) => (
                <div key={addr.id} className="p-4 border border-gray-200 dark:border-gray-800 rounded-xl">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{addr.label || "Alamat"}</span>
                      {addr.is_default && <span className="text-[10px] font-bold px-2 py-0.5 bg-[var(--color-leaf-50)] text-[var(--color-leaf-600)] rounded-full">Default</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {!addr.is_default && (
                        <button onClick={() => handleSetDefaultAddress(addr.id)} className="p-2 rounded-lg hover:bg-amber-50 text-amber-600" title="Jadikan default">
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => openEditAddress(addr)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-600" title="Edit alamat">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteAddress(addr.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600" title="Hapus alamat">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{addr.recipient_name} • {addr.phone}</p>
                  <p className="text-sm text-gray-500">{addr.full_address}</p>
                  <p className="text-sm text-gray-500">{addr.district ? `${addr.district}, ` : ""}{addr.city}, {addr.province} {addr.postal_code}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {isAddressModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">{editingAddressId ? "Edit Alamat" : "Tambah Alamat"}</h2>
              <button onClick={resetAddressForm} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-sm font-medium mb-1 block">Label</label><input value={addressForm.label} onChange={(e) => setAddressForm((prev) => ({ ...prev, label: e.target.value }))} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" placeholder="Rumah / Kantor" /></div>
              <div><label className="text-sm font-medium mb-1 block">Penerima</label><input value={addressForm.recipient_name} onChange={(e) => setAddressForm((prev) => ({ ...prev, recipient_name: e.target.value }))} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" /></div>
              <div><label className="text-sm font-medium mb-1 block">Telepon</label><input value={addressForm.phone} onChange={(e) => setAddressForm((prev) => ({ ...prev, phone: e.target.value }))} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" /></div>
              <div><label className="text-sm font-medium mb-1 block">Kode Pos</label><input value={addressForm.postal_code} onChange={(e) => setAddressForm((prev) => ({ ...prev, postal_code: e.target.value }))} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" /></div>
              <div><label className="text-sm font-medium mb-1 block">Provinsi</label><input value={addressForm.province} onChange={(e) => setAddressForm((prev) => ({ ...prev, province: e.target.value }))} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" /></div>
              <div><label className="text-sm font-medium mb-1 block">Kota/Kabupaten</label><input value={addressForm.city} onChange={(e) => setAddressForm((prev) => ({ ...prev, city: e.target.value }))} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" /></div>
              <div className="md:col-span-2"><label className="text-sm font-medium mb-1 block">Kecamatan/Distrik</label><input value={addressForm.district} onChange={(e) => setAddressForm((prev) => ({ ...prev, district: e.target.value }))} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" /></div>
              <div className="md:col-span-2"><label className="text-sm font-medium mb-1 block">Alamat Lengkap</label><textarea value={addressForm.full_address} onChange={(e) => setAddressForm((prev) => ({ ...prev, full_address: e.target.value }))} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" rows={3} /></div>
              <label className="md:col-span-2 flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={addressForm.is_default} onChange={(e) => setAddressForm((prev) => ({ ...prev, is_default: e.target.checked }))} />
                Jadikan alamat default
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={resetAddressForm} className="px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-100 dark:hover:bg-zinc-800">Batal</button>
              <button onClick={handleSaveAddress} disabled={isSavingAddress} className="bg-[var(--color-leaf-600)] text-white px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50">
                {isSavingAddress ? "Menyimpan..." : "Simpan Alamat"}
              </button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}
