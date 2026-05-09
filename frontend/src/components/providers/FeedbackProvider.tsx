"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type FeedbackType = "success" | "error" | "info";

type FeedbackItem = {
  id: number;
  message: string;
  type: FeedbackType;
};

const TOAST_DURATION_MS = 4500;

function inferFeedbackType(message: string): FeedbackType {
  const normalized = message.trim().toLowerCase();
  if (/(berhasil|sukses|success|tersimpan|terunggah)/.test(normalized)) return "success";
  if (/(gagal|error|invalid|tidak valid|harus|kosong|belum|failed)/.test(normalized)) return "error";
  return "info";
}

function feedbackStyle(type: FeedbackType) {
  if (type === "success") {
    return {
      icon: CheckCircle2,
      iconClass: "text-emerald-600",
      borderClass: "border-emerald-200/80 dark:border-emerald-900/70",
      barClass: "bg-emerald-500",
    };
  }
  if (type === "error") {
    return {
      icon: AlertCircle,
      iconClass: "text-red-600",
      borderClass: "border-red-200/80 dark:border-red-900/70",
      barClass: "bg-red-500",
    };
  }
  return {
    icon: Info,
    iconClass: "text-[var(--color-brand-600)]",
    borderClass: "border-[var(--color-brand-200)]/80 dark:border-[var(--color-brand-900)]/70",
    barClass: "bg-[var(--color-brand-500)]",
  };
}

export default function FeedbackProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const counterRef = useRef(0);

  useEffect(() => {
    const originalAlert = window.alert;

    window.alert = (message?: unknown) => {
      const text = String(message ?? "");
      const id = counterRef.current + 1;
      counterRef.current = id;

      setItems((current) => [
        ...current.slice(-2),
        { id, message: text, type: inferFeedbackType(text) },
      ]);

      window.setTimeout(() => {
        setItems((current) => current.filter((item) => item.id !== id));
      }, TOAST_DURATION_MS);
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  const close = (id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  return (
    <>
      {children}
      <div className="fixed right-4 top-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:right-6 sm:top-6">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const style = feedbackStyle(item.type);
            const Icon = style.icon;

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: -16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className={`relative overflow-hidden rounded-2xl border ${style.borderClass} bg-white/95 p-4 pr-11 text-sm text-gray-800 shadow-xl shadow-black/10 backdrop-blur-xl dark:bg-zinc-950/95 dark:text-gray-100`}
                role="status"
                aria-live="polite"
              >
                <div className={`absolute inset-y-0 left-0 w-1 ${style.barClass}`} />
                <div className="flex items-start gap-3">
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconClass}`} />
                  <p className="leading-relaxed">{item.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => close(item.id)}
                  className="absolute right-3 top-3 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-gray-100"
                  aria-label="Tutup notifikasi"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
}
