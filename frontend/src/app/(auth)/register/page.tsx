"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Leaf, Lock, Mail, User, Phone } from "lucide-react";
import api from "@/lib/api";
import { motion } from "framer-motion";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await api.post("/auth/register", formData);
      router.push("/login");
    } catch (err: any) {
      setError(err.response?.data?.error || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4 py-10">
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--color-brand-200)]/20 blur-[120px] -z-10" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--color-leaf-200)]/20 blur-[120px] -z-10" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass rounded-3xl p-8"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-[var(--color-leaf-50)] text-[var(--color-leaf-600)] rounded-2xl mb-4">
            <Leaf className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold">Gabung OrchidMart</h1>
          <p className="text-gray-500">Mulai transaksi anggrek pertamamu</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm text-center font-medium border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Nama Lengkap</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                name="full_name"
                required
                value={formData.full_name}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200 focus:border-[var(--color-leaf-500)] focus:ring-1 focus:ring-[var(--color-leaf-500)] rounded-xl outline-none transition-all dark:bg-black/50 dark:border-gray-800"
                placeholder="Budi Santoso"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200 focus:border-[var(--color-leaf-500)] focus:ring-1 focus:ring-[var(--color-leaf-500)] rounded-xl outline-none transition-all dark:bg-black/50 dark:border-gray-800"
                placeholder="email@contoh.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">No. Handphone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="tel"
                name="phone"
                required
                value={formData.phone}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200 focus:border-[var(--color-leaf-500)] focus:ring-1 focus:ring-[var(--color-leaf-500)] rounded-xl outline-none transition-all dark:bg-black/50 dark:border-gray-800"
                placeholder="081234567890"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="password"
                name="password"
                required
                minLength={8}
                value={formData.password}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200 focus:border-[var(--color-leaf-500)] focus:ring-1 focus:ring-[var(--color-leaf-500)] rounded-xl outline-none transition-all dark:bg-black/50 dark:border-gray-800"
                placeholder="Min. 8 karakter"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 mt-4 bg-[var(--color-leaf-600)] text-white rounded-xl font-bold disabled:opacity-50 hover:scale-[1.02] transition-transform"
          >
            {isLoading ? "Memproses..." : "Daftar"}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-gray-500">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-[var(--color-leaf-600)] font-bold hover:underline">
            Masuk
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
