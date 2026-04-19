"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Leaf, Lock, Mail, User, Phone } from "lucide-react";
import api from "@/lib/api";
import { motion } from "framer-motion";

export default function RegisterPage() {
  const [formData, setFormData] = useState({ full_name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      await api.post("/auth/register", formData);
      router.push("/login?registered=true");
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || "Registrasi gagal. Coba lagi.");
    } finally { setIsLoading(false); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const fields = [
    { label: "Nama Lengkap", name: "full_name", type: "text", icon: User, placeholder: "Budi Santoso" },
    { label: "Email", name: "email", type: "email", icon: Mail, placeholder: "email@contoh.com" },
    { label: "No. Handphone", name: "phone", type: "tel", icon: Phone, placeholder: "081234567890" },
    { label: "Password", name: "password", type: "password", icon: Lock, placeholder: "Min. 8 karakter" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4 py-10">
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--color-brand-200)]/20 blur-[120px] -z-10" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--color-leaf-50)]/30 blur-[120px] -z-10" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md glass rounded-3xl p-8">
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="p-3 bg-[var(--color-leaf-50)] dark:bg-[var(--color-leaf-900)]/30 text-[var(--color-leaf-600)] rounded-2xl mb-4"><Leaf className="w-8 h-8" /></Link>
          <h1 className="text-2xl font-bold">Gabung OrchidMart</h1>
          <p className="text-gray-500 text-sm">Mulai transaksi anggrek pertamamu</p>
        </div>

        {error && <div className="bg-red-50 dark:bg-red-500/10 text-red-600 p-3 rounded-xl mb-6 text-sm text-center font-medium border border-red-100 dark:border-red-800">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {fields.map((f) => (
            <div key={f.name}>
              <label className="block text-sm font-medium mb-1.5">{f.label}</label>
              <div className="relative">
                <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input type={f.type} name={f.name} required minLength={f.name === "password" ? 8 : undefined} value={(formData as any)[f.name]} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-black/50 border border-gray-200 dark:border-gray-800 focus:border-[var(--color-leaf-500)] focus:ring-1 focus:ring-[var(--color-leaf-500)] rounded-xl outline-none transition-all" placeholder={f.placeholder} />
              </div>
            </div>
          ))}
          <button type="submit" disabled={isLoading} className="w-full py-3 mt-2 bg-[var(--color-leaf-600)] text-white rounded-xl font-bold disabled:opacity-50 hover:scale-[1.02] transition-transform">{isLoading ? "Memproses..." : "Daftar"}</button>
        </form>

        <p className="text-center mt-6 text-sm text-gray-500">Sudah punya akun? <Link href="/login" className="text-[var(--color-leaf-600)] font-bold hover:underline">Masuk</Link></p>
      </motion.div>
    </div>
  );
}
