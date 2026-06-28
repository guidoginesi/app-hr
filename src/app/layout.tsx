import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Fuente de marca POW — Helvetica Now Var (variable 100–900). Los títulos del DS
// la usan vía --font-helvetica-now → --font-display (igual que en app-adm).
const helveticaNow = localFont({
  src: [
    { path: "./fonts/HelveticaNowVar.ttf", weight: "100 900", style: "normal" },
    { path: "./fonts/HelveticaNowVarItalic.ttf", weight: "100 900", style: "italic" },
  ],
  variable: "--font-helvetica-now",
  display: "swap",
});

export const metadata: Metadata = {
  title: "POW Apps - Sistema de Gestión de CV",
  description: "Plataforma de reclutamiento y selección de candidatos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={helveticaNow.variable}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
