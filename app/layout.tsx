import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PreventBackNavigation from "@/components/PreventBackNavigation";
import { buildGoogleFontsUrl } from "@/lib/fonts";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MARTECH - Marketing Technology Solution",
  description: "AI-powered marketing campaign management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Preconnect for faster Google Fonts loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* All editor fonts */}
        <link rel="stylesheet" href={buildGoogleFontsUrl()} />
      </head>
      <body className="min-h-full flex flex-col">
        <PreventBackNavigation />
        {children}
      </body>
    </html>
  );
}
