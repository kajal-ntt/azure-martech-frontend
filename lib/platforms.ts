/**
 * Platform registry for platform-aware image generation.
 * This module is the single source of truth for platform metadata on the frontend.
 * The same platform list and orientation algorithm are mirrored in
 * `martech_agents/platforms.py` on the agent layer.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type Orientation = 'portrait' | 'landscape' | 'square' | 'unknown';

export interface PlatformDefinition {
  /** Kebab-case identifier, e.g. "instagram-feed" */
  id: string;
  /** Display name, e.g. "Instagram Feed" */
  name: string;
  /** W:H string, e.g. "1:1" */
  aspectRatio: string;
  /** Resolved orientation derived from aspectRatio */
  orientation: Orientation;
}

export interface TargetPlatform {
  platformName: string;
  aspectRatio: string;
  orientation: Orientation;
}

// ── Orientation resolver ───────────────────────────────────────────────────

/**
 * Resolves the orientation of an aspect ratio string in `W:H` format.
 *
 * Rules:
 * - W > H  → 'landscape'
 * - H > W  → 'portrait'
 * - W === H → 'square'
 * - Invalid input (non-numeric, zero, negative, missing colon) → 'unknown' + console.warn
 *
 * @param aspectRatio - A string in "W:H" format, e.g. "16:9", "9:16", "1:1"
 * @returns The resolved Orientation, or 'unknown' for invalid input
 */
export function resolveOrientation(aspectRatio: string): Orientation {
  const parts = aspectRatio.split(':');

  if (parts.length !== 2) {
    console.warn(`[platforms] resolveOrientation: invalid aspect ratio "${aspectRatio}" — expected "W:H" format`);
    return 'unknown';
  }

  const w = parseFloat(parts[0]);
  const h = parseFloat(parts[1]);

  if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) {
    console.warn(`[platforms] resolveOrientation: invalid aspect ratio "${aspectRatio}" — width and height must be positive finite numbers`);
    return 'unknown';
  }

  if (w > h) return 'landscape';
  if (h > w) return 'portrait';
  return 'square';
}

// ── Conversion helper ──────────────────────────────────────────────────────

/**
 * Converts a PlatformDefinition to a TargetPlatform for storage on the campaign record.
 */
export function toTargetPlatform(platform: PlatformDefinition): TargetPlatform {
  return {
    platformName: platform.name,
    aspectRatio: platform.aspectRatio,
    orientation: platform.orientation,
  };
}

// ── Platform registry ──────────────────────────────────────────────────────

/**
 * Canonical list of supported publishing platforms.
 * Orientations are pre-resolved from aspect ratios using resolveOrientation.
 *
 * Requirements: 1.2, 2.1, 2.3, 2.4
 */
export const PLATFORMS: PlatformDefinition[] = [
  {
    id: 'instagram-feed',
    name: 'Instagram Feed',
    aspectRatio: '1:1',
    orientation: 'square',
  },
  {
    id: 'instagram-story',
    name: 'Instagram Story',
    aspectRatio: '9:16',
    orientation: 'portrait',
  },
  {
    id: 'instagram-reel',
    name: 'Instagram Reel',
    aspectRatio: '9:16',
    orientation: 'portrait',
  },
  {
    id: 'facebook-post',
    name: 'Facebook Post',
    aspectRatio: '1:1',
    orientation: 'square',
  },
  {
    id: 'facebook-story',
    name: 'Facebook Story',
    aspectRatio: '9:16',
    orientation: 'portrait',
  },
  {
    id: 'linkedin-post',
    name: 'LinkedIn Post',
    aspectRatio: '1.91:1',
    orientation: 'landscape',
  },
  {
    id: 'twitter-x-post',
    name: 'Twitter/X Post',
    aspectRatio: '16:9',
    orientation: 'landscape',
  },
  {
    id: 'youtube-thumbnail',
    name: 'YouTube Thumbnail',
    aspectRatio: '16:9',
    orientation: 'landscape',
  },
  {
    id: 'pinterest-pin',
    name: 'Pinterest Pin',
    aspectRatio: '2:3',
    orientation: 'portrait',
  },
  {
    id: 'google-display-ad',
    name: 'Google Display Ad',
    aspectRatio: '1.91:1',
    orientation: 'landscape',
  },
];
