"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Leaf, Lock, Mail } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { motion } from "framer-motion";
import type { User } from "@/types";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const isUser = (value: unknown): value is User => {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<User>;
    return typeof candidate.id === "string" &&
      typeof candidate.email === "string" &&
      typeof candidate.full_name === "string" &&
      typeof candidate.role === "string";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/login", { email, password });
      const data = res.data.data || res.data;
      const token = data.access_token;
      const user = data.user;
      if (!token || !isUser(user)) {
        throw new Error("Respons login backend tidak lengkap");
      }
      login(user, token);
      if (user.role === "admin") router.push("/admin");
      else router.push("/");
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || "Login gagal. Cek email dan password kamu.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--color-brand-200)]/20 blur-[120px] -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--color-leaf-50)]/30 blur-[120px] -z-10" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md glass rounded-3xl p-8">
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="p-3 bg-[var(--color-brand-50)] dark:bg-[var(--color-brand-900)] text-[var(--color-brand-600)] dark:text-[var(--color-brand-300)] rounded-2xl mb-4">
            <Leaf className="w-8 h-8" />
          </Link>
          <h1 className="text-2xl font-bold">Selamat Datang Kembali</h1>
          <p className="text-gray-500 text-sm">Masuk untuk mengelola koleksi anggrekmu</p>
        </div>

        {error && <div className="bg-red-50 dark:bg-red-500/10 text-red-600 p-3 rounded-xl mb-6 text-sm text-center font-medium border border-red-100 dark:border-red-800">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-black/50 border border-gray-200 dark:border-gray-800 focus:border-[var(--color-brand-500)] focus:ring-1 focus:ring-[var(--color-brand-500)] rounded-xl outline-none transition-all" placeholder="email@contoh.com" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-black/50 border border-gray-200 dark:border-gray-800 focus:border-[var(--color-brand-500)] focus:ring-1 focus:ring-[var(--color-brand-500)] rounded-xl outline-none transition-all" placeholder="••••••••" />
            </div>
            <div className="flex justify-end mt-2">
              <Link href="/forgot-password" className="text-sm text-[var(--color-brand-600)] font-medium hover:underline">Lupa Password?</Link>
            </div>
          </div>
          <button type="submit" disabled={isLoading} className="w-full py-3 mt-2 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold disabled:opacity-50 hover:scale-[1.02] transition-transform">{isLoading ? "Memproses..." : "Masuk"}</button>
        </form>

        <p className="text-center mt-6 text-sm text-gray-500">Belum punya akun? <Link href="/register" className="text-[var(--color-brand-600)] font-bold hover:underline">Daftar Sekarang</Link></p>
      </motion.div>
    </div>
  );
}
