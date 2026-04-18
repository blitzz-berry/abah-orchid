import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OrchidMart | Premium Orchid Plants & Seeds",
  description: "Your one-stop destination for premium orchid plants, seeds, and care supplies. Available for hobbyists and B2B orders alike.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans transition-colors duration-300">
        <main className="flex-grow">
          {children}
        </main>
      </body>
    </html>
  );
}
