import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/providers/AuthProvider";
import FeedbackProvider from "@/components/providers/FeedbackProvider";

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
      style={
        {
          "--font-sans": '"Segoe UI", Arial, sans-serif',
          "--font-display": "Georgia, serif",
        } as React.CSSProperties
      }
      className="h-full antialiased"
      data-scroll-behavior="smooth"
    >
      <body className="min-h-full flex flex-col font-sans transition-colors duration-300">
        <FeedbackProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </FeedbackProvider>
      </body>
    </html>
  );
}
