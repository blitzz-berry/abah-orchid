"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Leaf, ShoppingBag, ShieldCheck, ShieldAlert } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      {/* Navigation */}
      <nav className="glass fixed top-0 w-full z-50 flex items-center justify-between px-8 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Leaf className="w-8 h-8 text-[var(--color-leaf-500)]" />
          <span className="text-2xl font-bold tracking-tight">OrchidMart</span>
        </Link>
        <div className="flex items-center gap-6 font-medium">
          <Link href="/products" className="hover:text-[var(--color-brand-600)] transition-colors">Katalog</Link>
          <Link href="/products" className="hover:text-[var(--color-brand-600)] transition-colors">B2B Order</Link>
          <Link href="/admin" className="hover:text-[var(--color-brand-600)] transition-colors flex items-center gap-1"><ShieldAlert className="w-4 h-4"/> Admin</Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/cart" className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors relative">
            <ShoppingBag className="w-6 h-6" />
          </Link>
          <Link href="/login" className="px-6 py-2 bg-black text-white dark:bg-white dark:text-black rounded-full font-semibold hover:opacity-90 transition-opacity">
            Masuk
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pt-32 pb-20 text-center relative overflow-hidden">
        {/* Dynamic Background Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--color-brand-200)]/30 dark:bg-[var(--color-brand-800)]/20 blur-[120px] -z-10" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--color-leaf-200)]/30 dark:bg-[var(--color-leaf-900)]/20 blur-[120px] -z-10" />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-4xl flex flex-col items-center"
        >
          <span className="px-4 py-1.5 rounded-full bg-[var(--color-brand-100)] text-[var(--color-brand-700)] dark:bg-[var(--color-brand-900)] dark:text-[var(--color-brand-200)] font-semibold text-sm mb-6 border border-[var(--color-brand-200)] dark:border-[var(--color-brand-800)]">
            🌟 Platform E-Commerce Anggrek #1 di Indonesia
          </span>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
            Koleksi <span className="bg-gradient-to-r from-[var(--color-brand-500)] to-[var(--color-leaf-500)] bg-clip-text text-transparent">Anggrek Premium</span><br/>Untuk Koleksi & Bisnis
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mb-12">
            Temukan berbagai varietas anggrek langka, bibit unggul, hingga tanaman berbunga siap panen. Nikmati pengalaman belanja modern dengan sistem tracking stok terintegrasi.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 mb-20">
            <Link href="/products" className="flex items-center justify-center gap-2 px-8 py-4 bg-black text-white dark:bg-white dark:text-black rounded-full font-bold text-lg hover:scale-105 transition-transform">
              Mulai Belanja <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/products" className="flex items-center justify-center gap-2 px-8 py-4 bg-transparent border-2 border-black dark:border-white rounded-full font-bold text-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              Pemesanan B2B
            </Link>
          </div>
        </motion.div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full">
          {[
            { icon: Leaf, title: "Varietas Terlengkap", desc: "Dari Phalaenopsis hingga Vanda langka" },
            { icon: ShoppingBag, title: "Harga Grosir", desc: "Beli per batch dengan harga spesial" },
            { icon: ShieldCheck, title: "Garansi Pengiriman", desc: "Aman dan bergaransi dengan packing premium" },
          ].map((feature, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + idx * 0.1 }}
              className="flex flex-col items-center text-center p-6 rounded-3xl glass hover:shadow-xl transition-shadow"
            >
              <div className="p-4 bg-[var(--color-brand-50)] dark:bg-[var(--color-brand-900)] rounded-2xl mb-4">
                <feature.icon className="w-8 h-8 text-[var(--color-brand-600)] dark:text-[var(--color-brand-300)]" />
              </div>
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-gray-600 dark:text-gray-400">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
