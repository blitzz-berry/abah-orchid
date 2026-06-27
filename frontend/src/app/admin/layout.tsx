"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  TicketPercent,
  Warehouse,
  Users,
  LogOut,
  Leaf,
  ChevronRight,
  Menu,
  X,
  CheckCheck,
  BarChart3,
  Megaphone,
  Bell,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useEffect, useRef, useState } from "react";
import { PageSpinner } from "@/components/ui/loading";
import { AnimatePresence, motion } from "framer-motion";
import api from "@/lib/api";
import { onRealtimeEvent } from "@/lib/realtime";
import type { Notification } from "@/types";

const sidebarLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Produk", icon: Package },
  { href: "/admin/orders", label: "Pesanan", icon: ShoppingCart },
  { href: "/admin/inventory", label: "Inventori", icon: Warehouse },
  { href: "/admin/reports", label: "Laporan", icon: BarChart3 },
  { href: "/admin/campaigns", label: "Promosi & Campaign", icon: Megaphone },
  { href: "/admin/coupons", label: "Kupon", icon: TicketPercent },
  { href: "/admin/customers", label: "Pelanggan", icon: Users },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isHydrated, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const notificationContainersRef = useRef<Array<HTMLDivElement | null>>([]);
  const unreadReturnCount = notifications.filter((notification) => isUnreadReturnNotification(notification)).length;
  const hasUnreadReturnNotification = unreadReturnCount > 0;

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return
    }
    if (user?.role !== "admin") {
      router.replace("/");
    }
  }, [isAuthenticated, isHydrated, router, user]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || user?.role !== "admin") {
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
  }, [isAuthenticated, isHydrated, user]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || user?.role !== "admin") return;
    return onRealtimeEvent((event) => {
      if (event.type !== "notification.created") return;
      void api.get("/notifications").then((response) => {
        const payload = response.data.data || response.data;
        setNotifications(payload.notifications || []);
        setUnreadCount(payload.unread_count || 0);
      }).catch(() => undefined);
    });
  }, [isAuthenticated, isHydrated, user]);

  useEffect(() => {
    if (!notificationOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (notificationContainersRef.current.some((container) => container?.contains(target))) return;
      setNotificationOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [notificationOpen]);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

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

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <PageSpinner label="Menyiapkan admin..." />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex">
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 px-3 min-[360px]:px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Leaf className="w-6 h-6 shrink-0 text-[var(--color-leaf-500)]" />
          <span className="truncate text-base font-bold min-[360px]:text-lg">OrchidAdmin</span>
        </div>
        <div className="flex items-center gap-2">
          <div ref={(node) => { notificationContainersRef.current[0] = node; }} className="relative">
            <button
              onClick={() => setNotificationOpen((open) => !open)}
              className={`relative rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-zinc-900 ${hasUnreadReturnNotification ? "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-200" : ""}`}
            >
              <Bell className={`h-5 w-5 ${hasUnreadReturnNotification ? "animate-pulse" : ""}`} />
              {unreadCount > 0 && (
                <span className={`absolute -right-0.5 -top-0.5 min-w-5 rounded-full px-1 text-center text-[10px] font-bold text-white ${hasUnreadReturnNotification ? "bg-orange-500" : "bg-red-500"}`}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <AdminNotificationDropdown
              notificationOpen={notificationOpen}
              notifications={notifications}
              unreadCount={unreadCount}
              markAllNotificationsRead={markAllNotificationsRead}
              markNotificationRead={markNotificationRead}
            />
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-lg"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-white dark:bg-black
          border-r border-gray-200 dark:border-gray-800 p-6 flex flex-col
          transition-transform duration-300 md:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="hidden md:flex items-center gap-2 mb-8">
          <Leaf className="w-7 h-7 text-[var(--color-leaf-500)]" />
          <h2 className="text-xl font-extrabold tracking-tight">OrchidAdmin</h2>
          <div ref={(node) => { notificationContainersRef.current[1] = node; }} className="ml-auto relative">
            <button
              onClick={() => setNotificationOpen((open) => !open)}
              className={`relative rounded-xl p-2 hover:bg-gray-100 dark:hover:bg-zinc-900 ${hasUnreadReturnNotification ? "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-200" : ""}`}
              title="Notifikasi admin"
            >
              <Bell className={`h-5 w-5 ${hasUnreadReturnNotification ? "animate-pulse" : ""}`} />
              {unreadCount > 0 && (
                <span className={`absolute -right-0.5 -top-0.5 min-w-5 rounded-full px-1 text-center text-[10px] font-bold text-white ${hasUnreadReturnNotification ? "bg-orange-500" : "bg-red-500"}`}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <AdminNotificationDropdown
              notificationOpen={notificationOpen}
              notifications={notifications}
              unreadCount={unreadCount}
              markAllNotificationsRead={markAllNotificationsRead}
              markNotificationRead={markNotificationRead}
              align="left"
            />
          </div>
        </div>

        <nav className="flex flex-col gap-1 flex-1 mt-14 md:mt-0">
          {sidebarLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                  ${
                    active
                      ? "bg-black text-white dark:bg-white dark:text-black shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-900 hover:text-black dark:hover:text-white"
                  }
                `}
              >
                <link.icon className="w-5 h-5" />
                {link.label}
                {link.href === "/admin/orders" && unreadCount > 0 && (
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-white/20 text-white dark:bg-black/10 dark:text-black" : hasUnreadReturnNotification ? "bg-orange-500 text-white" : "bg-red-500 text-white"}`}>
                    {hasUnreadReturnNotification ? unreadReturnCount : unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
                {active && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-200 dark:border-gray-800 pt-4 flex flex-col gap-2">
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <Leaf className="w-5 h-5" />
            Ke Storefront
          </Link>
          <button
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors w-full text-left"
          >
            <LogOut className="w-5 h-5" />
            Keluar
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}

function isUnreadReturnNotification(notification: Notification) {
  return !notification.is_read && notification.title === "Pengajuan retur baru";
}

function AdminNotificationDropdown({
  notificationOpen,
  notifications,
  unreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  align = "right",
}: {
  notificationOpen: boolean;
  notifications: Notification[];
  unreadCount: number;
  markAllNotificationsRead: () => void;
  markNotificationRead: (notification: Notification) => void;
  align?: "left" | "right";
}) {
  return (
    <AnimatePresence>
      {notificationOpen && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className={`fixed left-3 right-3 top-16 z-50 max-h-[calc(100dvh-5rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-zinc-950 md:absolute md:top-auto md:mt-2 md:w-[320px] md:max-h-none md:max-w-[calc(100vw-2rem)] ${align === "left" ? "md:left-0" : "md:right-0"}`}
        >
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-3 sm:p-4 dark:border-gray-800">
            <div className="min-w-0 truncate text-sm font-bold">Notifikasi Admin</div>
            {unreadCount > 0 && (
              <button onClick={markAllNotificationsRead} className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[var(--color-brand-600)]">
                <CheckCheck className="h-3.5 w-3.5" /> <span className="hidden min-[360px]:inline">Tandai dibaca</span><span className="min-[360px]:hidden">Dibaca</span>
              </button>
            )}
          </div>
          <div className="max-h-[calc(100dvh-11rem)] overflow-y-auto md:max-h-[360px]">
            {notifications.length === 0 ? (
              <div className="p-5 text-center text-sm text-gray-500">Belum ada notifikasi admin.</div>
            ) : (
              notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={adminNotificationHref(notification)}
                  onClick={() => void markNotificationRead(notification)}
                  className={`block border-b border-gray-100 p-3 last:border-b-0 hover:bg-gray-50 sm:p-4 dark:border-gray-800 dark:hover:bg-zinc-900 ${notification.is_read ? "" : isUnreadReturnNotification(notification) ? "bg-orange-50/90 dark:bg-orange-950/30 ring-1 ring-orange-200 dark:ring-orange-900" : "bg-orange-50/70 dark:bg-orange-950/20"}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.is_read ? "bg-gray-300" : isUnreadReturnNotification(notification) ? "bg-orange-500" : "bg-[var(--color-brand-600)]"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{notification.title}</div>
                      <div className="mt-1 text-xs leading-relaxed text-gray-500">{notification.message}</div>
                      {notification.created_at && (
                        <div className="mt-2 text-[11px] text-gray-400">{new Date(notification.created_at).toLocaleString("id-ID")}</div>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function adminNotificationHref(notification: Notification) {
  if (notification.reference_type === "order" && notification.reference_id) {
    if (notification.title === "Pengajuan retur baru") {
      return `/admin/orders?status=RETURN_REQUESTED&focus=${notification.reference_id}`;
    }
    return `/admin/orders?focus=${notification.reference_id}`;
  }
  return "/admin";
}
