import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/providers/AuthProvider";

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OrchidMart | Platform E-Commerce Anggrek Premium Indonesia",
  description:
    "Platform e-commerce khusus anggrek #1 di Indonesia. Temukan koleksi Phalaenopsis, Dendrobium, Vanda, Cattleya premium untuk hobbyist dan bisnis.",
  keywords: "anggrek, orchid, tanaman, bibit, nursery, phalaenopsis, dendrobium, vanda",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${outfit.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-full flex flex-col font-sans transition-colors duration-300">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
