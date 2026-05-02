"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { ShoppingCart, Info, CheckCircle2, Tag, Leaf, Ruler, Flower2, Weight, Heart, Star, ArrowRight } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { motion } from "framer-motion";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { resolveUploadURL } from "@/lib/uploads";
import type { Product, Review } from "@/types";

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const [productRes, reviewRes, productsRes] = await Promise.allSettled([
          api.get(`/products/${id}`),
          api.get(`/reviews/product/${id}`),
          api.get("/products"),
        ]);
        if (productRes.status !== "fulfilled") return;

        const nextProduct = productRes.value.data.data as Product;
        const productList = productsRes.status === "fulfilled" ? (productsRes.value.data.data || []) as Product[] : [];
        const currentID = String(id);
        const currentCategoryKey = nextProduct.category_id || nextProduct.category?.id || nextProduct.category?.slug || nextProduct.category?.name;
        const sameCategory = productList.filter((item) => {
          const categoryKey = item.category_id || item.category?.id || item.category?.slug || item.category?.name;
          return item.id !== currentID && categoryKey && categoryKey === currentCategoryKey;
        });
        const otherProducts = productList.filter((item) => item.id !== currentID && !sameCategory.some((related) => related.id === item.id));

        setProduct(nextProduct);
        setReviews(reviewRes.status === "fulfilled" ? reviewRes.value.data.data || [] : []);
        setRelatedProducts([...sameCategory, ...otherProducts].slice(0, 8));

        if (isAuthenticated) {
          const wishlistRes = await api.get(`/wishlist/${id}/status`);
          setWishlisted(Boolean(wishlistRes.data.data?.wishlisted));
        }
      } catch {
        // keep fallback UI
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      void fetchDetail();
    }
  }, [id, isAuthenticated]);

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    if (!product?.id) {
      alert("Produk belum siap dimasukkan ke keranjang.");
      return;
    }
    if (quantity < 1 || quantity > stock) {
      alert("Jumlah produk tidak valid atau melebihi stok.");
      return;
    }
    setIsAdding(true);
    try {
      await api.post("/cart/items", { product_id: product.id, quantity, note });
      setAddedSuccess(true);
      setTimeout(() => setAddedSuccess(false), 3000);
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
      } else {
        alert("Gagal: " + (e.response?.data?.error || e.message));
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleWishlist = async () => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    try {
      if (wishlisted) {
        await api.delete(`/wishlist/${product!.id}`);
        setWishlisted(false);
      } else {
        await api.post("/wishlist", { product_id: product!.id });
        setWishlisted(true);
      }
    } catch (e: any) {
      alert("Gagal mengubah wishlist: " + (e.response?.data?.error || e.message));
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-[var(--bg)]">
        <Navbar />
        <div className="flex-1 flex items-center justify-center"><div className="w-12 h-12 border-4 border-gray-200 border-t-[var(--color-leaf-500)] rounded-full animate-spin" /></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col min-h-screen bg-[var(--bg)]">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <Leaf className="w-16 h-16 text-gray-300 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Produk tidak ditemukan</h1>
          <Link href="/products" className="text-[var(--color-brand-600)] font-medium hover:underline">Kembali ke Katalog</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const imgUrl = productImageURL(product);
  const stock = product.inventory?.quantity || 0;

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-[var(--color-brand-600)]">Home</Link>
          <span>/</span>
          <Link href="/products" className="hover:text-[var(--color-brand-600)]">Katalog</Link>
          <span>/</span>
          <span className="text-[var(--fg)] font-medium truncate max-w-[200px]">{product.name}</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-10">
          <div className="w-full lg:w-1/2">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass p-2 rounded-3xl aspect-square overflow-hidden relative bg-white/50 dark:bg-black/50">
              {product.unit_type === "PER_BATCH" && (
                <div className="absolute top-4 left-4 z-10 bg-[var(--color-leaf-500)] text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-lg"><Tag className="w-3 h-3" /> Grosir (B2B)</div>
              )}
              <img src={imgUrl} alt={product.name} className="w-full h-full object-cover rounded-2xl" />
            </motion.div>
            {product.images && product.images.length > 1 && (
              <div className="flex gap-2 mt-3">
                {product.images.slice(0, 5).map((img) => (
                  <div key={img.id} className="w-16 h-16 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-800 cursor-pointer hover:border-[var(--color-brand-500)] transition-colors">
                    <img src={img.image_url} alt={img.alt_text || product.name} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="w-full lg:w-1/2 flex flex-col">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="text-xs font-bold text-[var(--color-leaf-600)] uppercase tracking-wider mb-2">{product.category?.name || "Anggrek"} • {product.unit_type.replace(/_/g, " ")}</div>
              <h1 className="text-3xl lg:text-4xl font-black tracking-tight leading-tight mb-2">{product.name}</h1>
              {product.variety_name && <p className="text-gray-500 italic mb-4">{product.variety_name}</p>}
              <div className="text-3xl font-extrabold text-[var(--color-brand-600)] mb-6 py-4 border-y border-gray-200 dark:border-gray-800">Rp {product.price.toLocaleString("id-ID")}</div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-white/60 dark:bg-black/40 border border-gray-100 dark:border-gray-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span className="text-sm font-medium">Stok: {stock}</span>
                </div>
                {product.size && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-white/60 dark:bg-black/40 border border-gray-100 dark:border-gray-800">
                    <Ruler className="w-5 h-5 text-blue-500 shrink-0" />
                    <span className="text-sm font-medium capitalize">{product.size}</span>
                  </div>
                )}
                {product.condition && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-white/60 dark:bg-black/40 border border-gray-100 dark:border-gray-800">
                    <Flower2 className="w-5 h-5 text-pink-500 shrink-0" />
                    <span className="text-sm font-medium capitalize">{product.condition}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 p-3 rounded-xl bg-white/60 dark:bg-black/40 border border-gray-100 dark:border-gray-800">
                  <Weight className="w-5 h-5 text-gray-500 shrink-0" />
                  <span className="text-sm font-medium">{product.weight_gram || 500}g</span>
                </div>
              </div>

              <div className="glass p-5 rounded-2xl mb-6">
                <h3 className="font-bold flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-3 mb-3"><Info className="w-5 h-5" /> Deskripsi</h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">{product.description || "Anggrek subur dan dijamin kesehatannya. Tanaman siap adaptasi ke lingkungan baru."}</p>
              </div>

              {product.care_tips && (
                <div className="glass p-5 rounded-2xl mb-6">
                  <h3 className="font-bold flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-3 mb-3"><Leaf className="w-5 h-5 text-[var(--color-leaf-500)]" /> Tips Perawatan</h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">{product.care_tips}</p>
                </div>
              )}

              <div className="glass p-5 rounded-2xl mb-6">
                <h3 className="font-bold flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-3 mb-3"><Star className="w-5 h-5 text-amber-500" /> Review Pelanggan</h3>
                {reviews.length === 0 ? (
                  <p className="text-sm text-gray-500">Belum ada review untuk produk ini.</p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {reviews.slice(0, 5).map((review) => (
                      <div key={review.id} className="border border-gray-100 dark:border-gray-800 rounded-xl p-4">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="font-semibold text-sm">{review.user?.full_name || "Pelanggan"}</div>
                          <div className="text-sm font-bold text-amber-500">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{review.comment || "Tanpa komentar"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm sticky top-24">
              <h3 className="font-bold mb-4">Atur Pesanan</h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="border border-gray-300 dark:border-gray-700 rounded-xl flex items-center overflow-hidden h-11 w-32">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-full flex items-center justify-center font-bold hover:bg-gray-100 dark:hover:bg-zinc-800">-</button>
                  <input type="number" readOnly value={quantity} className="w-12 h-full text-center border-x border-gray-300 dark:border-gray-700 bg-transparent font-bold outline-none" />
                  <button onClick={() => setQuantity(Math.min(stock || 99, quantity + 1))} className="w-10 h-full flex items-center justify-center font-bold hover:bg-gray-100 dark:hover:bg-zinc-800">+</button>
                </div>
                <div className="text-sm text-gray-500">Subtotal: <span className="font-bold text-[var(--fg)]">Rp {(product.price * quantity).toLocaleString("id-ID")}</span></div>
              </div>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan ke penjual (opsional)" className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm focus:ring-1 focus:ring-[var(--color-brand-500)] outline-none mb-4" />
              {addedSuccess && <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 p-3 rounded-xl text-sm font-medium mb-4 text-center border border-emerald-200 dark:border-emerald-800">Berhasil ditambahkan ke keranjang.</div>}
              <button onClick={handleToggleWishlist} className={`w-full py-3 mb-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-colors ${wishlisted ? "border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/20" : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-800"}`}>
                <Heart className={`w-5 h-5 ${wishlisted ? "fill-current" : ""}`} /> {wishlisted ? "Hapus dari Wishlist" : "Simpan ke Wishlist"}
              </button>
              <button onClick={handleAddToCart} disabled={isAdding || stock < 1} className="w-full py-3.5 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform disabled:opacity-50 shadow-lg">
                <ShoppingCart className="w-5 h-5" /> {stock < 1 ? "Stok Habis" : isAdding ? "Memproses..." : "Masukkan Keranjang"}
              </button>
            </motion.div>
          </div>
        </div>

        {relatedProducts.length > 0 && (
          <section className="mt-14 border-t border-gray-200 dark:border-gray-800 pt-10">
            <div className="flex items-end justify-between gap-4 mb-5">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">Produk Lainnya</h2>
                <p className="text-sm text-gray-500 mt-1">Lihat koleksi lain tanpa balik ke katalog.</p>
              </div>
              <Link href="/products" className="hidden sm:inline-flex items-center gap-1 text-sm font-bold text-[var(--color-brand-600)] hover:underline">
                Lihat katalog <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {relatedProducts.map((item, idx) => (
                <ProductSuggestionCard key={item.id} product={item} idx={idx} />
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

function ProductSuggestionCard({ product, idx }: { product: Product; idx: number }) {
  const imageURL = productImageURL(product);
  const stock = product.inventory?.quantity || 0;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
      <Link href={`/products/${product.id}`} className="group block rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 overflow-hidden hover:shadow-lg transition-shadow h-full">
        <div className="aspect-square bg-gray-100 dark:bg-gray-800 overflow-hidden relative">
          <img src={imageURL} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          {product.unit_type === "PER_BATCH" && <span className="absolute top-3 left-3 bg-[var(--color-leaf-500)] text-white text-[10px] font-bold px-2 py-1 rounded-md">B2B</span>}
        </div>
        <div className="p-4">
          <div className="text-xs text-gray-500 mb-1 truncate">{product.category?.name || "Anggrek"}</div>
          <h3 className="font-bold text-sm leading-tight line-clamp-2 min-h-10">{product.name}</h3>
          <div className="mt-3 flex items-end justify-between gap-2">
            <div className="text-[var(--color-brand-600)] font-extrabold text-sm">Rp {product.price.toLocaleString("id-ID")}</div>
            <div className="text-[11px] text-gray-400 shrink-0">{stock} stok</div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function productImageURL(product: Product) {
  const image = product.images?.find((item) => item.is_primary)?.image_url || product.images?.[0]?.image_url;
  return image ? resolveUploadURL(image) : `https://ui-avatars.com/api/?name=${encodeURIComponent(product.name)}&size=512&background=random`;
}
