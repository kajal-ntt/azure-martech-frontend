/**
 * Shared font registry used by both the image editor (Fabric.js) and
 * video editor (Konva). Fonts are loaded from Google Fonts.
 *
 * Categories mirror Canva's font picker groupings.
 */

export interface FontEntry {
  name: string;          // Exact Google Fonts family name (used in CSS + canvas)
  category: FontCategory;
  weights?: string;      // Google Fonts weight spec, e.g. "400;700" (default: "400;700")
}

export type FontCategory =
  | "Sans Serif"
  | "Serif"
  | "Display"
  | "Handwriting"
  | "Monospace"
  | "Condensed";

export const FONT_LIBRARY: FontEntry[] = [
  // ── Sans Serif ──────────────────────────────────────────────────────────────
  { name: "Inter",            category: "Sans Serif",  weights: "300;400;500;600;700;800" },
  { name: "Poppins",          category: "Sans Serif",  weights: "300;400;500;600;700;800" },
  { name: "Montserrat",       category: "Sans Serif",  weights: "300;400;500;600;700;800;900" },
  { name: "Raleway",          category: "Sans Serif",  weights: "300;400;500;600;700;800" },
  { name: "Nunito",           category: "Sans Serif",  weights: "300;400;600;700;800" },
  { name: "Lato",             category: "Sans Serif",  weights: "300;400;700;900" },
  { name: "Open Sans",        category: "Sans Serif",  weights: "300;400;600;700;800" },
  { name: "Roboto",           category: "Sans Serif",  weights: "300;400;500;700;900" },
  { name: "DM Sans",          category: "Sans Serif",  weights: "300;400;500;600;700" },
  { name: "Plus Jakarta Sans",category: "Sans Serif",  weights: "300;400;500;600;700;800" },
  { name: "Outfit",           category: "Sans Serif",  weights: "300;400;500;600;700;800" },
  { name: "Figtree",          category: "Sans Serif",  weights: "300;400;500;600;700;800" },

  // ── Serif ───────────────────────────────────────────────────────────────────
  { name: "Playfair Display", category: "Serif",       weights: "400;500;600;700;800;900" },
  { name: "Merriweather",     category: "Serif",       weights: "300;400;700;900" },
  { name: "Lora",             category: "Serif",       weights: "400;500;600;700" },
  { name: "EB Garamond",      category: "Serif",       weights: "400;500;600;700;800" },
  { name: "Cormorant Garamond",category: "Serif",      weights: "300;400;500;600;700" },
  { name: "Libre Baskerville",category: "Serif",       weights: "400;700" },
  { name: "Crimson Text",     category: "Serif",       weights: "400;600;700" },

  // ── Display ─────────────────────────────────────────────────────────────────
  { name: "Bebas Neue",       category: "Display",     weights: "400" },
  { name: "Anton",            category: "Display",     weights: "400" },
  { name: "Oswald",           category: "Display",     weights: "300;400;500;600;700" },
  { name: "Righteous",        category: "Display",     weights: "400" },
  { name: "Fredoka One",      category: "Display",     weights: "400" },
  { name: "Boogaloo",         category: "Display",     weights: "400" },
  { name: "Lobster",          category: "Display",     weights: "400" },
  { name: "Pacifico",         category: "Display",     weights: "400" },
  { name: "Alfa Slab One",    category: "Display",     weights: "400" },
  { name: "Black Han Sans",   category: "Display",     weights: "400" },
  { name: "Titan One",        category: "Display",     weights: "400" },

  // ── Handwriting ─────────────────────────────────────────────────────────────
  { name: "Dancing Script",   category: "Handwriting", weights: "400;500;600;700" },
  { name: "Great Vibes",      category: "Handwriting", weights: "400" },
  { name: "Parisienne",       category: "Handwriting", weights: "400" },
  { name: "Sacramento",       category: "Handwriting", weights: "400" },
  { name: "Satisfy",          category: "Handwriting", weights: "400" },
  { name: "Caveat",           category: "Handwriting", weights: "400;500;600;700" },
  { name: "Kalam",            category: "Handwriting", weights: "300;400;700" },
  { name: "Indie Flower",     category: "Handwriting", weights: "400" },

  // ── Monospace ───────────────────────────────────────────────────────────────
  { name: "Space Mono",       category: "Monospace",   weights: "400;700" },
  { name: "Fira Code",        category: "Monospace",   weights: "300;400;500;600;700" },
  { name: "JetBrains Mono",   category: "Monospace",   weights: "300;400;500;600;700;800" },
  { name: "Source Code Pro",  category: "Monospace",   weights: "300;400;500;600;700;900" },

  // ── Condensed ───────────────────────────────────────────────────────────────
  { name: "Barlow Condensed", category: "Condensed",   weights: "300;400;500;600;700;800" },
  { name: "Roboto Condensed", category: "Condensed",   weights: "300;400;700" },
  { name: "Fjalla One",       category: "Condensed",   weights: "400" },
];

/** All font names as a flat array — used in dropdowns */
export const ALL_FONT_NAMES = FONT_LIBRARY.map((f) => f.name);

/** Fonts grouped by category */
export const FONTS_BY_CATEGORY = FONT_LIBRARY.reduce<Record<FontCategory, FontEntry[]>>(
  (acc, font) => {
    if (!acc[font.category]) acc[font.category] = [];
    acc[font.category].push(font);
    return acc;
  },
  {} as Record<FontCategory, FontEntry[]>
);

/**
 * Build a Google Fonts CSS URL that loads all fonts in the library.
 * Uses the `family` parameter repeated for each font.
 */
export function buildGoogleFontsUrl(): string {
  const families = FONT_LIBRARY.map((f) => {
    const name = f.name.replaceAll(" ", "+");
    const weights = f.weights ?? "400;700";
    return `family=${name}:wght@${weights}`;
  });
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}

/**
 * Dynamically inject the Google Fonts stylesheet into the document head.
 * Safe to call multiple times — only injects once.
 */
export function loadGoogleFonts(): void {
  if (typeof document === "undefined") return;
  const id = "martech-google-fonts";
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = buildGoogleFontsUrl();
  document.head.appendChild(link);
}
