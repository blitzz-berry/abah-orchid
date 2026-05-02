"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, User, LogOut, Menu, X, Heart, Bell, CheckCheck, ClipboardList } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import type { Notification } from "@/types";

export default function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const navLinks = [
    { href: "/products", label: "Katalog" },
    { href: "/products?type=B2B", label: "B2B Order" },
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

  return (
    <nav className="glass fixed top-0 w-full z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <img src="/images/anggrek.png" alt="Logo" className="w-8 h-8 object-contain" />
            <span className="text-xl font-bold tracking-tight">
              Abah<span className="text-[var(--color-leaf-600)]">Orchid</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
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
          <div className="flex items-center gap-2">
            {isAuthenticated && user?.role !== "admin" && (
              <div className="relative">
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
                      className="absolute right-0 mt-2 w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden"
                    >
                      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                        <div className="font-bold text-sm">Notifikasi</div>
                        {unreadCount > 0 && (
                          <button onClick={markAllNotificationsRead} className="text-xs font-bold text-[var(--color-brand-600)] inline-flex items-center gap-1">
                            <CheckCheck className="w-3.5 h-3.5" /> Tandai dibaca
                          </button>
                        )}
                      </div>
                      <div className="max-h-[360px] overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-5 text-sm text-gray-500 text-center">Belum ada notifikasi.</div>
                        ) : (
                          notifications.map((notification) => {
                            const href = notification.reference_type === "order" && notification.reference_id ? `/orders/${notification.reference_id}` : "/orders";
                            return (
                              <Link
                                key={notification.id}
                                href={href}
                                onClick={() => void markNotificationRead(notification)}
                                className={`block p-4 border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-zinc-900 ${notification.is_read ? "" : "bg-[var(--color-brand-50)]/70 dark:bg-[var(--color-brand-900)]/20"}`}
                              >
                                <div className="flex items-start gap-3">
                                  <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${notification.is_read ? "bg-gray-300" : "bg-[var(--color-brand-600)]"}`} />
                                  <div className="min-w-0">
                                    <div className="text-sm font-bold">{notification.title}</div>
                                    <div className="text-xs text-gray-500 leading-relaxed mt-1">{notification.message}</div>
                                    {notification.created_at && (
                                      <div className="text-[11px] text-gray-400 mt-2">{new Date(notification.created_at).toLocaleString("id-ID")}</div>
                                    )}
                                  </div>
                                </div>
                              </Link>
                            );
                          })
                        )}
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
              {navLinks.map((link) => (
                <Link
                  key={link.href}
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
                    onClick={() => setNotificationOpen((open) => !open)}
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
