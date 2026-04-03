import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Energy-Compliance Hub - Plataforma HSE",
  description: "Plataforma de gestión de permisos de trabajo y cumplimiento HSE para la industria energética.",
  keywords: ["HSE", "seguridad", "permisos", "compliance", "energía", "SaaS"],
  authors: [{ name: "Energy-Compliance Hub" }],
  icons: {
    icon: "/logo.jpeg",
  },
  openGraph: {
    title: "Energy-Compliance Hub",
    description: "Plataforma de gestión de permisos de trabajo y cumplimiento HSE",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
