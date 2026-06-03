"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface BrandAvatarProps {
  readonly fallback?: string; // initials or single letter
  readonly size?: "sm" | "md";
}

export default function BrandAvatar({ fallback = "B", size = "md" }: BrandAvatarProps) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/brands")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const brands = Array.isArray(data) ? data : (data?.brands ?? []);
        const brand = brands[0];
        if (!brand) return;
        setBrandId(brand.id);
        // Fetch signed logo URL
        fetch(`/api/brands/${brand.id}/logo-url`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data?.url) {
              const raw = data.url as string;
              const proxied = `/api/image-proxy?url=${encodeURIComponent(
                raw.startsWith("gs://")
                  ? raw.replace("gs://", "https://storage.googleapis.com/")
                  : raw.replace("https://storage.cloud.google.com/", "https://storage.googleapis.com/")
              )}`;
              setLogoUrl(proxied);
            }
          })
          .catch(() => {});
      })
      .catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const dim = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`${dim} rounded-full overflow-hidden border-2 border-zinc-200 hover:border-[#4CAF31] transition-colors flex items-center justify-center bg-zinc-100 focus:outline-none`}
        title="Brand settings"
      >
        {logoUrl ? (
          <img src={logoUrl} alt="Brand logo" className="w-full h-full object-contain p-0.5" />
        ) : (
          <span className="font-bold text-[#0052CC] italic">{fallback}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-44 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden">
          {brandId && (
            <button
              onClick={() => { setOpen(false); router.push(`/brands?edit=${brandId}`); }}
              className="w-full text-left px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit Brand
            </button>
          )}
          <button
            onClick={() => { setOpen(false); router.push("/brands"); }}
            className="w-full text-left px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Brand Details
          </button>
        </div>
      )}
    </div>
  );
}
