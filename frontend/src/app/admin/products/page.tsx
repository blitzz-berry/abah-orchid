"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { AlertCircle, Edit2, ImagePlus, PackagePlus, Plus, Search, Trash2, X } from "lucide-react";
import { motion } from "framer-motion";
import { Spinner, TableRowsSkeleton } from "@/components/ui/loading";
import type { Category, Product } from "@/types";

type NewProductImage = {
  key: string;
  file: File;
  previewURL: string;
};

type ProductForm = {
  id?: string;
  name: string;
  variety_name: string;
  description: string;
  price: number;
  unit_type: "PER_POHON" | "PER_BATCH" | "PER_VARIETAS";
  category_id: string;
  weight_gram: number;
  size: string;
  condition: string;
  batch_quantity: number;
  care_tips: string;
  tags: string;
  status: "active" | "inactive" | "draft";
  inventory: {
    quantity: number;
    low_stock_threshold: number;
  };
};

const emptyForm: ProductForm = {
  name: "",
  variety_name: "",
  description: "",
  price: 0,
  unit_type: "PER_POHON",
  category_id: "",
  weight_gram: 500,
  size: "",
  condition: "",
  batch_quantity: 1,
  care_tips: "",
  tags: "",
  status: "active",
  inventory: {
    quantity: 0,
    low_stock_threshold: 5,
  },
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [formData, setFormData] = useState<ProductForm>(emptyForm);
  const [newProductImages, setNewProductImages] = useState<NewProductImage[]>([]);
  const [newProductPrimaryImageKey, setNewProductPrimaryImageKey] = useState<string>("");
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [stockData, setStockData] = useState({ quantity: 0, low_stock_threshold: 5, note: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editUploadImages, setEditUploadImages] = useState<NewProductImage[]>([]);
  const [editUploadPrimaryKey, setEditUploadPrimaryKey] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const [productRes, categoryRes] = await Promise.allSettled([
        api.get("/admin/products", { params: { include_inactive: true, per_page: 100 } }),
        api.get("/admin/categories"),
      ]);
      if (productRes.status === "fulfilled") setProducts(productRes.value.data.data || []);
      if (categoryRes.status === "fulfilled") setCategories(categoryRes.value.data.data || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchProducts();
  }, []);

  const filtered = useMemo(() => {
    return products.filter((product) => {
      const haystack = `${product.name} ${product.variety_name || ""} ${product.category?.name || ""}`.toLowerCase();
      if (search && !haystack.includes(search.toLowerCase())) return false;
      if (statusFilter && product.status !== statusFilter) return false;
      return true;
    });
  }, [products, search, statusFilter]);

  const openCreateModal = () => {
    setFormData({ ...emptyForm, category_id: categories[0]?.id || "" });
    newProductImages.forEach((item) => URL.revokeObjectURL(item.previewURL));
    setNewProductImages([]);
    setNewProductPrimaryImageKey("");
    editUploadImages.forEach((item) => URL.revokeObjectURL(item.previewURL));
    setEditUploadImages([]);
    setEditUploadPrimaryKey("");
    setActiveProduct(null);
    setIsProductModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    newProductImages.forEach((item) => URL.revokeObjectURL(item.previewURL));
    setNewProductImages([]);
    setNewProductPrimaryImageKey("");
    editUploadImages.forEach((item) => URL.revokeObjectURL(item.previewURL));
    setEditUploadImages([]);
    setEditUploadPrimaryKey("");
    setActiveProduct(product);
    setFormData({
      id: product.id,
      name: product.name || "",
      variety_name: product.variety_name || "",
      description: product.description || "",
      price: product.price || 0,
      unit_type: product.unit_type || "PER_POHON",
      category_id: product.category_id || product.category?.id || categories[0]?.id || "",
      weight_gram: product.weight_gram || 500,
      size: product.size || "",
      condition: product.condition || "",
      batch_quantity: product.batch_quantity || 1,
      care_tips: product.care_tips || "",
      tags: Array.isArray(product.tags) ? product.tags.join(", ") : String(product.tags || ""),
      status: product.status || "active",
      inventory: {
        quantity: product.inventory?.quantity ?? 0,
        low_stock_threshold: product.inventory?.low_stock_threshold ?? 5,
      },
    });
    setIsProductModalOpen(true);
  };

  const closeProductModal = () => {
    setIsProductModalOpen(false);
    newProductImages.forEach((item) => URL.revokeObjectURL(item.previewURL));
    setNewProductImages([]);
    setNewProductPrimaryImageKey("");
    editUploadImages.forEach((item) => URL.revokeObjectURL(item.previewURL));
    setEditUploadImages([]);
    setEditUploadPrimaryKey("");
    setActiveProduct(null);
  };

  const refreshActiveProduct = async (productID: string) => {
    try {
      const res = await api.get(`/admin/products/${productID}`);
      setActiveProduct(res.data?.data || null);
    } catch {
      // ignore; products list refresh will pick it up
    }
  };

  const productPayload = {
    ...formData,
    price: Number(formData.price),
    weight_gram: Number(formData.weight_gram),
    batch_quantity: Number(formData.batch_quantity),
    inventory: {
      quantity: Number(formData.inventory.quantity),
      low_stock_threshold: Number(formData.inventory.low_stock_threshold),
    },
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category_id) {
      alert("Pilih kategori produk terlebih dahulu.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (formData.id) {
        await api.put(`/admin/products/${formData.id}`, productPayload);
      } else {
        const created = await api.post("/admin/products", productPayload);
        const createdId = created.data?.data?.id as string | undefined;
        if (createdId && newProductImages.length > 0) {
          const failures: string[] = [];
          for (let index = 0; index < newProductImages.length; index++) {
            const item = newProductImages[index];
            const imagePayload = new FormData();
            imagePayload.append("file", item.file);
            imagePayload.append("is_primary", item.key === newProductPrimaryImageKey ? "true" : "false");
            imagePayload.append("alt_text", newProductImages.length > 1 ? `${formData.name} ${index + 1}` : formData.name || "Gambar produk");
            try {
              await api.post(`/admin/products/${createdId}/images/upload`, imagePayload);
            } catch (uploadErr: any) {
              failures.push(uploadErr.response?.data?.error || uploadErr.message || `unggah gambar ${index + 1} gagal`);
            }
          }
          if (failures.length > 0) {
            alert(`Produk berhasil dibuat, tetapi ${failures.length} unggah gambar gagal: ${failures[0]}`);
          }
        }
      }
      setIsProductModalOpen(false);
      setFormData(emptyForm);
      newProductImages.forEach((item) => URL.revokeObjectURL(item.previewURL));
      setNewProductImages([]);
      setNewProductPrimaryImageKey("");
      await fetchProducts();
    } catch (e: any) {
      alert("Gagal menyimpan produk: " + (e.response?.data?.error || e.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct) return;
    try {
      await api.put(`/admin/inventory/${activeProduct.id}`, {
        quantity: Number(stockData.quantity),
        low_stock_threshold: Number(stockData.low_stock_threshold),
        note: stockData.note,
      });
      setIsStockModalOpen(false);
      await fetchProducts();
    } catch (e: any) {
      alert("Gagal memperbarui stok: " + (e.response?.data?.error || e.message));
    }
  };

  const handleImageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct || !imageFile) return;
    const payload = new FormData();
    payload.append("file", imageFile);
    payload.append("is_primary", activeProduct.images?.length ? "false" : "true");

    try {
      await api.post(`/admin/products/${activeProduct.id}/images/upload`, payload);
      setIsImageModalOpen(false);
      setImageFile(null);
      await fetchProducts();
    } catch (e: any) {
      alert("Gagal unggah gambar: " + (e.response?.data?.error || e.message));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus produk ini? Produk akan disembunyikan dari katalog publik.")) return;
    try {
      await api.delete(`/admin/products/${id}`);
      await fetchProducts();
    } catch {
      alert("Gagal menghapus");
    }
  };

  const setField = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold mb-1">Manajemen Produk</h1>
          <p className="text-gray-500 text-sm">Kelola katalog, status produk, gambar, harga, dan stok anggrek</p>
        </div>
        <button onClick={openCreateModal} className="flex items-center gap-2 bg-[var(--color-brand-600)] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:scale-105 transition-transform">
          <Plus className="w-4 h-4" /> Tambah Produk
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk, varietas, kategori..." className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2.5 text-sm">
          <option value="">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-950">
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">Produk</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">Unit</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">Harga</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">Stok</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableRowsSkeleton columns={6} rows={6} />
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500 text-sm">Tidak ada produk</td></tr>
              ) : filtered.map((product) => {
                const stock = product.inventory?.quantity ?? 0;
                const threshold = product.inventory?.low_stock_threshold ?? 5;
                return (
                  <motion.tr key={product.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 dark:bg-zinc-800 shrink-0">
                          <img src={product.images?.[0]?.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(product.name)}&background=random`} alt={product.name} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <div className="font-bold text-sm">{product.name}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[240px]">{product.variety_name || product.category?.name || "-"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4"><StatusBadge status={product.status} /></td>
                    <td className="p-4"><span className="bg-gray-100 dark:bg-zinc-800 text-xs px-2 py-1 rounded font-medium">{product.unit_type?.replace(/_/g, " ")}</span></td>
                    <td className="p-4 font-medium text-sm">Rp {product.price?.toLocaleString("id-ID")}</td>
                    <td className="p-4">{stock <= threshold ? <span className="flex items-center gap-1 text-red-500 font-bold text-sm"><AlertCircle className="w-4 h-4" />{stock}</span> : <span className="font-medium text-emerald-600 text-sm">{stock}</span>}</td>
                    <td className="p-4">
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => { setActiveProduct(product); setStockData({ quantity: stock, low_stock_threshold: threshold, note: "" }); setIsStockModalOpen(true); }} className="p-2 bg-[var(--color-leaf-50)] text-[var(--color-leaf-600)] rounded-lg hover:bg-[var(--color-leaf-100)]" title="Koreksi Stok"><PackagePlus className="w-4 h-4" /></button>
                        <button onClick={() => { setActiveProduct(product); setIsImageModalOpen(true); }} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100" title="Unggah Gambar"><ImagePlus className="w-4 h-4" /></button>
                        <button onClick={() => openEditModal(product)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100" title="Edit Produk"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(product.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100" title="Hapus Produk"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">{formData.id ? "Edit Produk" : "Tambah Produk"}</h2>
              <button onClick={closeProductModal} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleProductSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!formData.id && (
                <div className="md:col-span-2">
                  <label className="text-sm font-medium mb-1 block">Gambar Produk</label>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      newProductImages.forEach((item) => URL.revokeObjectURL(item.previewURL));
                      const next = files.map((file) => ({
                        key: `${file.name}-${file.size}-${file.lastModified}`,
                        file,
                        previewURL: URL.createObjectURL(file),
                      }));
                      setNewProductImages(next);
                      setNewProductPrimaryImageKey(next[0]?.key || "");
                    }}
                    className="w-full text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Bisa pilih banyak. Format JPG, PNG, atau WebP. Maksimal 5MB per gambar.</p>

                  {newProductImages.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
                      {newProductImages.map((item) => (
                        <div key={item.key} className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-gray-50 dark:bg-black">
                          <div className="w-full h-28">
                            <img src={item.previewURL} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                          <div className="p-2 flex flex-col gap-2">
                            <label className="flex items-center gap-2 text-xs font-bold">
                              <input
                                type="radio"
                                name="new-product-primary-image"
                                checked={newProductPrimaryImageKey === item.key}
                                onChange={() => setNewProductPrimaryImageKey(item.key)}
                              />
                              Utama
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                URL.revokeObjectURL(item.previewURL);
                                const next = newProductImages.filter((img) => img.key !== item.key);
                                setNewProductImages(next);
                                if (newProductPrimaryImageKey === item.key) setNewProductPrimaryImageKey(next[0]?.key || "");
                              }}
                              className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-800"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 text-xs text-gray-400 flex items-center gap-2">
                      <ImagePlus className="w-4 h-4" /> Belum ada gambar dipilih
                    </div>
                  )}
                </div>
              )}
              {formData.id && (
                <div className="md:col-span-2">
                  <label className="text-sm font-medium mb-1 block">Gambar Produk</label>
                  <p className="text-xs text-gray-500">Pilih utama, hapus gambar, atau unggah gambar tambahan.</p>

                  {(activeProduct?.images?.length || 0) > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
                      {(activeProduct?.images || []).map((img) => (
                        <div key={img.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-gray-50 dark:bg-black">
                          <div className="w-full h-28">
                            <img src={img.image_url} alt={img.alt_text || formData.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="p-2 flex flex-col gap-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className={`font-bold ${img.is_primary ? "text-[var(--color-leaf-600)]" : "text-gray-500"}`}>{img.is_primary ? "UTAMA" : " "}</span>
                              {!img.is_primary && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!formData.id) return;
                                    try {
                                      await api.put(`/admin/products/${formData.id}/images/${img.id}/primary`);
                                      await refreshActiveProduct(formData.id);
                                      await fetchProducts();
                                    } catch (e: any) {
                                      alert("Gagal menetapkan gambar utama: " + (e.response?.data?.error || e.message));
                                    }
                                  }}
                                  className="px-3 py-1.5 rounded-xl text-[10px] font-bold border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                  Jadikan Utama
                                </button>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!formData.id) return;
                                if (!confirm("Hapus gambar ini?")) return;
                                try {
                                  await api.delete(`/admin/products/${formData.id}/images/${img.id}`);
                                  await refreshActiveProduct(formData.id);
                                  await fetchProducts();
                                } catch (e: any) {
                                  alert("Gagal hapus gambar: " + (e.response?.data?.error || e.message));
                                }
                              }}
                              className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-800"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-gray-400 flex items-center gap-2">
                      <ImagePlus className="w-4 h-4" /> Belum ada gambar
                    </div>
                  )}

                  <div className="mt-4 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                    <div className="font-bold text-sm mb-2">Unggah Gambar Tambahan</div>
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        editUploadImages.forEach((item) => URL.revokeObjectURL(item.previewURL));
                        const next = files.map((file) => ({
                          key: `${file.name}-${file.size}-${file.lastModified}`,
                          file,
                          previewURL: URL.createObjectURL(file),
                        }));
                        setEditUploadImages(next);
                        setEditUploadPrimaryKey(next[0]?.key || "");
                      }}
                      className="w-full text-sm"
                    />
                    {editUploadImages.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
                        {editUploadImages.map((item) => (
                          <div key={item.key} className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-gray-50 dark:bg-black">
                            <div className="w-full h-24">
                              <img src={item.previewURL} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                            <div className="p-2 flex flex-col gap-2">
                              <label className="flex items-center gap-2 text-xs font-bold">
                                <input
                                  type="radio"
                                  name="edit-upload-primary-image"
                                  checked={editUploadPrimaryKey === item.key}
                                  onChange={() => setEditUploadPrimaryKey(item.key)}
                                />
                                Utama
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  URL.revokeObjectURL(item.previewURL);
                                  const next = editUploadImages.filter((img) => img.key !== item.key);
                                  setEditUploadImages(next);
                                  if (editUploadPrimaryKey === item.key) setEditUploadPrimaryKey(next[0]?.key || "");
                                }}
                                className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-800"
                              >
                                Hapus
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-end gap-2 mt-3">
                      <button
                        type="button"
                        disabled={isSubmitting || editUploadImages.length === 0}
                        onClick={async () => {
                          if (!formData.id || editUploadImages.length === 0) return;
                          setIsSubmitting(true);
                          try {
                            const failures: string[] = [];
                            for (let index = 0; index < editUploadImages.length; index++) {
                              const item = editUploadImages[index];
                              const payload = new FormData();
                              payload.append("file", item.file);
                              payload.append("is_primary", item.key === editUploadPrimaryKey ? "true" : "false");
                              payload.append("alt_text", editUploadImages.length > 1 ? `${formData.name} ${index + 1}` : formData.name || "Gambar produk");
                              try {
                                await api.post(`/admin/products/${formData.id}/images/upload`, payload);
                              } catch (err: any) {
                                failures.push(err.response?.data?.error || err.message || `unggah gambar ${index + 1} gagal`);
                              }
                            }
                            editUploadImages.forEach((item) => URL.revokeObjectURL(item.previewURL));
                            setEditUploadImages([]);
                            setEditUploadPrimaryKey("");
                            await refreshActiveProduct(formData.id);
                            await fetchProducts();
                            if (failures.length > 0) alert(`Sebagian unggah gagal: ${failures[0]}`);
                          } finally {
                            setIsSubmitting(false);
                          }
                        }}
                        className="bg-amber-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50"
                      >
                        {isSubmitting ? <span className="inline-flex items-center gap-2"><Spinner className="h-4 w-4" /> Mengunggah...</span> : "Unggah Gambar"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <Input label="Nama Produk" required value={formData.name} onChange={(value) => setField("name", value)} />
              <Input label="Nama Varietas" value={formData.variety_name} onChange={(value) => setField("variety_name", value)} />
              <div>
                <label className="text-sm font-medium mb-1 block">Kategori</label>
                <select required value={formData.category_id} onChange={(e) => setField("category_id", e.target.value)} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm">
                  <option value="">Pilih kategori</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Status</label>
                <select value={formData.status} onChange={(e) => setField("status", e.target.value as ProductForm["status"])} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm">
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-1 block">Deskripsi</label>
                <textarea required value={formData.description} onChange={(e) => setField("description", e.target.value)} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" rows={3} />
              </div>
              <NumberInput label="Harga (Rp)" required value={formData.price} onChange={(value) => setField("price", value)} />
              <div>
                <label className="text-sm font-medium mb-1 block">Unit Inventori</label>
                <select value={formData.unit_type} onChange={(e) => setField("unit_type", e.target.value as ProductForm["unit_type"])} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm">
                  <option value="PER_POHON">Per Pohon</option>
                  <option value="PER_BATCH">Per Batch</option>
                  <option value="PER_VARIETAS">Per Varietas</option>
                </select>
              </div>
              <NumberInput label="Jumlah per Batch" value={formData.batch_quantity} onChange={(value) => setField("batch_quantity", value)} />
              <NumberInput label="Berat (gram)" value={formData.weight_gram} onChange={(value) => setField("weight_gram", value)} />
              <div>
                <label className="text-sm font-medium mb-1 block">Ukuran</label>
                <select value={formData.size} onChange={(e) => setField("size", e.target.value)} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm">
                  <option value="">-</option>
                  <option value="seedling">Seedling</option>
                  <option value="remaja">Remaja</option>
                  <option value="dewasa">Dewasa</option>
                  <option value="berbunga">Berbunga</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Kondisi</label>
                <select value={formData.condition} onChange={(e) => setField("condition", e.target.value)} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm">
                  <option value="">-</option>
                  <option value="berbunga">Berbunga</option>
                  <option value="knop">Knop</option>
                  <option value="vegetatif">Vegetatif</option>
                </select>
              </div>
              <NumberInput label="Stok" value={formData.inventory.quantity} onChange={(value) => setFormData((prev) => ({ ...prev, inventory: { ...prev.inventory, quantity: value } }))} />
              <NumberInput label="Low Stock Threshold" value={formData.inventory.low_stock_threshold} onChange={(value) => setFormData((prev) => ({ ...prev, inventory: { ...prev.inventory, low_stock_threshold: value } }))} />
              <Input label="Tags" value={formData.tags} onChange={(value) => setField("tags", value)} placeholder="rare, bestseller, promo" />
              <Input label="Tips Perawatan" value={formData.care_tips} onChange={(value) => setField("care_tips", value)} />
              <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                <button type="button" onClick={closeProductModal} className="px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-100 dark:hover:bg-zinc-800">Batal</button>
                <button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 bg-[var(--color-brand-600)] text-white px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50">{isSubmitting && <Spinner className="h-4 w-4" />}{isSubmitting ? "Menyimpan..." : "Simpan"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isStockModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-xl font-bold mb-2">Koreksi Stok</h2>
            <p className="text-gray-500 text-sm mb-5">{activeProduct?.name}</p>
            <form onSubmit={handleStockSubmit} className="flex flex-col gap-4">
              <NumberInput label="Jumlah Stok" required value={stockData.quantity} onChange={(value) => setStockData((prev) => ({ ...prev, quantity: value }))} />
              <NumberInput label="Low Stock Threshold" value={stockData.low_stock_threshold} onChange={(value) => setStockData((prev) => ({ ...prev, low_stock_threshold: value }))} />
              <Input label="Catatan" required placeholder="Alasan koreksi" value={stockData.note} onChange={(value) => setStockData((prev) => ({ ...prev, note: value }))} />
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setIsStockModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-100 dark:hover:bg-zinc-800">Batal</button>
                <button type="submit" className="bg-[var(--color-leaf-600)] text-white px-5 py-2.5 rounded-xl font-bold text-sm">Perbarui</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isImageModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-xl font-bold mb-2">Unggah Gambar</h2>
            <p className="text-gray-500 text-sm mb-5">{activeProduct?.name}</p>
            <form onSubmit={handleImageSubmit} className="flex flex-col gap-4">
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="w-full text-sm" />
              <p className="text-xs text-gray-500">Format JPG, PNG, atau WebP. Maksimal 5MB.</p>
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setIsImageModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-100 dark:hover:bg-zinc-800">Batal</button>
                <button type="submit" disabled={!imageFile} className="bg-amber-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50">Unggah</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({ label, value, onChange, required, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="text-sm font-medium mb-1 block">{label}</label>
      <input required={required} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" />
    </div>
  );
}

function NumberInput({ label, value, onChange, required }: { label: string; value: number; onChange: (value: number) => void; required?: boolean }) {
  return (
    <div>
      <label className="text-sm font-medium mb-1 block">{label}</label>
      <input type="number" min={0} required={required} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-600",
    inactive: "bg-gray-100 text-gray-600",
    draft: "bg-amber-50 text-amber-600",
  };
  return <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${styles[status] || styles.draft}`}>{status?.toUpperCase() || "DRAFT"}</span>;
}
