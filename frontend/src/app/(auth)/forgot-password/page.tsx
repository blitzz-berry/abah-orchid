"use client";

import { useState } from "react";
import Link from "next/link";
import { Leaf, Mail, ArrowLeft } from "lucide-react";
import api from "@/lib/api";
import { motion } from "framer-motion";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error || "Gagal mengirim email reset. Coba lagi.");
    } finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--color-brand-200)]/20 blur-[120px] -z-10" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md glass rounded-3xl p-8">
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="p-3 bg-[var(--color-brand-50)] dark:bg-[var(--color-brand-900)] text-[var(--color-brand-600)] dark:text-[var(--color-brand-300)] rounded-2xl mb-4"><Leaf className="w-8 h-8" /></Link>
          <h1 className="text-2xl font-bold">Lupa Password</h1>
          <p className="text-gray-500 text-sm text-center">Masukkan email kamu, kami akan kirim link reset password</p>
        </div>

        {sent ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-4">📧</div>
            <h2 className="text-xl font-bold mb-2">Email Terkirim!</h2>
            <p className="text-gray-500 text-sm mb-6">Cek inbox email <strong>{email}</strong> untuk link reset password.</p>
            <Link href="/login" className="text-[var(--color-brand-600)] font-bold hover:underline text-sm">Kembali ke Login</Link>
          </div>
        ) : (
          <>
            {error && <div className="bg-red-50 dark:bg-red-500/10 text-red-600 p-3 rounded-xl mb-6 text-sm text-center font-medium border border-red-100 dark:border-red-800">{error}</div>}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-black/50 border border-gray-200 dark:border-gray-800 focus:border-[var(--color-brand-500)] focus:ring-1 focus:ring-[var(--color-brand-500)] rounded-xl outline-none transition-all" placeholder="email@contoh.com" />
                </div>
              </div>
              <button type="submit" disabled={isLoading} className="w-full py-3 mt-2 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold disabled:opacity-50 hover:scale-[1.02] transition-transform">{isLoading ? "Mengirim..." : "Kirim Link Reset"}</button>
            </form>
            <p className="text-center mt-6 text-sm text-gray-500"><Link href="/login" className="text-[var(--color-brand-600)] font-medium hover:underline flex items-center justify-center gap-1"><ArrowLeft className="w-4 h-4" /> Kembali ke Login</Link></p>
          </>
        )}
      </motion.div>
    </div>
  );
}
