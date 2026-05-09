const CART_ERROR_MESSAGES: Record<string, string> = {
  "Unauthorized": "Silakan masuk terlebih dahulu untuk menambahkan produk ke keranjang.",
  "invalid user id": "Sesi pengguna tidak valid. Silakan masuk kembali.",
  "invalid cart item id": "Item keranjang tidak valid.",
  "product id is required": "Produk belum dipilih.",
  "cart id is required": "Keranjang tidak valid. Silakan muat ulang halaman.",
  "quantity must be at least 1": "Jumlah produk harus minimal 1.",
  "product is not available": "Produk tidak tersedia atau sudah tidak aktif.",
  "product inventory is not available": "Informasi stok produk belum tersedia.",
  "requested quantity exceeds available stock": "Jumlah produk melebihi stok yang tersedia.",
  "cart item not found": "Item keranjang tidak ditemukan.",
};

export function cartErrorMessage(error: unknown, fallback = "Gagal memasukkan produk ke keranjang. Silakan coba lagi.") {
  const responseError = error as { response?: { data?: { error?: unknown } }; message?: unknown };
  const rawMessage = typeof responseError.response?.data?.error === "string"
    ? responseError.response.data.error
    : typeof responseError.message === "string"
      ? responseError.message
      : "";

  return CART_ERROR_MESSAGES[rawMessage] || rawMessage || fallback;
}
