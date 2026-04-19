"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Leaf, Trash2, CreditCard, Truck, MapPin, Minus, Plus, ArrowRight } from "lucide-react";
import api from "@/lib/api";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/useAuthStore";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";

export default function CartPage() {
  const [cart, setCart] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [provinces, setProvinces] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [shippingCosts, setShippingCosts] = useState<any[]>([]);
  const [isCalcShipping, setIsCalcShipping] = useState(false);

  const [formData, setFormData] = useState({
    shipping_name: "", shipping_phone: "", shipping_address: "",
    province_id: "", city_id: "", courier: "", shipping_cost: 0, note: "",
  });

  useEffect(() => {
    if (!isAuthenticated) { router.push("/login"); return; }
    const fetchData = async () => {
      try {
        const [cartRes, provRes] = await Promise.allSettled([api.get("/cart"), api.get("/shipping/provinces")]);
        if (cartRes.status === "fulfilled") setCart(cartRes.value.data.data);
        if (provRes.status === "fulfilled") setProvinces(provRes.value.data?.rajaongkir?.results || []);
      } catch {} finally { setIsLoading(false); }
    };
    fetchData();
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!formData.province_id) return;
    const f = async () => { try { const r = await api.get(`/shipping/cities?province=${formData.province_id}`); setCities(r.data?.rajaongkir?.results || []); } catch {} };
    f();
  }, [formData.province_id]);

  useEffect(() => {
    if (!formData.city_id || !formData.courier) return;
    const w = cart?.items?.reduce((a: number, i: any) => a + (i.quantity * 1000), 0) || 1000;
    const f = async () => {
      setIsCalcShipping(true);
      try {
        const r = await api.post("/shipping/cost", { origin: "152", destination: formData.city_id, weight: w, courier: formData.courier });
        const costs = r.data?.rajaongkir?.results?.[0]?.costs || [];
        setShippingCosts(costs);
        if (costs.length > 0) setFormData(p => ({ ...p, shipping_cost: costs[0].cost[0].value }));
      } catch {} finally { setIsCalcShipping(false); }
    };
    f();
  }, [formData.city_id, formData.courier, cart]);

  const handleUpdateQty = async (itemId: string, newQty: number) => {
    if (newQty < 1) return;
    try {
      await api.put(`/cart/${itemId}`, { quantity: newQty });
      setCart((p: any) => ({ ...p, items: p.items.map((i: any) => i.id === itemId ? { ...i, quantity: newQty } : i) }));
    } catch {}
  };

  const handleRemove = async (itemId: string) => {
    try {
      await api.delete(`/cart/${itemId}`);
      setCart((p: any) => ({ ...p, items: p.items.filter((i: any) => i.id !== itemId) }));
    } catch {}
  };

  const handleCheckout = async () => {
    if (!formData.city_id || formData.shipping_cost === 0) { alert("Harap lengkapi alamat dan ekspedisi!"); return; }
    if (!formData.shipping_name || !formData.shipping_phone || !formData.shipping_address) { alert("Harap isi nama, telepon, dan alamat penerima!"); return; }
    setIsCheckingOut(true);
    try {
      const selProv = provinces.find(p => p.province_id === formData.province_id);
      const selCity = cities.find(c => c.city_id === formData.city_id);
      const res = await api.post("/orders/checkout", {
        shipping_name: formData.shipping_name, shipping_phone: formData.shipping_phone,
        shipping_address: formData.shipping_address, shipping_city: selCity?.city_name || "",
        shipping_province: selProv?.province || "", shipping_postal_code: selCity?.postal_code || "00000",
        courier_code: formData.courier, courier_service: "REG", shipping_cost: formData.shipping_cost, note: formData.note,
      });
      if (res.data.payment_url) window.location.href = res.data.payment_url;
      else router.push("/orders");
    } catch (e: any) {
      alert("Checkout gagal: " + (e.response?.data?.error || e.message));
    } finally { setIsCheckingOut(false); }
  };

  const sub = cart?.items?.reduce((a: number, i: any) => a + (i.product.price * i.quantity), 0) || 0;
  const total = sub + formData.shipping_cost;
  const setF = (k: string, v: any) => setFormData(p => ({ ...p, [k]: v }));

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <h1 className="text-3xl font-extrabold tracking-tight mb-8">Keranjang Belanja</h1>

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-gray-200 border-t-[var(--color-leaf-500)] rounded-full animate-spin" /></div>
        ) : !cart || !cart.items || cart.items.length === 0 ? (
          <div className="text-center py-20 glass rounded-3xl">
            <Leaf className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Keranjang Kosong</h2>
            <p className="text-gray-500 mb-8">Yuk, cari varietas anggrek idamanmu dulu.</p>
            <Link href="/products" className="bg-black text-white dark:bg-white dark:text-black px-6 py-3 rounded-xl font-bold inline-flex items-center gap-2">Mulai Belanja <ArrowRight className="w-4 h-4" /></Link>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 flex flex-col gap-6">
              {/* Cart Items */}
              <div className="flex flex-col gap-3">
                {cart.items.map((item: any, idx: number) => (
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} key={item.id} className="glass p-4 rounded-2xl flex gap-4 items-center">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden shrink-0">
                      <img src={item.product.images?.[0]?.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.product.name)}&background=random`} alt={item.product.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold leading-tight truncate">{item.product.name}</h3>
                      <div className="text-sm text-gray-500">Rp {item.product.price.toLocaleString("id-ID")} / item</div>
                      <div className="font-extrabold text-[var(--color-brand-600)]">Rp {(item.quantity * item.product.price).toLocaleString("id-ID")}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleUpdateQty(item.id, item.quantity - 1)} className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-800"><Minus className="w-3 h-3" /></button>
                      <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                      <button onClick={() => handleUpdateQty(item.id, item.quantity + 1)} className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-800"><Plus className="w-3 h-3" /></button>
                    </div>
                    <button onClick={() => handleRemove(item.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl"><Trash2 className="w-4 h-4" /></button>
                  </motion.div>
                ))}
              </div>

              {/* Shipping Form */}
              <div className="glass p-6 rounded-2xl">
                <h3 className="text-lg font-bold mb-5 flex items-center gap-2"><MapPin className="w-5 h-5 text-[var(--color-leaf-600)]" /> Pengiriman</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium mb-1 block">Nama Penerima</label><input value={formData.shipping_name} onChange={e => setF("shipping_name", e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" placeholder="Nama lengkap" /></div>
                  <div><label className="text-sm font-medium mb-1 block">No. Telepon</label><input value={formData.shipping_phone} onChange={e => setF("shipping_phone", e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" placeholder="08xxxxxxxxxx" /></div>
                  <div className="md:col-span-2"><label className="text-sm font-medium mb-1 block">Alamat Lengkap</label><textarea value={formData.shipping_address} onChange={e => setF("shipping_address", e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" rows={2} placeholder="Jl., RT/RW, Kel., Kec." /></div>
                  <div><label className="text-sm font-medium mb-1 block">Provinsi</label><select value={formData.province_id} onChange={e => { setF("province_id", e.target.value); setF("city_id", ""); setF("shipping_cost", 0); setShippingCosts([]); }} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm"><option value="">Pilih Provinsi</option>{provinces.map(p => <option key={p.province_id} value={p.province_id}>{p.province}</option>)}</select></div>
                  <div><label className="text-sm font-medium mb-1 block">Kota/Kabupaten</label><select value={formData.city_id} onChange={e => { setF("city_id", e.target.value); setF("shipping_cost", 0); }} disabled={!formData.province_id} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm disabled:opacity-50"><option value="">Pilih Kota</option>{cities.map(c => <option key={c.city_id} value={c.city_id}>{c.type} {c.city_name}</option>)}</select></div>
                  <div className="md:col-span-2"><label className="text-sm font-medium mb-1 block">Ekspedisi</label>
                    <div className="flex gap-3">{["jne", "pos", "tiki"].map(c => (<button key={c} onClick={() => setF("courier", c)} className={`flex-1 py-3 border rounded-xl font-bold text-sm uppercase transition-all ${formData.courier === c ? "border-[var(--color-brand-500)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)]" : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-800"}`}>{c}</button>))}</div>
                  </div>
                  {isCalcShipping && <div className="md:col-span-2 text-center text-gray-500 py-2 animate-pulse text-sm">Menghitung ongkir...</div>}
                  {!isCalcShipping && shippingCosts.length > 0 && formData.courier && (
                    <div className="md:col-span-2"><label className="text-sm font-medium mb-2 block">Layanan</label>
                      <div className="flex flex-col gap-2">{shippingCosts.map((cost: any, i: number) => (
                        <div key={i} onClick={() => setF("shipping_cost", cost.cost[0].value)} className={`p-3 border rounded-xl flex justify-between cursor-pointer transition-colors text-sm ${formData.shipping_cost === cost.cost[0].value ? "border-[var(--color-leaf-500)] bg-[var(--color-leaf-50)] dark:bg-[var(--color-leaf-900)]/20" : "border-gray-200 dark:border-gray-800"}`}>
                          <div><div className="font-bold">{cost.service}</div><div className="text-xs text-gray-500">{cost.description} ({cost.cost[0].etd} hari)</div></div>
                          <div className="font-bold text-[var(--color-brand-600)]">Rp {cost.cost[0].value.toLocaleString("id-ID")}</div>
                        </div>
                      ))}</div>
                    </div>
                  )}
                  <div className="md:col-span-2"><label className="text-sm font-medium mb-1 block">Catatan</label><input value={formData.note} onChange={e => setF("note", e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" placeholder="Catatan untuk penjual (opsional)" /></div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="w-full lg:w-[380px]">
              <div className="glass p-6 rounded-2xl sticky top-24">
                <h2 className="text-lg font-bold mb-4 border-b border-gray-200 dark:border-gray-800 pb-4">Ringkasan</h2>
                <div className="flex justify-between mb-3 text-sm text-gray-600 dark:text-gray-300"><span>Subtotal ({cart.items.length} item)</span><span>Rp {sub.toLocaleString("id-ID")}</span></div>
                <div className="flex justify-between mb-3 text-sm text-gray-600 dark:text-gray-300"><span className="flex items-center gap-1"><Truck className="w-4 h-4" /> Ongkir</span><span>Rp {formData.shipping_cost.toLocaleString("id-ID")}</span></div>
                <div className="flex justify-between mb-6 pb-6 border-b border-gray-200 dark:border-gray-800 font-extrabold text-lg"><span>Total</span><span className="text-[var(--color-leaf-600)]">Rp {total.toLocaleString("id-ID")}</span></div>
                <button onClick={handleCheckout} disabled={isCheckingOut || formData.shipping_cost === 0} className="w-full bg-black text-white dark:bg-white dark:text-black py-4 rounded-xl flex items-center justify-center gap-2 font-bold hover:scale-[1.02] transition-transform disabled:opacity-50">
                  <CreditCard className="w-5 h-5" /> {isCheckingOut ? "Memproses..." : "Bayar Sekarang"}
                </button>
                <p className="text-xs text-gray-400 text-center mt-3">Pembayaran diproses melalui Midtrans</p>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
