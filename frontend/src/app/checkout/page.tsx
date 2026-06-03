"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CreditCard, Leaf, MapPin, Truck } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { CartSkeleton, Spinner } from "@/components/ui/loading";
import type { Address, Cart } from "@/types";

type ProvinceOption = {
  province_id: string;
  province: string;
};

type CityOption = {
  city_id: string;
  city_name: string;
  postal_code: string;
  type: string;
};

type ShippingCostOption = {
  service: string;
  description: string;
  cost: Array<{
    value: number;
    etd: string;
  }>;
};

type CouponPreview = {
  code: string;
  description?: string;
  discount: number;
};

const readApiError = (error: any, fallback: string) => {
  const message = error?.response?.data?.error;
  return typeof message === "string" && message.trim() ? message : fallback;
};

type CheckoutForm = {
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  province_id: string;
  city_id: string;
  courier: string;
  courier_service: string;
  shipping_cost: number;
  shipping_insurance: boolean;
  insurance_cost: number;
  packing_type: string;
  packing_cost: number;
  live_plant_note: string;
  coupon_code: string;
  payment_method: string;
  note: string;
};

const emptyForm: CheckoutForm = {
  shipping_name: "",
  shipping_phone: "",
  shipping_address: "",
  province_id: "",
  city_id: "",
  courier: "",
  courier_service: "",
  shipping_cost: 0,
  shipping_insurance: false,
  insurance_cost: 0,
  packing_type: "standard",
  packing_cost: 0,
  live_plant_note: "",
  coupon_code: "",
  payment_method: "manual_bank_transfer",
  note: "",
};

const paymentMethods = [
  { value: "manual_bank_transfer", title: "Transfer Bank Manual", description: "Transfer lalu unggah bukti pembayaran." },
  { value: "midtrans_bank_transfer", title: "Virtual Account", description: "VA bank via Midtrans." },
  { value: "midtrans_ewallet", title: "E-Wallet", description: "GoPay atau ShopeePay via Midtrans." },
  { value: "midtrans_card", title: "Kartu Kredit/Debit", description: "Kartu Visa/Mastercard via Midtrans Snap." },
];

const courierOptions = [
  { value: "jne", label: "JNE" },
  { value: "jnt", label: "J&T" },
  { value: "sicepat", label: "SiCepat" },
  { value: "anteraja", label: "AnterAja" },
  { value: "pos", label: "POS" },
];

const defaultCourier = "jne";

