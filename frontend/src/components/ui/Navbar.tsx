"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, User, LogOut, Menu, X, Heart, Bell, CheckCheck, ClipboardList, ChevronRight } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import { onRealtimeEvent } from "@/lib/realtime";
import type { Notification } from "@/types";

export default function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationFilter, setNotificationFilter] = useState<"all" | "unread">("all");
  const [now, setNow] = useState(() => Date.now());
  const notificationContainerRef = useRef<HTMLDivElement | null>(null);

  const navLinks = [
    { href: "/products", label: "Katalog" },
  ];

  const isActive = (href: string) => pathname === href;

  useEffect(() => {
    if (!isAuthenticated || !user || user.role === "admin") {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    let active = true;
    const fetchNotifications = async () => {
      try {
        const response = await api.get("/notifications");
        if (!active) return;
        const payload = response.data.data || response.data;
        setNotifications(payload.notifications || []);
        setUnreadCount(payload.unread_count || 0);
      } catch {
        if (!active) return;
        setNotifications([]);
        setUnreadCount(0);
      }
    };

    void fetchNotifications();
    const timer = window.setInterval(fetchNotifications, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated || !user || user.role === "admin") return;
    return onRealtimeEvent((event) => {
      if (event.type !== "notification.created") return;
      void api.get("/notifications").then((response) => {
        const payload = response.data.data || response.data;
        setNotifications(payload.notifications || []);
        setUnreadCount(payload.unread_count || 0);
      }).catch(() => undefined);
    });
  }, [isAuthenticated, user]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!notificationOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (notificationContainerRef.current?.contains(event.target as Node)) return;
      setNotificationOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [notificationOpen]);

  const markNotificationRead = async (notification: Notification) => {
    if (!notification.is_read) {
      setNotifications((prev) => prev.map((item) => item.id === notification.id ? { ...item, is_read: true } : item));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await api.patch(`/notifications/${notification.id}/read`);
      } catch {
        void 0;
      }
    }
    setNotificationOpen(false);
  };

  const markAllNotificationsRead = async () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);
    try {
      await api.patch("/notifications/read-all");
    } catch {
      void 0;
    }
  };

  const visibleNotifications = notificationFilter === "unread"
    ? notifications.filter((item) => !item.is_read)
    : notifications;

  const formatNotificationTime = (value?: string) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const diffMs = date.getTime() - now;
    const diffMinutes = Math.round(diffMs / 60000);
    const rtf = new Intl.RelativeTimeFormat("id-ID", { numeric: "auto" });

    if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, "minute");

    const diffHours = Math.round(diffMinutes / 60);
    if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");

    const diffDays = Math.round(diffHours / 24);
    if (Math.abs(diffDays) < 7) return rtf.format(diffDays, "day");

    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  };

  return (
    <nav className="glass fixed top-0 w-full z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex min-w-0 shrink items-center gap-2">
            <img src="/images/anggrek.png" alt="Logo" className="h-8 w-8 shrink-0 object-contain" />
            <span className="truncate text-lg font-bold tracking-tight min-[380px]:text-xl">
              Abah<span className="text-[var(--color-leaf-600)]">Orchid</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link, index) => (
              <Link
                key={`${link.href}-${index}`}
                href={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? "bg-[var(--color-brand-50)] text-[var(--color-brand-700)] dark:bg-[var(--color-brand-900)] dark:text-[var(--color-brand-200)]"
                    : "hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {isAuthenticated && user?.role === "admin" && (
              <Link
                href="/admin"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith("/admin")
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
                    : "hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                Admin Panel
              </Link>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex shrink-0 items-center gap-1 min-[380px]:gap-2">
            {isAuthenticated && user?.role !== "admin" && (
              <div ref={notificationContainerRef} className="relative">
                <button
                  onClick={() => setNotificationOpen((open) => !open)}
                  className="p-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors relative"
                  title="Notifikasi"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
                <AnimatePresence>
                  {notificationOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="fixed left-3 right-3 top-20 max-h-[calc(100dvh-6rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-zinc-950 sm:left-auto sm:right-4 sm:w-[360px] md:absolute md:right-0 md:left-auto md:top-auto md:mt-2 md:max-h-none md:max-w-[calc(100vw-2rem)] md:rounded-3xl"
                    >
                      <div className="border-b border-gray-100 p-3 sm:p-4 dark:border-gray-800">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-bold">Notifikasi</div>
                            <div className="mt-1 text-xs text-gray-500">
                              {unreadCount > 0 ? `${unreadCount} notifikasi belum dibaca` : "Semua notifikasi sudah dibaca"}
                            </div>
                          </div>
                          {unreadCount > 0 && (
                            <button
                              onClick={markAllNotificationsRead}
                              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-brand-50)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-brand-700)] transition-colors hover:bg-[var(--color-brand-100)] dark:bg-[var(--color-brand-900)]/30 dark:text-[var(--color-brand-200)] sm:px-3"
                            >
                              <CheckCheck className="h-3.5 w-3.5" /> <span className="hidden min-[360px]:inline">Tandai dibaca</span><span className="min-[360px]:hidden">Dibaca</span>
                            </button>
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1 dark:bg-zinc-900">
                          <button
                            onClick={() => setNotificationFilter("all")}
                            className={`inline-flex min-h-9 items-center justify-center rounded-2xl px-3 py-2 text-center text-xs font-bold leading-none transition-colors ${
                              notificationFilter === "all"
                                ? "bg-white text-[var(--color-brand-700)] shadow-sm dark:bg-zinc-800 dark:text-[var(--color-brand-200)]"
                                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            }`}
                          >
                            Semua
                          </button>
                          <button
                            onClick={() => setNotificationFilter("unread")}
                            className={`inline-flex min-h-9 items-center justify-center rounded-2xl px-3 py-2 text-center text-xs font-bold leading-none transition-colors ${
                              notificationFilter === "unread"
                                ? "bg-white text-[var(--color-brand-700)] shadow-sm dark:bg-zinc-800 dark:text-[var(--color-brand-200)]"
                                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            }`}
                          >
                            Belum dibaca
                          </button>
                        </div>
                      </div>

                      <div className="border-b border-gray-100 bg-gradient-to-b from-[var(--color-brand-50)]/70 to-transparent px-3 py-3 sm:px-4 dark:border-gray-800 dark:from-[var(--color-brand-900)]/10">
                        <div className="flex items-center justify-between rounded-2xl border border-[var(--color-brand-100)] bg-white/90 px-3 py-2 dark:border-[var(--color-brand-900)]/40 dark:bg-zinc-950/80">
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500">Ringkasan</div>
                            <div className="mt-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">Inbox notifikasi akun</div>
                          </div>
                          <div className="rounded-2xl bg-[var(--color-brand-600)] px-3 py-1.5 text-xs font-extrabold text-white">
                            {visibleNotifications.length}
                          </div>
                        </div>
                      </div>

                      <div className="max-h-[min(380px,calc(100dvh-22rem))] overflow-y-auto px-2 py-2 md:max-h-[380px]">
                        {visibleNotifications.length === 0 ? (
                          <div className="flex flex-col items-center justify-center rounded-2xl px-4 py-10 text-center">
                            <div className="mb-3 rounded-2xl bg-gray-100 p-3 dark:bg-zinc-900">
                              <Bell className="h-5 w-5 text-gray-400" />
                            </div>
                            <div className="text-sm font-bold">
                              {notificationFilter === "unread" ? "Tidak ada notifikasi baru" : "Belum ada notifikasi"}
                            </div>
                            <div className="mt-1 max-w-[220px] text-xs leading-relaxed text-gray-500">
                              {notificationFilter === "unread"
                                ? "Semua update penting sudah kamu baca."
                                : "Notifikasi pesanan dan update akun akan muncul di sini."}
                            </div>
                          </div>
                        ) : (
                          visibleNotifications.map((notification) => {
                            const href = notification.reference_type === "order" && notification.reference_id ? `/orders/${notification.reference_id}` : "/orders";
                            return (
                              <Link
                                key={notification.id}
                                href={href}
                                onClick={() => void markNotificationRead(notification)}
                                className={`group block rounded-2xl border p-3 transition-colors ${notification.is_read ? "border-transparent hover:bg-gray-50 dark:hover:bg-zinc-900" : "border-[var(--color-brand-100)] bg-[var(--color-brand-50)]/70 hover:bg-[var(--color-brand-50)] dark:border-[var(--color-brand-900)]/40 dark:bg-[var(--color-brand-900)]/15"}`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 dark:bg-zinc-900 dark:ring-gray-800">
                                    <Bell className={`h-4 w-4 ${notification.is_read ? "text-gray-400" : "text-[var(--color-brand-600)]"}`} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="truncate text-sm font-bold">{notification.title}</span>
                                          {!notification.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-brand-600)]" />}
                                        </div>
                                        <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">
                                          {notification.message}
                                        </div>
                                      </div>
                                      <span className="shrink-0 whitespace-nowrap text-[11px] font-medium text-gray-400">
                                        {formatNotificationTime(notification.created_at)}
                                      </span>
                                    </div>
                                    <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--color-brand-600)] opacity-0 transition-opacity group-hover:opacity-100 dark:text-[var(--color-brand-200)]">
                                      Buka detail <ChevronRight className="h-3.5 w-3.5" />
                                    </div>
                                  </div>
                                </div>
                              </Link>
                            );
                          })
                        )}
                      </div>

                      <div className="border-t border-gray-100 p-2.5 sm:p-3 dark:border-gray-800">
                        <Link
                          href="/orders"
                          onClick={() => setNotificationOpen(false)}
                          className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:bg-zinc-900 dark:text-gray-200 dark:hover:bg-zinc-800"
                        >
                          <span>Lihat semua aktivitas pesanan</span>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <Link
              href="/cart"
              className="p-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors relative"
            >
              <ShoppingBag className="w-5 h-5" />
            </Link>

            {isAuthenticated ? (
              <div className="hidden md:flex items-center gap-2">
                {user?.role !== "admin" && (
                  <Link
                    href="/orders"
                    className={`p-2.5 rounded-xl transition-colors relative ${
                      pathname.startsWith("/orders")
                        ? "bg-[var(--color-brand-50)] text-[var(--color-brand-700)] dark:bg-[var(--color-brand-900)]/30 dark:text-[var(--color-brand-200)]"
                        : "hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                    title="Pesanan Saya"
                    aria-label="Pesanan Saya"
                  >
                    <ClipboardList className="w-5 h-5" />
                  </Link>
                )}
                <Link
                  href="/wishlist"
                  className="p-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors relative"
                  title="Wishlist"
                  aria-label="Wishlist"
                >
                  <Heart className="w-5 h-5" />
                </Link>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-[var(--color-brand-600)] flex items-center justify-center text-white text-xs font-bold">
                    {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <span className="text-sm font-medium max-w-[100px] truncate">
                    {user?.full_name || "User"}
                  </span>
                </Link>
                <button
                  onClick={logout}
                  className="p-2.5 hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-500 hover:text-red-500 rounded-xl transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="hidden md:flex px-5 py-2 bg-black text-white dark:bg-white dark:text-black rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Masuk
              </Link>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-gray-200/50 dark:border-gray-800/50 overflow-hidden"
          >
            <div className="px-4 py-4 flex flex-col gap-1">
              {navLinks.map((link, index) => (
                <Link
                  key={`${link.href}-${index}`}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? "bg-[var(--color-brand-50)] text-[var(--color-brand-700)]"
                      : "hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {isAuthenticated ? (
                <>
                  {user?.role === "admin" && (
                    <Link
                      href="/admin"
                      onClick={() => setMobileOpen(false)}
                      className={`px-4 py-3 rounded-xl text-sm font-medium ${
                        pathname.startsWith("/admin")
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
                          : "hover:bg-black/5 dark:hover:bg-white/5"
                      }`}
                    >
                      Admin Panel
                    </Link>
                  )}
                  <Link
                    href="/wishlist"
                    onClick={() => setMobileOpen(false)}
                    className="px-4 py-3 rounded-xl text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2"
                  >
                    <Heart className="w-4 h-4" /> Wishlist
                  </Link>
                  {user?.role !== "admin" && (
                    <Link
                      href="/orders"
                      onClick={() => setMobileOpen(false)}
                      className={`px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
                        pathname.startsWith("/orders")
                          ? "bg-[var(--color-brand-50)] text-[var(--color-brand-700)]"
                          : "hover:bg-black/5 dark:hover:bg-white/5"
                      }`}
                    >
                      <ClipboardList className="w-4 h-4" /> Pesanan Saya
                    </Link>
                  )}
                  <Link
                    href="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="px-4 py-3 rounded-xl text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2"
                  >
                    <User className="w-4 h-4" /> Profil Saya
                  </Link>
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      setNotificationOpen((open) => !open);
                    }}
                    className="px-4 py-3 rounded-xl text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2 text-left"
                  >
                    <Bell className="w-4 h-4" /> Notifikasi {unreadCount > 0 ? `(${unreadCount})` : ""}
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      setMobileOpen(false);
                    }}
                    className="px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 text-left"
                  >
                    Keluar
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="px-4 py-3 bg-black text-white dark:bg-white dark:text-black rounded-xl text-sm font-semibold text-center mt-2"
                >
                  Masuk
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
