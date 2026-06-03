/**
 * Shape and element library for the image/video editors.
 * Each entry has an SVG path (viewBox 0 0 100 100) and display metadata.
 * Fabric.js renders these as scalable, fully editable Path objects.
 */

export interface ShapeEntry {
  id: string;
  label: string;
  category: ShapeCategory;
  /** SVG path data string (viewBox 0 0 100 100) */
  path: string;
  /** Default fill color */
  defaultFill?: string;
  /** Whether to show stroke by default */
  defaultStroke?: boolean;
}

export type ShapeCategory =
  | "Basic"
  | "Arrows"
  | "Speech"
  | "Stars & Badges"
  | "Lines"
  | "Abstract"
  | "Elements";

export const SHAPE_LIBRARY: ShapeEntry[] = [
  // ── Basic ──────────────────────────────────────────────────────────────────
  {
    id: "rect",
    label: "Rectangle",
    category: "Basic",
    path: "M5,5 H95 V95 H5 Z",
  },
  {
    id: "rounded-rect",
    label: "Rounded Rect",
    category: "Basic",
    path: "M15,5 H85 Q95,5 95,15 V85 Q95,95 85,95 H15 Q5,95 5,85 V15 Q5,5 15,5 Z",
  },
  {
    id: "circle",
    label: "Circle",
    category: "Basic",
    path: "M50,5 A45,45 0 1,1 49.99,5 Z",
  },
  {
    id: "triangle",
    label: "Triangle",
    category: "Basic",
    path: "M50,5 L95,95 L5,95 Z",
  },
  {
    id: "right-triangle",
    label: "Right Triangle",
    category: "Basic",
    path: "M5,95 L95,95 L5,5 Z",
  },
  {
    id: "diamond",
    label: "Diamond",
    category: "Basic",
    path: "M50,5 L95,50 L50,95 L5,50 Z",
  },
  {
    id: "pentagon",
    label: "Pentagon",
    category: "Basic",
    path: "M50,5 L95,36 L78,90 L22,90 L5,36 Z",
  },
  {
    id: "hexagon",
    label: "Hexagon",
    category: "Basic",
    path: "M50,5 L90,27.5 L90,72.5 L50,95 L10,72.5 L10,27.5 Z",
  },
  {
    id: "octagon",
    label: "Octagon",
    category: "Basic",
    path: "M30,5 L70,5 L95,30 L95,70 L70,95 L30,95 L5,70 L5,30 Z",
  },
  {
    id: "parallelogram",
    label: "Parallelogram",
    category: "Basic",
    path: "M25,5 H95 L75,95 H5 Z",
  },
  {
    id: "trapezoid",
    label: "Trapezoid",
    category: "Basic",
    path: "M20,5 H80 L95,95 H5 Z",
  },
  {
    id: "cross",
    label: "Cross",
    category: "Basic",
    path: "M35,5 H65 V35 H95 V65 H65 V95 H35 V65 H5 V35 H35 Z",
  },

  // ── Stars & Badges ─────────────────────────────────────────────────────────
  {
    id: "star-4",
    label: "4-Point Star",
    category: "Stars & Badges",
    path: "M50,5 L58,42 L95,50 L58,58 L50,95 L42,58 L5,50 L42,42 Z",
  },
  {
    id: "star-5",
    label: "5-Point Star",
    category: "Stars & Badges",
    path: "M50,5 L61,35 L95,35 L68,57 L79,91 L50,70 L21,91 L32,57 L5,35 L39,35 Z",
  },
  {
    id: "star-6",
    label: "6-Point Star",
    category: "Stars & Badges",
    path: "M50,5 L60,30 L87,18 L75,45 L95,50 L75,55 L87,82 L60,70 L50,95 L40,70 L13,82 L25,55 L5,50 L25,45 L13,18 L40,30 Z",
  },
  {
    id: "burst-8",
    label: "8-Point Burst",
    category: "Stars & Badges",
    path: "M50,5 L55,35 L75,15 L65,42 L95,38 L72,55 L95,65 L65,62 L75,88 L55,68 L50,95 L45,68 L25,88 L35,62 L5,65 L28,55 L5,38 L35,42 L25,15 L45,35 Z",
  },
  {
    id: "badge-circle",
    label: "Badge",
    category: "Stars & Badges",
    path: "M50,2 L56,18 L73,8 L70,26 L88,22 L80,38 L97,42 L85,54 L97,66 L80,68 L88,84 L70,80 L73,98 L56,88 L50,104 L44,88 L27,98 L30,80 L12,84 L20,68 L3,66 L15,54 L3,42 L20,38 L12,22 L30,26 L27,8 L44,18 Z",
    defaultFill: "#FF5722",
  },
  {
    id: "ribbon",
    label: "Ribbon",
    category: "Stars & Badges",
    path: "M50,5 L60,25 L85,20 L75,40 L95,50 L75,60 L85,80 L60,75 L50,95 L40,75 L15,80 L25,60 L5,50 L25,40 L15,20 L40,25 Z",
    defaultFill: "#E91E63",
  },

  // ── Arrows ─────────────────────────────────────────────────────────────────
  {
    id: "arrow-right",
    label: "Arrow Right",
    category: "Arrows",
    path: "M5,38 H65 V20 L95,50 L65,80 V62 H5 Z",
  },
  {
    id: "arrow-left",
    label: "Arrow Left",
    category: "Arrows",
    path: "M95,38 H35 V20 L5,50 L35,80 V62 H95 Z",
  },
  {
    id: "arrow-up",
    label: "Arrow Up",
    category: "Arrows",
    path: "M38,95 V35 H20 L50,5 L80,35 H62 V95 Z",
  },
  {
    id: "arrow-down",
    label: "Arrow Down",
    category: "Arrows",
    path: "M38,5 V65 H20 L50,95 L80,65 H62 V5 Z",
  },
  {
    id: "double-arrow",
    label: "Double Arrow",
    category: "Arrows",
    path: "M5,50 L25,25 V38 H75 V25 L95,50 L75,75 V62 H25 V75 Z",
  },
  {
    id: "curved-arrow",
    label: "Curved Arrow",
    category: "Arrows",
    path: "M20,80 Q20,20 80,20 L70,10 L95,25 L75,45 L65,32 Q30,32 30,80 Z",
  },
  {
    id: "chevron-right",
    label: "Chevron",
    category: "Arrows",
    path: "M20,5 L70,50 L20,95 L35,95 L85,50 L35,5 Z",
  },

  // ── Speech ─────────────────────────────────────────────────────────────────
  {
    id: "speech-bubble",
    label: "Speech Bubble",
    category: "Speech",
    path: "M10,5 Q5,5 5,10 V60 Q5,65 10,65 H35 L50,85 L65,65 H90 Q95,65 95,60 V10 Q95,5 90,5 Z",
  },
  {
    id: "speech-round",
    label: "Round Bubble",
    category: "Speech",
    path: "M50,5 A40,40 0 1,1 49.99,5 Z M30,75 L50,95 L55,75 Z",
  },
  {
    id: "thought-bubble",
    label: "Thought Bubble",
    category: "Speech",
    path: "M50,10 A35,30 0 1,1 49.99,10 Z M30,72 A8,8 0 1,1 29.99,72 Z M20,85 A5,5 0 1,1 19.99,85 Z M12,93 A3,3 0 1,1 11.99,93 Z",
  },
  {
    id: "label-tag",
    label: "Label Tag",
    category: "Speech",
    path: "M5,5 H75 L95,50 L75,95 H5 Z",
  },

  // ── Lines ──────────────────────────────────────────────────────────────────
  {
    id: "line-h",
    label: "Line",
    category: "Lines",
    path: "M5,50 H95",
    defaultStroke: true,
    defaultFill: "transparent",
  },
  {
    id: "line-diagonal",
    label: "Diagonal",
    category: "Lines",
    path: "M5,95 L95,5",
    defaultStroke: true,
    defaultFill: "transparent",
  },
  {
    id: "line-wavy",
    label: "Wavy Line",
    category: "Lines",
    path: "M5,50 Q20,30 35,50 Q50,70 65,50 Q80,30 95,50",
    defaultStroke: true,
    defaultFill: "transparent",
  },
  {
    id: "line-zigzag",
    label: "Zigzag",
    category: "Lines",
    path: "M5,65 L20,35 L35,65 L50,35 L65,65 L80,35 L95,65",
    defaultStroke: true,
    defaultFill: "transparent",
  },
  {
    id: "line-dashed",
    label: "Dashed",
    category: "Lines",
    path: "M5,50 H25 M35,50 H55 M65,50 H85 M90,50 H95",
    defaultStroke: true,
    defaultFill: "transparent",
  },

  // ── Abstract ───────────────────────────────────────────────────────────────
  {
    id: "heart",
    label: "Heart",
    category: "Abstract",
    path: "M50,85 C20,65 5,50 5,32 A20,20 0 0,1 50,20 A20,20 0 0,1 95,32 C95,50 80,65 50,85 Z",
    defaultFill: "#E91E63",
  },
  {
    id: "cloud",
    label: "Cloud",
    category: "Abstract",
    path: "M25,70 Q10,70 10,55 Q10,42 22,40 Q20,20 38,18 Q48,5 62,12 Q75,5 82,18 Q95,20 95,35 Q100,50 88,55 Q90,70 75,70 Z",
  },
  {
    id: "lightning",
    label: "Lightning",
    category: "Abstract",
    path: "M60,5 L25,55 H50 L40,95 L75,45 H50 Z",
    defaultFill: "#FFC107",
  },
  {
    id: "moon",
    label: "Moon",
    category: "Abstract",
    path: "M65,10 A40,40 0 1,0 65,90 A30,30 0 1,1 65,10 Z",
    defaultFill: "#9C27B0",
  },
  {
    id: "sun",
    label: "Sun",
    category: "Abstract",
    path: "M50,20 A30,30 0 1,1 49.99,20 Z M50,5 V15 M50,85 V95 M5,50 H15 M85,50 H95 M18,18 L25,25 M75,75 L82,82 M82,18 L75,25 M25,75 L18,82",
    defaultFill: "#FF9800",
  },
  {
    id: "flower",
    label: "Flower",
    category: "Abstract",
    path: "M50,20 A15,15 0 1,1 49.99,20 Z M50,80 A15,15 0 1,1 49.99,80 Z M20,50 A15,15 0 1,1 19.99,50 Z M80,50 A15,15 0 1,1 79.99,50 Z M27,27 A15,15 0 1,1 26.99,27 Z M73,27 A15,15 0 1,1 72.99,27 Z M27,73 A15,15 0 1,1 26.99,73 Z M73,73 A15,15 0 1,1 72.99,73 Z M50,50 A12,12 0 1,1 49.99,50 Z",
    defaultFill: "#FF5722",
  },

  // ── Elements ───────────────────────────────────────────────────────────────
  {
    id: "checkmark",
    label: "Checkmark",
    category: "Elements",
    path: "M10,50 L38,78 L90,22",
    defaultStroke: true,
    defaultFill: "transparent",
  },
  {
    id: "x-mark",
    label: "X Mark",
    category: "Elements",
    path: "M15,15 L85,85 M85,15 L15,85",
    defaultStroke: true,
    defaultFill: "transparent",
  },
  {
    id: "plus",
    label: "Plus",
    category: "Elements",
    path: "M50,10 V90 M10,50 H90",
    defaultStroke: true,
    defaultFill: "transparent",
  },
  {
    id: "minus-sign",
    label: "Minus",
    category: "Elements",
    path: "M10,50 H90",
    defaultStroke: true,
    defaultFill: "transparent",
  },
  {
    id: "quote-open",
    label: "Quote",
    category: "Elements",
    path: "M15,20 Q5,35 10,50 A12,12 0 1,0 10,26 Z M45,20 Q35,35 40,50 A12,12 0 1,0 40,26 Z",
    defaultFill: "#607D8B",
  },
  {
    id: "infinity",
    label: "Infinity",
    category: "Elements",
    path: "M30,50 A20,20 0 1,1 50,50 A20,20 0 1,0 70,50 A20,20 0 1,1 50,50 A20,20 0 1,0 30,50 Z",
    defaultFill: "transparent",
    defaultStroke: true,
  },
];

export const SHAPE_CATEGORIES = [
  "Basic",
  "Stars & Badges",
  "Arrows",
  "Speech",
  "Abstract",
  "Elements",
  "Lines",
] as const;

export const SHAPES_BY_CATEGORY = SHAPE_LIBRARY.reduce<Record<string, ShapeEntry[]>>(
  (acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  },
  {}
);
