import type { Metadata } from "next";
import "./globals.css";
import PreventBackNavigation from "@/components/PreventBackNavigation";

export const metadata: Metadata = {
  title: "MARTECH - Marketing Technology Solution",
  description: "AI-powered marketing campaign management platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/* ❌ Removed Google Fonts (causing Docker build crash) */}
      </head>
      <body className="min-h-full flex flex-col">
        <PreventBackNavigation />
        {children}
      </body>
    </html>
  );
}