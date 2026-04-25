"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Leaf, Lock, ArrowLeft } from "lucide-react";
import api from "@/lib/api";
import { motion } from "framer-motion";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Token reset password tidak ditemukan.");
      return;
    }
    if (password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }

    setIsLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || "Gagal reset password. Link mungkin sudah kadaluarsa.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--color-leaf-200)]/20 blur-[120px] -z-10" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md glass rounded-3xl p-8">
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="p-3 bg-[var(--color-leaf-50)] dark:bg-[var(--color-leaf-900)]/30 text-[var(--color-leaf-600)] rounded-2xl mb-4"><Leaf className="w-8 h-8" /></Link>
          <h1 className="text-2xl font-bold">Reset Password</h1>
          <p className="text-gray-500 text-sm text-center">Masukkan password baru untuk akun OrchidMart lu.</p>
        </div>

        {success ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-4">🔐</div>
            <h2 className="text-xl font-bold mb-2">Password Berhasil Diubah</h2>
            <p className="text-gray-500 text-sm mb-6">Sekarang lu bisa login pakai password baru.</p>
            <Link href="/login" className="text-[var(--color-brand-600)] font-bold hover:underline text-sm">Masuk ke Login</Link>
          </div>
        ) : (
          <>
            {error && <div className="bg-red-50 dark:bg-red-500/10 text-red-600 p-3 rounded-xl mb-6 text-sm text-center font-medium border border-red-100 dark:border-red-800">{error}</div>}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Password Baru</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-black/50 border border-gray-200 dark:border-gray-800 rounded-xl outline-none transition-all" placeholder="Minimal 8 karakter" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Konfirmasi Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-black/50 border border-gray-200 dark:border-gray-800 rounded-xl outline-none transition-all" placeholder="Ulangi password" />
                </div>
              </div>
              <button type="submit" disabled={isLoading} className="w-full py-3 mt-2 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold disabled:opacity-50 hover:scale-[1.02] transition-transform">{isLoading ? "Menyimpan..." : "Reset Password"}</button>
            </form>
            <p className="text-center mt-6 text-sm text-gray-500"><Link href="/login" className="text-[var(--color-brand-600)] font-medium hover:underline flex items-center justify-center gap-1"><ArrowLeft className="w-4 h-4" /> Kembali ke Login</Link></p>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg)]" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
