"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import type { User } from "@/types";

const GOOGLE_SCRIPT_ID = "google-identity-services";

type GoogleAuthButtonProps = {
  mode: "login" | "register";
};

function googleAllowedOrigins() {
  const configuredOrigins = (process.env.NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (configuredOrigins.length > 0) return configuredOrigins;
  if (process.env.NODE_ENV !== "production") return ["http://localhost:3000", "http://127.0.0.1:3000"];
  return [];
}

function googleOAuthReady() {
  const value = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_READY;
  if (value === undefined) return process.env.NODE_ENV !== "production";
  return value === "true";
}

export default function GoogleAuthButton({ mode }: GoogleAuthButtonProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const clientID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const allowedOrigins = useMemo(() => googleAllowedOrigins(), []);
  const oauthReady = googleOAuthReady();
  const label = mode === "register" ? "Daftar dengan Google" : "Masuk dengan Google";

  useEffect(() => {
    const host = hostRef.current;
    let isMounted = true;
    let readyTimer: number | undefined;
    let googleContainer: HTMLDivElement | undefined;
    let cleanupScriptListener: (() => void) | undefined;

    const setSafeStatus = (nextStatus: "loading" | "ready" | "error") => {
      if (isMounted) setStatus(nextStatus);
    };

    const setSafeError = (message: string) => {
      if (isMounted) setError(message);
    };

    if (!clientID) {
      setSafeError("Login Google belum dikonfigurasi.");
      setSafeStatus("error");
      return;
    }
    if (!oauthReady) {
      setSafeError("Login Google belum aktif. Set NEXT_PUBLIC_GOOGLE_OAUTH_READY=true setelah origin OAuth Google Console sudah benar.");
      setSafeStatus("error");
      return;
    }
    if (allowedOrigins.length === 0 || !allowedOrigins.includes(window.location.origin)) {
      setSafeError(`Login Google belum diaktifkan untuk ${window.location.origin}. Tambahkan origin ini ke NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS dan Google OAuth Console.`);
      setSafeStatus("error");
      return;
    }

    const renderButton = () => {
      if (!host || !window.google?.accounts?.id || !isMounted) return;

      setSafeStatus("loading");
      if (readyTimer) window.clearTimeout(readyTimer);

      if (googleContainer && host.contains(googleContainer)) {
        host.removeChild(googleContainer);
      }

      googleContainer = document.createElement("div");
      googleContainer.className = "flex min-h-12 w-full items-center justify-center";
      host.appendChild(googleContainer);

      window.google.accounts.id.initialize({
        client_id: clientID,
        callback: async (response) => {
          if (!response.credential) {
            setSafeError("Token Google tidak diterima. Silakan coba lagi.");
            return;
          }
          setSafeError("");
          try {
            const authResponse = await api.post("/auth/google", { credential: response.credential });
            const data = authResponse.data.data || authResponse.data;
            if (!data.access_token || !data.user) {
              throw new Error("Respons login Google tidak lengkap.");
            }
            login(data.user as User, data.access_token);
            router.push(data.user.role === "admin" ? "/admin" : "/");
          } catch (err: any) {
            if (err.response?.status === 404) {
              setSafeError("Endpoint login Google belum tersedia di backend yang sedang berjalan. Silakan mulai ulang atau bangun ulang backend.");
            } else {
              setSafeError(err.response?.data?.error || err.message || "Login Google gagal. Silakan coba lagi.");
            }
          }
        },
      });

      window.google.accounts.id.renderButton(googleContainer, {
        theme: "filled_black",
        size: "large",
        width: Math.max(host.offsetWidth || 320, 320),
        text: mode === "register" ? "signup_with" : "signin_with",
        shape: "pill",
        logo_alignment: "left",
        locale: "id",
      });

      readyTimer = window.setTimeout(() => setSafeStatus("ready"), 250);
    };

    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      if (window.google?.accounts?.id) renderButton();
      else {
        existingScript.addEventListener("load", renderButton, { once: true });
        cleanupScriptListener = () => existingScript.removeEventListener("load", renderButton);
      }
    } else {
      const script = document.createElement("script");
      script.id = GOOGLE_SCRIPT_ID;
      script.src = "https://accounts.google.com/gsi/client?hl=id";
      script.async = true;
      script.defer = true;
      script.onload = renderButton;
      script.onerror = () => {
        setSafeError("Gagal memuat layanan Google. Periksa koneksi internet atau pengaturan keamanan browser Anda.");
        setSafeStatus("error");
      };
      document.head.appendChild(script);
    }

    return () => {
      isMounted = false;
      cleanupScriptListener?.();
      if (readyTimer) window.clearTimeout(readyTimer);
      if (host && googleContainer && host.contains(googleContainer)) {
        host.removeChild(googleContainer);
      }
    };
  }, [allowedOrigins, clientID, login, mode, oauthReady, router]);

  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-gray-200 bg-white/80 p-1.5 shadow-sm shadow-black/5 transition-all hover:border-gray-300 hover:shadow-md dark:border-gray-800 dark:bg-zinc-950/70 dark:hover:border-gray-700">
        <div className="relative min-h-12 overflow-hidden rounded-xl">
          {status !== "ready" && (
            <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-gray-600 dark:bg-zinc-950 dark:text-gray-300">
              {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
              {label}
            </div>
          )}
          <div ref={hostRef} className={`flex min-h-12 w-full items-center justify-center transition-opacity ${status === "ready" ? "opacity-100" : "opacity-0"}`} />
        </div>
      </div>
      {error && (
        <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-center text-xs font-medium text-red-600 dark:border-red-900 dark:bg-red-950/30">
          {error}
        </p>
      )}
    </div>
  );
}
