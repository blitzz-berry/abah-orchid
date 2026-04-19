"use client";

import Link from "next/link";
import { Leaf } from "lucide-react";

const footerLinks = {
  produk: [
    { label: "Katalog Anggrek", href: "/products" },
    { label: "Phalaenopsis", href: "/products?category=phalaenopsis" },
    { label: "Dendrobium", href: "/products?category=dendrobium" },
    { label: "Vanda", href: "/products?category=vanda" },
    { label: "Cattleya", href: "/products?category=cattleya" },
  ],
  pelanggan: [
    { label: "Akun Saya", href: "/profile" },
    { label: "Pesanan Saya", href: "/orders" },
    { label: "Keranjang", href: "/cart" },
    { label: "Pemesanan B2B", href: "/products?type=B2B" },
  ],
  tentang: [
    { label: "Tentang Kami", href: "#" },
    { label: "Kebijakan Privasi", href: "#" },
    { label: "Syarat & Ketentuan", href: "#" },
    { label: "Kontak", href: "#" },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-black/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Leaf className="w-7 h-7 text-[var(--color-leaf-500)]" />
              <span className="text-xl font-bold tracking-tight">OrchidMart</span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              Platform e-commerce khusus anggrek #1 di Indonesia. Koleksi premium untuk hobbyist & bisnis.
            </p>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>🌿 100% Tanaman Asli</span>
              <span>📦 Packing Aman</span>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-bold text-sm uppercase tracking-wider text-gray-900 dark:text-gray-100 mb-4">
              Produk
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.produk.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-500 hover:text-[var(--color-brand-600)] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm uppercase tracking-wider text-gray-900 dark:text-gray-100 mb-4">
              Pelanggan
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.pelanggan.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-500 hover:text-[var(--color-brand-600)] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm uppercase tracking-wider text-gray-900 dark:text-gray-100 mb-4">
              Informasi
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.tentang.map((link) => (
                <li key={link.href + link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-500 hover:text-[var(--color-brand-600)] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} OrchidMart. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>💳 Midtrans Payment</span>
            <span>🚚 JNE • J&T • SiCepat</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
