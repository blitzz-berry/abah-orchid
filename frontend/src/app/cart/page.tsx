"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Leaf, ArrowLeft, Trash2, CreditCard, Truck, MapPin } from "lucide-react";
import api from "@/lib/api";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/useAuthStore";

export default function CartPage() {
  const [cart, setCart] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const router = useRouter();
  
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  // RajaOngkir States
  const [provinces, setProvinces] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [shippingCosts, setShippingCosts] = useState<any[]>([]);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);

  // Form States
  const [formData, setFormData] = useState({
    shipping_name: "Budi Anggrek",
    shipping_phone: "081234567890",
    shipping_address: "Komp. Flamboyan, Jl Anggrek Bulan No 1",
    province_id: "",
    city_id: "",
    courier: "",
    shipping_cost: 0,
    postal_code: "",
    note: "Tolong packing rapi ya!"
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    const fetchData = async () => {
      try {
        const [cartRes, provRes] = await Promise.all([
          api.get("/cart"),
          api.get("/shipping/provinces")
        ]);
        setCart(cartRes.data.data);
        setProvinces(provRes.data?.rajaongkir?.results || []);
      } catch (error) {
        console.error("Failed to fetch initial data", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [isAuthenticated, router]);

  // Fetch cities when province changes
  useEffect(() => {
    if (!formData.province_id) return;
    const fetchCities = async () => {
      try {
        const res = await api.get(`/shipping/cities?province=${formData.province_id}`);
        setCities(res.data?.rajaongkir?.results || []);
      } catch (e) {
        console.error("Failed fetching cities");
      }
    };
    fetchCities();
  }, [formData.province_id]);

  // Calculate shipping cost
  useEffect(() => {
    if (!formData.city_id || !formData.courier) return;
    
    // Estimate weight based on item count (assume 1 anggrek = 1000 gram / 1kg)
    const totalWeight = cart?.items?.reduce((acc: number, item: any) => acc + (item.quantity * 1000), 0) || 1000;

    const calcCost = async () => {
      setIsCalculatingShipping(true);
      try {
        const res = await api.post("/shipping/cost", {
          origin: "152", // Default origin Jakarta Pusat
          destination: formData.city_id,
          weight: totalWeight,
          courier: formData.courier
        });
        
        const costs = res.data?.rajaongkir?.results?.[0]?.costs || [];
        setShippingCosts(costs);
        
        // Auto select first cost
        if (costs.length > 0) {
          setFormData(prev => ({ 
            ...prev, 
            shipping_cost: costs[0].cost[0].value 
          }));
        }
      } catch (e) {
        console.error("Failed calculating cost");
      } finally {
        setIsCalculatingShipping(false);
      }
    };
    calcCost();
  }, [formData.city_id, formData.courier, cart]);

  const handleRemove = async (itemId: string) => {
    try {
      await api.delete(`/cart/${itemId}`);
      setCart((prev: any) => ({
        ...prev,
        items: prev.items.filter((i: any) => i.id !== itemId)
      }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCheckout = async () => {
    if (!formData.city_id || formData.shipping_cost === 0) {
      alert("Harap lengkapi alamat dan ekspedisi!");
      return;
    }

    setIsCheckingOut(true);
    try {
      const selectedProv = provinces.find(p => p.province_id === formData.province_id);
      const selectedCity = cities.find(c => c.city_id === formData.city_id);

      const checkoutPayload = {
        shipping_name: formData.shipping_name,
        shipping_phone: formData.shipping_phone,
        shipping_address: formData.shipping_address,
        shipping_city: selectedCity?.city_name || "Unknown",
        shipping_province: selectedProv?.province || "Unknown",
        shipping_postal_code: selectedCity?.postal_code || "00000",
        courier_code: formData.courier,
        courier_service: "REG",
        shipping_cost: formData.shipping_cost,
        note: formData.note
      };
      
      const res = await api.post("/orders/checkout", checkoutPayload);
      if (res.data.payment_url) {
        window.location.href = res.data.payment_url;
      }
    } catch (e: any) {
      alert("Checkout failed: " + (e.response?.data?.error || e.message));
    } finally {
      setIsCheckingOut(false);
    }
  };

  const cartSubtotal = cart?.items?.reduce((acc: number, item: any) => acc + (item.product.price * item.quantity), 0) || 0;
  const grandTotal = cartSubtotal + formData.shipping_cost;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] px-4 py-8">
      <nav className="glass fixed top-0 w-full z-50 flex items-center justify-between px-8 py-4 left-0">
        <Link href="/" className="flex items-center gap-2">
          <Leaf className="w-8 h-8 text-[var(--color-leaf-500)]" />
          <span className="text-2xl font-bold tracking-tight">OrchidMart</span>
        </Link>
        <Link href="/products" className="font-medium hover:text-[var(--color-leaf-600)] transition-colors flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Lanjut Belanja
        </Link>
      </nav>

      <main className="max-w-6xl mx-auto pt-24 pb-20">
        <h1 className="text-3xl font-extrabold tracking-tight mb-8">Keranjang & Pengiriman</h1>
        
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-[var(--color-leaf-500)] rounded-full animate-spin"></div>
          </div>
        ) : !cart || !cart.items || cart.items.length === 0 ? (
          <div className="text-center py-20 glass rounded-3xl">
            <Leaf className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Keranjang Kosong</h2>
            <p className="text-gray-500 mb-8">Yuk, cari varietas anggrek idamanmu dulu.</p>
            <Link href="/products" className="bg-[var(--color-leaf-600)] text-white px-6 py-3 rounded-xl font-bold">Mulai Belanja</Link>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                {cart.items.map((item: any, idx: number) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    key={item.id} 
                    className="glass p-4 rounded-2xl flex gap-6 items-center"
                  >
                    <div className="w-20 h-20 bg-gray-100 rounded-xl overflow-hidden shrink-0">
                      <img src={`https://ui-avatars.com/api/?name=${item.product.name}&background=random`} alt={item.product.name} className="w-full h-full object-cover"/>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg leading-tight">{item.product.name}</h3>
                      <div className="text-gray-500 text-sm mb-1">{item.quantity} x Rp {item.product.price.toLocaleString('id-ID')}</div>
                      <div className="font-extrabold text-[var(--color-brand-600)]">Rp {(item.quantity * item.product.price).toLocaleString('id-ID')}</div>
                    </div>
                    <button onClick={() => handleRemove(item.id)} className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </motion.div>
                ))}
              </div>

              {/* Shipping Form via RajaOngkir */}
              <div className="glass p-6 rounded-3xl mt-4">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><MapPin className="w-5 h-5 text-[var(--color-leaf-600)]"/> Tujuan Pengiriman</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Provinsi</label>
                    <select 
                      value={formData.province_id} 
                      onChange={e => setFormData({...formData, province_id: e.target.value, city_id: "", shipping_cost: 0})}
                      className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3"
                    >
                      <option value="">Pilih Provinsi</option>
                      {provinces.map(p => (
                        <option key={p.province_id} value={p.province_id}>{p.province}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Kota/Kabupaten</label>
                    <select 
                      value={formData.city_id} 
                      onChange={e => setFormData({...formData, city_id: e.target.value, shipping_cost: 0})}
                      disabled={!formData.province_id}
                      className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 disabled:opacity-50"
                    >
                      <option value="">Pilih Kota</option>
                      {cities.map(c => (
                        <option key={c.city_id} value={c.city_id}>{c.type} {c.city_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium mb-1 block">Ekspedisi (Via RajaOngkir)</label>
                    <div className="flex gap-4">
                      {["jne", "pos", "tiki"].map(c => (
                        <button
                          key={c}
                          onClick={() => setFormData({...formData, courier: c})}
                          className={`flex-1 py-3 border rounded-xl font-bold transition-all uppercase ${formData.courier === c ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)]' : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-800'}`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {isCalculatingShipping ? (
                    <div className="md:col-span-2 text-center text-gray-500 py-2 animate-pulse">Menghitung ongkir realtime...</div>
                  ) : shippingCosts.length > 0 && formData.courier ? (
                    <div className="md:col-span-2 mt-2">
                      <label className="text-sm font-medium mb-1 block">Pilih Layanan</label>
                      <div className="flex flex-col gap-2">
                        {shippingCosts.map((cost: any, idx: number) => (
                          <div 
                            key={idx} 
                            onClick={() => setFormData({...formData, shipping_cost: cost.cost[0].value})}
                            className={`p-4 border rounded-xl flex justify-between cursor-pointer transition-colors ${formData.shipping_cost === cost.cost[0].value ? 'border-[var(--color-leaf-500)] bg-[var(--color-leaf-50)] dark:bg-[var(--color-leaf-900)]/20' : 'border-gray-200 dark:border-gray-800'}`}
                          >
                            <div>
                              <div className="font-bold">{cost.service}</div>
                              <div className="text-xs text-gray-500">{cost.description} (Estimasi: {cost.cost[0].etd} hari)</div>
                            </div>
                            <div className="font-bold text-[var(--color-brand-600)]">
                              Rp {cost.cost[0].value.toLocaleString('id-ID')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            
            <div className="w-full lg:w-[400px]">
              <div className="glass p-6 rounded-3xl sticky top-28">
                <h2 className="text-xl font-bold mb-4 border-b border-gray-200 dark:border-gray-800 pb-4">Ringkasan Belanja</h2>
                <div className="flex justify-between mb-3 text-gray-600 dark:text-gray-300">
                  <span>Total Harga ({cart.items.length} Barang)</span>
                  <span>Rp {cartSubtotal.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between mb-6 text-gray-600 dark:text-gray-300">
                  <span className="flex items-center gap-1"><Truck className="w-4 h-4"/> Ongkos Kirim</span>
                  <span>Rp {formData.shipping_cost.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between mb-6 pb-6 border-b border-gray-200 dark:border-gray-800 font-extrabold text-lg">
                  <span>Total Tagihan</span>
                  <span className="text-2xl text-[var(--color-leaf-600)]">Rp {grandTotal.toLocaleString('id-ID')}</span>
                </div>
                
                <button 
                  onClick={handleCheckout}
                  disabled={isCheckingOut || formData.shipping_cost === 0}
                  className="w-full bg-black text-white dark:bg-white dark:text-black py-4 rounded-xl flex items-center justify-center gap-2 font-bold hover:scale-[1.02] transition-transform disabled:opacity-50"
                >
                  <CreditCard className="w-5 h-5" /> {isCheckingOut ? "Memproses Payload Midtrans..." : `Bayar via Midtrans`}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
