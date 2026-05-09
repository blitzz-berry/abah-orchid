"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import type { User } from "@/types";

type GoogleAuthResult = {
  access_token?: string;
  user?: User;
};

export default function GoogleAuthCompletePage() {
  const [error, setError] = useState("");
  const router = useRouter();
  const login = useAuthStore((state) => state.login);

  useEffect(() => {
    const rawResult = sessionStorage.getItem("google_auth_result");
    sessionStorage.removeItem("google_auth_result");

    if (!rawResult) {
      setError("Data login Google tidak ditemukan. Silakan coba masuk kembali.");
      return;
    }

    try {
      const result = JSON.parse(rawResult) as GoogleAuthResult;
      if (!result.access_token || !result.user) {
        throw new Error("Respons login Google tidak lengkap.");
      }

      login(result.user, result.access_token);
      router.replace(result.user.role === "admin" ? "/admin" : "/");
    } catch {
      setError("Login Google gagal diproses. Silakan coba lagi.");
    }
  }, [login, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 text-gray-900 dark:bg-zinc-950 dark:text-white">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-zinc-900">
        {error ? (
          <>
            <h1 className="text-lg font-semibold">Login Google Gagal</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{error}</p>
            <Link
              href="/login"
              className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              Kembali ke Login
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-600" />
            <h1 className="mt-4 text-lg font-semibold">Memproses Login Google</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Mohon tunggu sebentar.</p>
          </>
        )}
      </div>
    </main>
  );
}