const normalizeLocationName = (value?: string) =>
  (value || "")
    .toLowerCase()
    .replace(/\b(kota|kabupaten|kab\.?|kodya)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const readRajaResults = <T,>(payload: unknown): T[] => {
  const data = payload as { rajaongkir?: { results?: T[] }; data?: T[] };
  if (Array.isArray(data.rajaongkir?.results)) return data.rajaongkir.results;
  if (Array.isArray(data.data)) return data.data;
  return [];
};

const readRajaCosts = (payload: unknown): ShippingCostOption[] => {
  const results = readRajaResults<{ costs?: ShippingCostOption[] }>(payload);
  return results[0]?.costs ?? [];
};

const readStoredCheckoutIds = () => {
  try {
    const value = sessionStorage.getItem("checkout_cart_item_ids");
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
};

export default function CheckoutPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [selectedCartItemIds, setSelectedCartItemIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [shippingCosts, setShippingCosts] = useState<ShippingCostOption[]>([]);
  const [isCalcShipping, setIsCalcShipping] = useState(false);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null);
  const [formData, setFormData] = useState<CheckoutForm>(emptyForm);
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const cartItems = useMemo(() => cart?.items ?? [], [cart]);
  const checkoutItems = useMemo(
    () => cartItems.filter((item) => selectedCartItemIds.includes(item.id)),
    [cartItems, selectedCartItemIds],
  );
  const subtotal = checkoutItems.reduce((total, item) => total + item.product.price * item.quantity, 0);
  const totalWeight = checkoutItems.reduce((total, item) => total + item.quantity * (item.product.weight_gram || 1000), 0) || 1000;
  const appliedDiscount = couponPreview?.discount || 0;
  const total = subtotal + formData.shipping_cost + formData.insurance_cost + formData.packing_cost - appliedDiscount;

  useEffect(() => {
    setCouponPreview((prev) => {
      if (!prev) return prev;
      if (prev.code !== formData.coupon_code.trim().toUpperCase()) return null;
      return prev;
    });
  }, [formData.coupon_code, subtotal]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    const selectedIds = readStoredCheckoutIds();
    setSelectedCartItemIds(selectedIds);
    if (selectedIds.length === 0) {
      router.push("/cart");
      return;
    }

    const fetchData = async () => {
      try {
        const [cartRes, provRes, addressRes] = await Promise.allSettled([
          api.get("/cart"),
          api.get("/shipping/provinces"),
          api.get("/addresses"),
        ]);

        if (cartRes.status === "fulfilled") {
          const nextCart = cartRes.value.data?.data;
          setCart(nextCart ? { ...nextCart, items: nextCart.items ?? [] } : null);
        }
        if (provRes.status === "fulfilled") {
          setProvinces(readRajaResults<ProvinceOption>(provRes.value.data));
        }
        if (addressRes.status === "fulfilled") {
          const savedAddresses = addressRes.value.data.data || [];
          setAddresses(savedAddresses);
          const defaultAddress = savedAddresses.find((address: Address) => address.is_default) || savedAddresses[0];
          if (defaultAddress) setSelectedAddressId(defaultAddress.id);
        }
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, [isAuthenticated, router]);

  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId) || null,
    [addresses, selectedAddressId],
  );

  useEffect(() => {
    if (!selectedAddress) return;

    const matchedProvince = provinces.find((province) =>
      province.province_id === selectedAddress.province_id ||
      province.province.toLowerCase() === selectedAddress.province.toLowerCase(),
    );

    setFormData((prev) => ({
      ...prev,
      shipping_name: selectedAddress.recipient_name,
      shipping_phone: selectedAddress.phone,
      shipping_address: selectedAddress.full_address,
      province_id: matchedProvince?.province_id || selectedAddress.province_id || "",
      city_id: "",
      courier: prev.courier || defaultCourier,
      shipping_cost: 0,
      courier_service: "",
    }));
    setShippingCosts([]);
  }, [provinces, selectedAddress]);

  useEffect(() => {
    if (!formData.province_id) {
      setCities([]);
      return;
    }

    const fetchCities = async () => {
      try {
        const response = await api.get(`/shipping/cities/${formData.province_id}`);
        const nextCities = readRajaResults<CityOption>(response.data);
        setCities(nextCities);

        if (!selectedAddress) return;
        const selectedAddressCity = normalizeLocationName(selectedAddress.city);
        const matchedCity = nextCities.find((city) =>
          city.city_id === selectedAddress.city_id ||
          normalizeLocationName(city.city_name) === selectedAddressCity ||
          normalizeLocationName(`${city.type} ${city.city_name}`) === selectedAddressCity,
        );
        if (matchedCity) {
          setFormData((prev) => ({ ...prev, city_id: matchedCity.city_id }));
        }
      } catch {
        setCities([]);
      }
    };

    void fetchCities();
  }, [formData.province_id, selectedAddress]);

  useEffect(() => {
    if (!formData.city_id || !formData.courier || checkoutItems.length === 0) return;

    let active = true;
    setShippingCosts([]);
    setFormData((prev) => ({
      ...prev,
      shipping_cost: 0,
      courier_service: "",
    }));

    const fetchShippingCost = async () => {
      setIsCalcShipping(true);
      try {
        const requestedCourier = formData.courier;
        const requestedCityID = formData.city_id;
        const response = await api.post("/shipping/cost", {
          origin: "152",
          destination: requestedCityID,
          weight: totalWeight,
          courier: requestedCourier,
        });
        if (!active) return;
        const costs = readRajaCosts(response.data);
        setShippingCosts(costs);
        if (costs.length > 0) {
          setFormData((prev) => ({
            ...prev,
            courier: requestedCourier,
            city_id: requestedCityID,
            shipping_cost: costs[0].cost[0].value,
            courier_service: costs[0].service,
          }));
        }
      } finally {
        if (active) setIsCalcShipping(false);
      }
    };

    void fetchShippingCost();
    return () => {
      active = false;
    };
  }, [checkoutItems.length, formData.city_id, formData.courier, totalWeight]);

  const setField = <K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handlePreviewCoupon = async () => {
    const code = formData.coupon_code.trim().toUpperCase();
    if (!code) {
      setCouponPreview(null);
      alert("Masukkan kode kupon terlebih dahulu.");
      return;
    }
    if (subtotal <= 0) {
      setCouponPreview(null);
      alert("Subtotal belum valid untuk menghitung kupon.");
      return;
    }

    setIsApplyingCoupon(true);
    try {
      const response = await api.post("/coupons/preview", {
        code,
        subtotal,
      });
      const data = response.data.data;
      setCouponPreview({
        code: data.code,
        description: data.description,
        discount: Number(data.discount || 0),
      });
    } catch (e: any) {
      setCouponPreview(null);
      alert("Kupon tidak bisa dipakai: " + readApiError(e, "Silakan cek kembali kode kupon Anda."));
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleCheckout = async () => {
    if (checkoutItems.length === 0) {
      alert("Item pembayaran kosong. Pilih item dari keranjang terlebih dahulu.");
      router.push("/cart");
      return;
    }
    if (!formData.city_id || formData.shipping_cost === 0 || !formData.courier_service) {
      alert("Harap lengkapi alamat, ekspedisi, dan layanan pengiriman.");
      return;
    }
    if (!formData.shipping_name || !formData.shipping_phone || !formData.shipping_address) {
      alert("Harap isi nama, telepon, dan alamat penerima.");
      return;
    }

    setIsCheckingOut(true);
    try {
      const selectedProvince = provinces.find((province) => province.province_id === formData.province_id);
      const selectedCity = cities.find((city) => city.city_id === formData.city_id);

      const response = await api.post("/orders", {
        cart_item_ids: selectedCartItemIds,
        shipping_name: formData.shipping_name,
        shipping_phone: formData.shipping_phone,
        shipping_address: formData.shipping_address,
        destination_province_id: formData.province_id,
        destination_city_id: formData.city_id,
        shipping_city: selectedCity?.city_name || "",
        shipping_province: selectedProvince?.province || "",
        shipping_postal_code: selectedCity?.postal_code || "00000",
        courier_code: formData.courier,
        courier_service: formData.courier_service,
        shipping_cost: formData.shipping_cost,
        shipping_insurance: formData.shipping_insurance,
        insurance_cost: formData.insurance_cost,
        packing_type: formData.packing_type,
        packing_cost: formData.packing_cost,
        live_plant_note: formData.live_plant_note,
        coupon_code: formData.coupon_code,
        payment_method: formData.payment_method,
        note: formData.note,
      });

      sessionStorage.removeItem("checkout_cart_item_ids");
      if (response.data.payment_url) {
        window.location.href = response.data.payment_url;
      } else {
        const createdOrder = response.data.data;
        router.push(createdOrder?.id ? `/orders/${createdOrder.id}` : "/orders");
      }
    } catch (e: any) {
      alert(readApiError(e, "Terjadi kendala saat memproses pembayaran. Silakan coba lagi."));
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <Link href="/cart" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[var(--color-brand-600)] mb-6">
          <ArrowLeft className="w-4 h-4" /> Kembali ke keranjang
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight mb-8">Pembayaran</h1>

        {isLoading ? (
          <CartSkeleton count={2} />
        ) : checkoutItems.length === 0 ? (
          <div className="text-center py-20 glass rounded-3xl">
            <Leaf className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Item pembayaran kosong</h2>
            <p className="text-gray-500 mb-8">Pilih item dari keranjang terlebih dahulu sebelum melanjutkan proses pembayaran.</p>
            <Link href="/cart" className="bg-black text-white dark:bg-white dark:text-black px-6 py-3 rounded-xl font-bold inline-flex items-center gap-2">Buka Keranjang</Link>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 flex flex-col gap-6">
              <div className="glass p-6 rounded-2xl">
                <h2 className="text-lg font-bold mb-4">Item yang Diproses</h2>
                <div className="flex flex-col gap-3">
                  {checkoutItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-800 p-3">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden shrink-0">
                        <img src={item.product.images?.[0]?.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.product.name)}&background=random`} alt={item.product.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm truncate">{item.product.name}</div>
                        <div className="text-xs text-gray-500">{item.quantity} x Rp {item.product.price.toLocaleString("id-ID")}</div>
                      </div>
                      <div className="font-bold text-sm">Rp {(item.quantity * item.product.price).toLocaleString("id-ID")}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass p-6 rounded-2xl">
                <h3 className="text-lg font-bold mb-5 flex items-center gap-2"><MapPin className="w-5 h-5 text-[var(--color-leaf-600)]" /> Pengiriman</h3>

                <div className="mb-5">
                  <div className="flex items-center justify-between mb-3 gap-4">
                    <h4 className="font-semibold text-sm">Alamat Tersimpan</h4>
                    <Link href="/profile" className="text-sm font-medium text-[var(--color-brand-600)] hover:underline">Kelola Alamat</Link>
                  </div>
                  {addresses.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-4 text-sm text-gray-500">
                      Belum ada alamat tersimpan. Tambahkan alamat di halaman profil atau isi form manual di bawah.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {addresses.map((address) => (
                        <button
                          key={address.id}
                          type="button"
                          onClick={() => setSelectedAddressId(address.id)}
                          className={`w-full text-left rounded-xl border p-4 transition-colors ${selectedAddressId === address.id ? "border-[var(--color-leaf-500)] bg-[var(--color-leaf-50)] dark:bg-[var(--color-leaf-900)]/20" : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-900"}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-sm">{address.label || "Alamat"}</span>
                            {address.is_default && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 text-[var(--color-leaf-600)]">Default</span>}
                            {selectedAddressId === address.id && <CheckCircle2 className="w-4 h-4 text-[var(--color-leaf-600)] ml-auto" />}
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-200">{address.recipient_name} - {address.phone}</p>
                          <p className="text-sm text-gray-500">{address.full_address}</p>
                          <p className="text-sm text-gray-500">{address.city}, {address.province} {address.postal_code}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium mb-1 block">Nama Penerima</label><input value={formData.shipping_name} onChange={(e) => setField("shipping_name", e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" placeholder="Nama lengkap" /></div>
                  <div><label className="text-sm font-medium mb-1 block">No. Telepon</label><input value={formData.shipping_phone} onChange={(e) => setField("shipping_phone", e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" placeholder="08xxxxxxxxxx" /></div>
                  <div className="md:col-span-2"><label className="text-sm font-medium mb-1 block">Alamat Lengkap</label><textarea value={formData.shipping_address} onChange={(e) => setField("shipping_address", e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" rows={2} placeholder="Jl., RT/RW, Kel., Kec." /></div>
                  <div><label className="text-sm font-medium mb-1 block">Provinsi</label><select value={formData.province_id} onChange={(e) => { setField("province_id", e.target.value); setField("city_id", ""); setField("shipping_cost", 0); setField("courier_service", ""); setShippingCosts([]); }} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm"><option value="">Pilih Provinsi</option>{provinces.map((province) => <option key={province.province_id} value={province.province_id}>{province.province}</option>)}</select></div>
                  <div><label className="text-sm font-medium mb-1 block">Kota/Kabupaten</label><select value={formData.city_id} onChange={(e) => { setField("city_id", e.target.value); setField("shipping_cost", 0); setField("courier_service", ""); }} disabled={!formData.province_id} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm disabled:opacity-50"><option value="">Pilih Kota</option>{cities.map((city) => <option key={city.city_id} value={city.city_id}>{city.type} {city.city_name}</option>)}</select></div>
                  <div className="md:col-span-2"><label className="text-sm font-medium mb-1 block">Ekspedisi</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">{courierOptions.map((courier) => (<button key={courier.value} type="button" onClick={() => { setField("courier", courier.value); setField("shipping_cost", 0); setField("courier_service", ""); setShippingCosts([]); }} className={`py-3 px-2 border rounded-xl font-bold text-sm transition-all ${formData.courier === courier.value ? "border-[var(--color-brand-500)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)]" : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-800"}`}>{courier.label}</button>))}</div>
                  </div>
                  {isCalcShipping && <div className="md:col-span-2 flex items-center justify-center gap-2 py-2 text-sm text-gray-500"><Spinner className="h-4 w-4 text-[var(--color-leaf-600)]" /> Menghitung ongkir...</div>}
                  {!isCalcShipping && shippingCosts.length > 0 && formData.courier && (
                    <div className="md:col-span-2"><label className="text-sm font-medium mb-2 block">Layanan</label>
                      <div className="flex flex-col gap-2">{shippingCosts.map((cost) => (
                        <button key={`${cost.service}-${cost.description}`} type="button" onClick={() => { setField("shipping_cost", cost.cost[0].value); setField("courier_service", cost.service); }} className={`p-3 border rounded-xl flex justify-between cursor-pointer transition-colors text-sm ${formData.shipping_cost === cost.cost[0].value && formData.courier_service === cost.service ? "border-[var(--color-leaf-500)] bg-[var(--color-leaf-50)] dark:bg-[var(--color-leaf-900)]/20" : "border-gray-200 dark:border-gray-800"}`}>
                          <div><div className="font-bold">{cost.service}</div><div className="text-xs text-gray-500">{cost.description} ({cost.cost[0].etd} hari)</div></div>
                          <div className="font-bold text-[var(--color-brand-600)]">Rp {cost.cost[0].value.toLocaleString("id-ID")}</div>
                        </button>
                      ))}</div>
                    </div>
                  )}
                  <div className="md:col-span-2"><label className="text-sm font-medium mb-1 block">Catatan</label><input value={formData.note} onChange={(e) => setField("note", e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" placeholder="Catatan untuk penjual (opsional)" /></div>
                  <div><label className="text-sm font-medium mb-1 block">Packing</label><select value={formData.packing_type} onChange={(e) => { const premium = e.target.value === "premium"; setField("packing_type", e.target.value); setField("packing_cost", premium ? 15000 : 0); }} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm"><option value="standard">Standard</option><option value="premium">Premium tanaman hidup (+Rp 15.000)</option></select></div>
                  <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 p-3 text-sm"><input type="checkbox" checked={formData.shipping_insurance} onChange={(e) => { setField("shipping_insurance", e.target.checked); setField("insurance_cost", e.target.checked ? Math.ceil(subtotal * 0.005) : 0); }} /> Tambahkan asuransi pengiriman</label>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Kupon</label>
                    <div className="flex gap-2">
                      <input value={formData.coupon_code} onChange={(e) => setField("coupon_code", e.target.value.toUpperCase())} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" placeholder="Kode kupon" />
                      <button type="button" onClick={handlePreviewCoupon} disabled={isApplyingCoupon || !formData.coupon_code.trim()} className="shrink-0 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3 text-sm font-bold hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50">
                        {isApplyingCoupon ? "Cek..." : "Pakai"}
                      </button>
                    </div>
                    {couponPreview && (
                      <p className="mt-2 text-xs font-medium text-emerald-600">
                        {couponPreview.code} aktif. Diskon Rp {couponPreview.discount.toLocaleString("id-ID")}
                        {couponPreview.description ? ` - ${couponPreview.description}` : ""}
                      </p>
                    )}
                  </div>
                  <div><label className="text-sm font-medium mb-1 block">Catatan tanaman hidup</label><input value={formData.live_plant_note} onChange={(e) => setField("live_plant_note", e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" placeholder="Instruksi packing/handling" /></div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium mb-2 block">Metode Pembayaran</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {paymentMethods.map((method) => (
                        <button key={method.value} type="button" onClick={() => setField("payment_method", method.value)} className={`text-left rounded-xl border p-4 transition-colors ${formData.payment_method === method.value ? "border-[var(--color-brand-500)] bg-[var(--color-brand-50)] dark:bg-[var(--color-brand-900)]/20" : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-900"}`}>
                          <div className="font-bold text-sm">{method.title}</div>
                          <div className="text-xs text-gray-500 mt-1 leading-relaxed">{method.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-[380px]">
              <div className="glass p-6 rounded-2xl sticky top-24">
                <h2 className="text-lg font-bold mb-4 border-b border-gray-200 dark:border-gray-800 pb-4">Ringkasan Pembayaran</h2>
                <div className="flex justify-between mb-3 text-sm text-gray-600 dark:text-gray-300"><span>Subtotal ({checkoutItems.length} produk)</span><span>Rp {subtotal.toLocaleString("id-ID")}</span></div>
                <div className="flex justify-between mb-3 text-sm text-gray-600 dark:text-gray-300"><span className="flex items-center gap-1"><Truck className="w-4 h-4" /> Ongkir</span><span>Rp {formData.shipping_cost.toLocaleString("id-ID")}</span></div>
                <div className="flex justify-between mb-3 text-sm text-gray-600 dark:text-gray-300"><span>Packing</span><span>Rp {formData.packing_cost.toLocaleString("id-ID")}</span></div>
                <div className="flex justify-between mb-3 text-sm text-gray-600 dark:text-gray-300"><span>Asuransi</span><span>Rp {formData.insurance_cost.toLocaleString("id-ID")}</span></div>
                {appliedDiscount > 0 && <div className="flex justify-between mb-3 text-sm text-emerald-600"><span>Diskon Kupon</span><span>- Rp {appliedDiscount.toLocaleString("id-ID")}</span></div>}
                <div className="flex justify-between mb-6 pb-6 border-b border-gray-200 dark:border-gray-800 font-extrabold text-lg"><span>Total</span><span className="text-[var(--color-leaf-600)]">Rp {total.toLocaleString("id-ID")}</span></div>
                <button onClick={handleCheckout} disabled={isCheckingOut || formData.shipping_cost === 0 || !formData.courier_service} className="w-full bg-black text-white dark:bg-white dark:text-black py-4 rounded-xl flex items-center justify-center gap-2 font-bold hover:scale-[1.02] transition-transform disabled:opacity-50">
                  {isCheckingOut ? <Spinner /> : <CreditCard className="w-5 h-5" />} {isCheckingOut ? "Memproses..." : "Bayar Sekarang"}
                </button>
                <p className="text-xs text-gray-400 text-center mt-3">
                  {formData.payment_method.startsWith("midtrans") ? "Pembayaran online diproses melalui Midtrans." : "Pesanan dibuat dengan batas pembayaran 24 jam."}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
