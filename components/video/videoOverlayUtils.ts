/**
 * Pure utility functions for VideoOverlayEditor.
 *
 * Kept in a separate file so they can be imported by unit tests without
 * pulling in the react-konva / @ffmpeg/ffmpeg dependency chain.
 */

import type { BrandKit } from "@/components/video/VideoOverlayEditor";

/**
 * Returns true when the URL points to Google Cloud Storage and should be
 * loaded via the image proxy endpoint.
 */
export function isGcsUrl(url: string): boolean {
  return (
    url.startsWith("gs://") ||
    url.startsWith("https://storage.googleapis.com/")
  );
}

/**
 * Builds the proxied URL for a GCS-hosted image.
 */
export function buildProxiedUrl(originalUrl: string): string {
  return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
}

/**
 * Derives brand colors from a brand kit, filtering out null/undefined values.
 */
export function deriveBrandColors(brandKit: BrandKit | null): string[] {
  return [
    brandKit?.primaryColor,
    brandKit?.secondaryColor,
    brandKit?.accentColor,
  ].filter((c): c is string => Boolean(c));
}
