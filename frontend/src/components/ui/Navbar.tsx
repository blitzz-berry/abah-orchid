"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf, ShoppingBag, User, LogOut, Menu, X, Search } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: "/products", label: "Katalog" },
    { href: "/products?type=B2B", label: "B2B Order" },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <nav className="glass fixed top-0 w-full z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Leaf className="w-7 h-7 text-[var(--color-leaf-500)]" />
            <span className="text-xl font-bold tracking-tight">OrchidMart</span>
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
            <Link
              href="/cart"
              className="p-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors relative"
            >
              <ShoppingBag className="w-5 h-5" />
            </Link>

            {isAuthenticated ? (
              <div className="hidden md:flex items-center gap-2">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--color-brand-400)] to-[var(--color-leaf-500)] flex items-center justify-center text-white text-xs font-bold">
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
                    href="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="px-4 py-3 rounded-xl text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2"
                  >
                    <User className="w-4 h-4" /> Profil Saya
                  </Link>
                  <Link
                    href="/orders"
                    onClick={() => setMobileOpen(false)}
                    className="px-4 py-3 rounded-xl text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    Pesanan Saya
                  </Link>
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
