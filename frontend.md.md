# Enterprise MarTech Frontend - Complete Developer Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture Deep Dive](#architecture-deep-dive)
3. [Core User Workflows](#core-user-workflows)
4. [State Management & Async Patterns](#state-management--async-patterns)
5. [Canvas Editor Implementation](#canvas-editor-implementation)
6. [Image Generation & Adaptation System](#image-generation--adaptation-system)
7. [Authentication & Security](#authentication--security)
8. [API Integration Patterns](#api-integration-patterns)
9. [Performance Optimizations](#performance-optimizations)
10. [Environment Configuration](#environment-configuration)
11. [Testing & Development](#testing--development)
12. [Troubleshooting Guide](#troubleshooting-guide)

---

## Project Overview

The Enterprise MarTech Frontend is a sophisticated **Next.js 16** application that orchestrates AI-powered marketing campaign creation. Unlike typical CRUD applications, this system manages complex asynchronous workflows involving AI agents, real-time polling, canvas manipulation, and multi-platform content adaptation.

### Core Capabilities
- **AI-Driven Content Pipeline**: Coordinates with Python FastAPI agents for image, video, blog, and email generation
- **Platform-Aware Generation**: Automatically adapts content for Instagram (1:1, 9:16), LinkedIn (1.91:1), Twitter (16:9), etc.
- **Advanced Canvas Editor**: Full-featured image editor using Fabric.js with layers, text styling, and export capabilities
- **Master Image Strategy**: Cost-efficient approach using 1-2 "master" images that get mathematically cropped for different aspect ratios
- **Real-time Polling System**: Sophisticated polling mechanisms to track AI generation progress across multiple variants
- **Video Overlay System**: FFmpeg.wasm integration for client-side video processing and overlay composition

---

## Architecture Deep Dive

### Technology Stack & Design Decisions

The frontend is built on **Next.js 16 App Router** with **React 19**, chosen specifically for its Server Components architecture that enables efficient server-side data fetching while maintaining rich client-side interactivity. The application follows a hybrid rendering pattern where data-heavy operations happen on the server, while complex UI interactions (canvas editing, real-time polling) happen on the client.

**Key Technology Choices:**
- **Fabric.js 7.3.1**: Selected over Konva for the canvas editor due to superior text handling, layer management, and export capabilities
- **FFmpeg.wasm**: Enables client-side video processing without server round-trips, crucial for real-time overlay composition
- **Better Auth 1.6.0**: Provides enterprise-grade authentication with JWT tokens and OAuth integration
- **Tailwind CSS 4.x**: Utility-first approach enables rapid UI development while maintaining design consistency

### System Architecture Patterns

The application implements several sophisticated patterns:

1. **Proxy Authentication Pattern**: All auth requests go through `/api/auth/*` on the frontend, which proxies to the backend. This ensures first-party cookies and avoids CORS issues that plague multi-domain setups.

2. **Master Image Strategy**: Instead of generating unique AI images for every platform ratio (which would be expensive), the system generates 1-2 "master" images (landscape + portrait) and mathematically crops them to exact ratios.

3. **Polling with useRef Pattern**: Asynchronous operations use `useRef` to avoid React stale closure bugs in polling loops, while `useState` triggers UI re-renders.

4. **Layer-Based Canvas Architecture**: The editor treats everything as layers (background, graphics, text, logos) with metadata tracking for undo/redo and export functionality.

---

## Core User Workflows

## Brand Onboarding System (`app/brands/page.tsx`)

The brand onboarding system is a sophisticated multi-stage workflow that captures comprehensive brand information and generates AI-powered brand briefs. This 887-line component implements a complex state machine with file uploads, form validation, and asynchronous AI processing.

### Phase 1: Multi-Stage Form Architecture

The brand onboarding follows a structured progression through distinct stages:

1. **Form Stage (`stage: "form"`)**: Comprehensive data collection
2. **Analyzing Stage (`stage: "analyzing"`)**: AI processing with loading overlay
3. **Brief Stage (`stage: "brief"`)**: Review and edit AI-generated brand strategy

```typescript
const [stage, setStage] = useState<"form" | "analyzing" | "brief">("form");
const [brandId, setBrandId] = useState<string>("");
const [brandBrief, setBrandBrief] = useState<any>(null);
const [briefText, setBriefText] = useState("");
```

The stage management ensures users can't accidentally navigate away during critical operations and provides clear visual feedback about the current process state.

### Phase 2: Comprehensive Brand Data Collection

The form captures four distinct categories of brand information:

#### Company Details Section
- **Basic Information**: Company name, industry, admin email, website
- **Contact Information**: Phone number with country code validation
- **Brand Context**: Company description and founding story for AI context

```typescript
const [formData, setFormData] = useState({
  // Brand basics
  name: "",
  adminEmail: "",
  website: "",
  phone: "",
  phoneCountryCode: "+91",
  industry: "",
  companyInfo: "",
  companyOrigin: "",
  
  // Brand identity
  toneOfVoice: "Professional",
  guidelines: "",
  styleGuide: "",
  colors: ["#4CAF31", "#333333", "#F0F9F6"],
  fonts: [] as { name: string; weight: number }[],
  
  // Audience segments
  audiences: [] as {
    name: string;
    demographics: { ageRange: string; gender: string[]; location: string[] };
    interests: string[];
    personas: object[];
  }[],
  
  // Legal compliance
  termsAccepted: false,
  marketingConsent: false,
});
```

#### Phone Number Validation System
The system implements sophisticated phone validation based on country codes:

```typescript
// India-specific validation
{formData.phone && formData.phoneCountryCode === "+91" && !/^[6-9][0-9]{9}$/.test(formData.phone) && (
  <p className="text-xs text-red-500 mt-1">Must be a valid 10-digit Indian number starting with 6–9</p>
)}

// Generic international validation
{formData.phone && formData.phoneCountryCode !== "+91" && formData.phone.length < 7 && (
  <p className="text-xs text-red-500 mt-1">Phone number seems too short</p>
)}
```

This ensures data quality while accommodating international users with different phone number formats.

#### Brand Identity Configuration
- **Style Guide**: Free-form text area for brand guidelines and tone documentation
- **Color Palette**: Three-color system (Primary, Secondary, Accent) with both color picker and hex input
- **Typography**: Font name collection with optional font file uploads

```typescript
// Color management with dual input methods
<input
  type="color"
  className="h-8 w-8 rounded cursor-pointer shrink-0 border-0 p-0"
  value={formData.colors[color.index]}
  onChange={e => {
    const newColors = [...formData.colors];
    newColors[color.index] = e.target.value.toUpperCase();
    setFormData({ ...formData, colors: newColors });
  }}
/>
<input
  type="text"
  className="w-full bg-transparent text-sm font-mono uppercase text-zinc-900 outline-none"
  value={formData.colors[color.index]}
  onChange={e => {
    const newColors = [...formData.colors];
    newColors[color.index] = e.target.value.toUpperCase();
    setFormData({ ...formData, colors: newColors });
  }}
/>
```

#### Asset Upload System
The component handles multiple file types with proper validation:

```typescript
const handleFileUpload = (type: keyof typeof files, e: React.ChangeEvent<HTMLInputElement>) => {
  if (e.target.files && e.target.files.length > 0) {
    if (type === "logo") {
      const file = e.target.files[0];
      const allowed = ["image/jpeg", "image/png", "image/svg+xml", "image/webp", "image/gif"];
      if (!allowed.includes(file.type)) {
        setLogoError("Only image files are allowed (JPG, PNG, SVG, WEBP).");
        e.target.value = "";
        return;
      }
      setLogoError("");
      setFiles({ ...files, logo: file });
    } else {
      // Handle font files
      setFiles({ ...files, [type]: [...(files[type] as File[]), ...Array.from(e.target.files)] });
    }
  }
};
```

### Phase 3: Multi-Endpoint Submission Strategy

The form submission orchestrates multiple API calls in sequence to create a complete brand profile:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setStage("analyzing");

  try {
    let currentBrandId = brandId || editBrandId;

    // Step 1: Create or update brand profile
    if (currentBrandId) {
      // UPDATE existing brand
      const brandRes = await fetch(`/api/brands/${currentBrandId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          adminEmail: formData.adminEmail,
          // ... other brand fields
        }),
      });
    } else {
      // CREATE new brand
      const brandRes = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ /* brand data */ }),
      });
      const brand = await brandRes.json();
      currentBrandId = brand.id;
      setBrandId(currentBrandId!);
    }

    // Step 2: Create audience segments
    if (formData.audiences.length > 0) {
      await fetch(`/api/brands/${currentBrandId}/audiences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audiences: formData.audiences }),
      });
    }

    // Step 3: Upload brand kit (files + metadata)
    const hasNewFiles = !!files.logo || files.fonts.length > 0;
    if (hasNewFiles) {
      const kit = new FormData();
      kit.append("data", JSON.stringify({
        colors: formData.colors,
        fonts: formData.fonts,
        guidelines: formData.guidelines,
      }));
      if (files.logo) kit.append("logo", files.logo);
      files.fonts.forEach(f => kit.append("fonts", f));

      await fetch(`/api/brands/${currentBrandId}/kit`, {
        method: "POST",
        body: kit,
      });
    }

    // Step 4: Invoke AI brand analysis
    const token = await getAgentToken();
    await fetch(`/api/agents/brand/invoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ brand_id: currentBrandId }),
    });

    // Step 5: Poll for AI-generated brand brief
    pollForBrandBrief(currentBrandId);
  } catch (error) {
    setStage("form"); // Revert on error
  }
};
```

### Phase 4: AI Brand Analysis with Polling

After successful submission, the system polls for the AI-generated brand brief:

```typescript
const pollBrief = async () => {
  try {
    const kitRes = await fetch(`/api/brands/${currentBrandId}/kit`);
    if (kitRes.ok) {
      const data = await kitRes.json();
      const brief = data.brandKit?.brandBrief;
      if (brief) {
        setBrandBrief(brief);
        const strategy = typeof brief === "object" 
          ? (brief.strategy ?? JSON.stringify(brief, null, 2)) 
          : String(brief);
        setBriefText(strategy);
        setStage("brief");
        return;
      }
    }
  } catch { }
  
  attempts++;
  if (attempts < maxAttempts) {
    setTimeout(pollBrief, 3000);
  } else {
    setBriefTimedOut(true);
    setStage("brief");
  }
};
```

The polling implements exponential backoff and timeout handling to gracefully handle AI processing delays or failures.

### Phase 5: Brand Brief Review and Editing

The final stage allows users to review and edit the AI-generated brand strategy:

```typescript
// Inline editing system
{isEditingBrief ? (
  <textarea
    value={briefText}
    onChange={e => setBriefText(e.target.value)}
    className="w-full min-h-[300px] border border-zinc-200 rounded-lg p-4 text-sm focus:ring-2 focus:ring-[#4CAF31]/20 focus:border-[#4CAF31] outline-none resize-y leading-relaxed text-zinc-700 bg-zinc-50"
  />
) : (
  <div className="prose prose-sm max-w-none text-zinc-700 leading-relaxed whitespace-pre-wrap rounded-lg p-4 bg-zinc-50/50 border border-zinc-100 min-h-[200px]">
    {briefText || <span className="italic text-zinc-400">AI is still generating your brief...</span>}
  </div>
)}
```

The editing system preserves formatting and provides immediate visual feedback. Changes are saved via a dedicated API endpoint that updates only the brand brief without affecting other brand data.

### Edit Mode and Pre-population

The component supports editing existing brands through URL parameters:

```typescript
const editBrandId = searchParams.get("edit");

useEffect(() => {
  if (!editBrandId || !session.data || isCheckingBrands) return;
  
  // Fetch brand details, kit, and logo URL in parallel
  Promise.all([
    fetch("/api/brands").then(r => r.ok ? r.json() : null),
    fetch(`/api/brands/${editBrandId}/kit`).then(r => r.ok ? r.json() : null),
    fetch(`/api/brands/${editBrandId}/logo-url`).then(r => r.ok ? r.json() : null),
  ]).then(([brandsData, kitData, logoData]) => {
    // Pre-populate form with existing data
    setFormData(prev => ({
      ...prev,
      name: brand?.name || prev.name,
      // ... other fields
    }));
    
    // Handle existing logo display
    if (logoData?.url) {
      const proxied = `/api/image-proxy?url=${encodeURIComponent(logoData.url)}`;
      setExistingLogoUrl(proxied);
    }
  });
}, [editBrandId, session.data, isCheckingBrands]);
```

This enables seamless brand profile updates while preserving existing assets and configurations.

---

### Phase 1: Campaign Creation (`app/campaigns/[id]/page.tsx`)

The campaign detail page serves as the central orchestration hub. When a user creates a campaign, the system:

1. **Campaign Brief Generation**: The page automatically invokes the Campaign Agent (Python FastAPI) which analyzes the campaign objectives and generates a strategic brief. This happens asynchronously - the page shows a loading state while polling for completion.

2. **Placeholder Creative Creation**: The system pre-creates placeholder creative records in the database for IMAGE, VIDEO, and EMAIL types. This ensures the UI has something to display while agents work in the background.

3. **Reference Image Upload**: Users can upload a reference image that guides the visual style of all generated content. The image is stored in Google Cloud Storage and proxied through `/api/image-proxy` to avoid CORS issues.

**Critical Implementation Detail**: The page uses a polling mechanism with `setInterval` to check if the campaign brief has been populated by the agent. This polling continues until either the brief appears or a timeout is reached.

```typescript
// Polling pattern used throughout the application
useEffect(() => {
  if (!campaignId || loading) return;
  const hasPendingBriefs = creatives.some(c => !c.creativeBrief);
  if (!hasPendingBriefs) return;

  const timer = setInterval(() => {
    void refreshCreativeBriefs(campaignId, setCreatives, setEditableBriefs, () => {
      clearInterval(timer); // Stop polling when complete
    });
  }, 3000);

  return () => clearInterval(timer);
}, [creatives, campaignId, loading]);
```

### Phase 2: Creative Brief Refinement

Once the Campaign Agent completes, individual creative briefs are generated for each content type. Users can edit these briefs directly in the UI:

1. **Editable Brief System**: Each creative has an editable text area where users can refine the AI-generated brief
2. **Auto-save Mechanism**: Changes are automatically saved to the database when users navigate away or trigger regeneration
3. **Brief-Driven Regeneration**: When users click "regenerate," the updated brief is sent to the appropriate agent

### Phase 3: Image Creative Generation (`app/creatives/image/page.tsx`)

This page implements a sophisticated form-based prompt builder:

1. **Guided Prompt Interface**: Instead of free-form text, users fill structured fields (Background, Graphic, Actors, Text) that get serialized into JSON and stored as `guidedBackgroundPrompt`, `guidedGraphicPrompt`, etc.

2. **Variant Selection**: Users choose how many variants to generate (1-4). This number is crucial for the polling system in Phase 4.

3. **Agent Invocation**: When "Generate" is clicked:
   - A new creative record is created in the database with `status: "PENDING"`
   - The Image Agent is invoked with the campaign ID and creative ID
   - The user is immediately redirected to the preview page with `batch=true` parameter

**Key Implementation Pattern**: The page always creates a NEW creative record, never reusing existing ones. This ensures the preview page shows a proper loading state and preserves generation history.

### Phase 4: Creative Preview & Generation (`app/preview/image/page.tsx`)

This is the most complex component in the application. It handles asynchronous image generation, aspect-ratio adaptations, and UI synchronization.

1. **Initial Load**: 
   - The page mounts and calls `fetchCampaignCreatives()`
   - It expects a certain number of images based on the platforms selected in Phase 3 (tracked via `expectedVariants`)

2. **The "Master Seed" Concept**:
   - To save costs and ensure visual consistency, the backend does *not* generate a completely unique AI image for every single platform ratio
   - Instead, the backend generates 1 or 2 "Master" images (e.g., a wide 16:9 master and a tall 9:16 master)

3. **Polling for Images**:
   - A `useEffect` loop runs `setTimeout(poll, delay)`
   - It fetches creatives from the Node backend. If `creative.url` or `creative.signedUrl` is populated, the image is ready
   - **Critical Detail**: We use `useRef` (`creativesRef`, `expectedVariantsRef`) inside the polling loop to prevent React stale closure bugs. The UI state (`setCreatives`) is updated using a deduplication function `dedupeCreativesById`

```typescript
// The polling mechanism with useRef to avoid stale closures
const creativesRef = React.useRef<PreviewCreative[]>([]);
const expectedVariantsRef = React.useRef(1);

useEffect(() => {
  let cancelled = false;
  let count = 0;

  const poll = async () => {
    if (cancelled) return;
    await fetchCampaignCreatives();
    count++;
    
    // Use ref values, not state values, to avoid stale closures
    const allReady = areExpectedVariantsReady(creativesRef.current, expectedVariantsRef.current);
    
    if (count >= MAX_POLLS || allReady) {
      console.log(`Polling stopped. Count: ${count}, All ready: ${allReady}`);
      return;
    }
    
    setTimeout(poll, getPreviewPollDelay(count));
  };
  
  poll();
  return () => { cancelled = true; };
}, [fetchCampaignCreatives]);
```

4. **Tab Switching & Adaptation (`handleAdaptImage`)**:
   - When a user clicks a platform tab (e.g., "LinkedIn 1.91:1"), the app checks if an image for that exact ratio exists
   - If not, it triggers `handleAdaptImage()`
   - `handleAdaptImage()` finds the closest "Master" image (landscape master for wide targets, portrait master for tall targets)
   - It sends a `POST` to `/api/agents/adapt-image` with the master's URL and the target ratio
   - The Python backend mathematically center-crops the master image to the exact ratio without stretching it, uploads it to GCS, and returns the new URL
   - The frontend pushes this new adapted creative into the local state and displays it

5. **Regeneration (`handleRegenerate`)**:
   - Re-runs the adaptation process for a specific slot. It shows an overlay spinner *only* on the selected image so the user isn't locked out of the rest of the UI

### Phase 5: The Editing Canvas (`app/editor/image/page.tsx`)

When a user clicks the "Edit" (Pen) icon on a preview image, they are taken to the Editor.

1. **Canvas Initialization**: The core logic utilizes HTML5 Canvas and React wrappers (`react-konva` or native Canvas depending on the module)

2. **Image Loading**: The background image (the adapted creative) is loaded onto the HTML5 Canvas using cross-origin (CORS) rules

3. **Layer Management**: 
   - The frontend fetches the Brand Assets (logos from Phase 2) and AI-generated text (Headlines, Ad Copy from Phase 3)
   - These are rendered as distinct, draggable, and editable layers on top of the background

4. **Export (`handleDownload`)**:
   - The HTML5 Canvas API `.toBlob()` is used to flatten the layers
   - The blob is converted to an Object URL and triggered as a browser download

---


## Blog Preview System (`app/preview/blog/page.tsx`)

The blog preview system handles AI-generated blog content with markdown rendering, real-time generation, and comprehensive export capabilities. This component demonstrates sophisticated async state management and content processing patterns.

### Phase 1: Dual Content Loading Strategy

The blog preview implements a smart loading strategy that handles both existing and newly generated content:

```typescript
const [blog, setBlog] = useState<BlogData | null>(null);
const [generating, setGenerating] = useState(false);
const [error, setError] = useState<string | null>(null);
const hasInitializedRef = useRef(false);

interface BlogData {
  title: string;
  content_markdown: string;
  summary: string;
  tags: string[];
  notes?: string;
}
```

The component first attempts to load existing blog data, then automatically triggers generation if no content is found:

```typescript
useEffect(() => {
  if (hasInitializedRef.current) return;
  
  const init = async () => {
    hasInitializedRef.current = true;
    
    // Try to load existing blog data first
    try {
      const res = await fetch(`/api/creatives/${creativeId}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        const creative = json.creative ?? json;
        
        // Check if blog already generated
        if (creative.status === "GENERATED" && creative.url) {
          await fetchBlogCreative();
          return;
        }
        
        // Check for embedded blog data
        if (creative.blogData?.content_markdown) {
          setBlog(creative.blogData);
          return;
        }
      }
    } catch { /* ignore */ }

    // Auto-generate on first load if not already generated
    generateBlog();
  };

  init();
}, [creativeId]);
```

This pattern ensures users see content immediately if it exists, while seamlessly generating new content when needed.

### Phase 2: Markdown Content Processing

The system handles blog content stored in multiple formats and locations:

#### GCS Markdown File Fetching
When the AI agent saves markdown to Google Cloud Storage, the frontend fetches it via proxy:

```typescript
const fetchBlogCreative = useCallback(async () => {
  if (!creativeId) return;
  
  try {
    const res = await fetch(`/api/creatives/${creativeId}`, { cache: "no-store" });
    const creative = (await res.json()).creative ?? await res.json();

    // Handle GCS-stored markdown files
    if (creative.url && creative.status === "GENERATED") {
      // Convert gs:// URLs to HTTPS and proxy through backend
      const publicUrl = creative.url.startsWith("gs://")
        ? creative.url.replace("gs://", "https://storage.googleapis.com/")
        : creative.url;

      const proxied = `/api/image-proxy?url=${encodeURIComponent(publicUrl)}`;
      const dataRes = await fetch(proxied, { cache: "no-store" });
      
      if (dataRes.ok) {
        const markdown = await dataRes.text();
        setBlog({
          title: creative.headlines?.[0] ?? "Blog Post",
          content_markdown: markdown,
          summary: creative.adCopy ?? "",
          tags: creative.tags ?? [],
          notes: creative.notes,
        });
      }
    }
  } catch (err) {
    console.error("[blog-preview] fetchBlogCreative error:", err);
  }
}, [creativeId]);
```

#### Embedded Data Structures
The system also handles blog data embedded directly in the creative record:

```typescript
// Check multiple possible data locations
if (creative.blogData) {
  setBlog(creative.blogData);
  return;
}

if (creative.metadata?.blog) {
  setBlog(creative.metadata.blog);
  return;
}
```

This flexibility accommodates different storage strategies used by various AI agents.

### Phase 3: AI Blog Generation with Token Tracking

The blog generation process communicates with the Python agent service and tracks token usage:

```typescript
const generateBlog = useCallback(async () => {
  if (!campaignId || !creativeId) return;
  setGenerating(true);
  setError(null);
  setBlog(null);

  try {
    const token = await getAgentToken();
    const res = await fetch("/api/agents/blog", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        campaign_id: campaignId,
        creative_id: creativeId,
      }),
    });

    const result = await res.json();
    const data = result.data ?? result;

    // Capture token usage metrics
    if (result.usage) {
      setAgentUsage({
        totalTokens: result.usage.totalTokens ?? 0,
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
        executionTimeMs: result.usage.executionTimeMs ?? 0,
      });
    }

    // Process generated content
    if (data.content_markdown) {
      setBlog({
        title: data.title ?? "Blog Post",
        content_markdown: data.content_markdown,
        summary: data.summary ?? "",
        tags: data.tags ?? [],
        notes: data.notes,
      });
    } else {
      throw new Error("No blog content returned from agent.");
    }
  } catch (err: any) {
    setError(err.message ?? "Failed to generate blog post.");
  } finally {
    setGenerating(false);
  }
}, [campaignId, creativeId]);
```

The token usage tracking provides valuable insights into AI operation costs and performance.

### Phase 4: Advanced Markdown Rendering

The component uses ReactMarkdown with custom components for enhanced rendering:

```typescript
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Custom image component with proxy support
function MarkdownImage({ src, alt }: any) {
  if (!src || typeof src !== "string") return null;

  let proxiedSrc = src;
  if (src.startsWith("gs://")) {
    const httpsUrl = src.replace("gs://", "https://storage.googleapis.com/");
    proxiedSrc = `/api/image-proxy?url=${encodeURIComponent(httpsUrl)}`;
  } else if (src.startsWith("https://storage.googleapis.com/") || src.startsWith("https://storage.cloud.google.com/")) {
    proxiedSrc = `/api/image-proxy?url=${encodeURIComponent(src)}`;
  }

  return (
    <img
      src={proxiedSrc}
      alt={alt ?? ""}
      className="rounded-xl shadow-md my-4 max-w-full"
      onError={(e) => {
        console.error(`[blog-preview] Failed to load image: ${src}`);
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

// Custom link component for external links
function MarkdownLink({ href, children }: any) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

const MARKDOWN_COMPONENTS = {
  a: MarkdownLink,
  img: MarkdownImage,
};
```

The custom components ensure all images are properly proxied and links open safely in new tabs.

### Phase 5: Content Export and Interaction

The system provides multiple ways to interact with generated content:

#### Markdown Copy Functionality
```typescript
const handleCopy = async () => {
  if (!blog) return;
  await navigator.clipboard.writeText(blog.content_markdown);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};
```

#### File Download with Dynamic Naming
```typescript
const handleDownload = () => {
  if (!blog) return;
  const blob = new Blob([blog.content_markdown], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `blog-${(blog.title ?? "post").toLowerCase().replaceAll(/\s+/g, "-").slice(0, 40)}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
};
```

The download filename is automatically generated from the blog title, ensuring organized file management.

#### Regeneration with State Preservation
```typescript
<button
  onClick={() => { setAgentUsage(null); generateBlog(); }}
  disabled={generating}
  className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-zinc-600 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-all shadow-sm disabled:opacity-50"
>
  <RefreshCw size={14} />
  Regenerate
</button>
```

Regeneration clears previous usage metrics and generates fresh content while maintaining the current UI state.

### Phase 6: Responsive Layout with Sticky Controls

The blog preview implements a sophisticated layout with sticky navigation and controls:

```typescript
return (
  <div className="flex min-h-screen bg-zinc-50 font-sans text-zinc-900">
    {/* Sidebar with sticky positioning */}
    <aside className="w-64 border-r border-zinc-200 bg-white flex flex-col shrink-0 h-screen sticky top-0">
      {/* Navigation content */}
    </aside>

    <main className="flex-1 flex flex-col min-w-0">
      {/* Sticky header */}
      <header className="h-16 border-b border-zinc-200 flex items-center justify-between px-8 bg-white sticky top-0 z-20">
        {/* Breadcrumb navigation */}
      </header>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto p-8 pb-32">
        {/* Blog content */}
      </div>

      {/* Sticky bottom controls */}
      <footer className="h-24 border-t border-zinc-200 bg-white/80 backdrop-blur-md sticky bottom-0 z-20 flex items-center justify-between px-12">
        {/* Action buttons */}
      </footer>
    </main>
  </div>
);
```

The layout ensures navigation and controls remain accessible while allowing the main content to scroll freely.

---

## Email Editor System (`components/email/EmailEditorPanel.tsx`)

The email editor integrates GrapesJS for professional email template editing with comprehensive save functionality and error handling. This component demonstrates advanced third-party library integration patterns.

### Phase 1: GrapesJS Integration Architecture

The email editor is built on **GrapesJS** with the newsletter plugin for email-specific functionality:

```typescript
import grapesjs, { Editor } from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import newsletterPlugin from "grapesjs-preset-newsletter";

interface EmailEditorPanelProps {
  readonly htmlContent: string;
  readonly onSave: (html: string) => Promise<void>;
  readonly onClose: () => void;
}
```

The component accepts initial HTML content and provides callbacks for save and close operations, enabling flexible integration into larger workflows.

### Phase 2: Editor Initialization and Lifecycle Management

The GrapesJS editor is initialized with specific configuration for email editing:

```typescript
useEffect(() => {
  if (!containerRef.current) return;

  const editor = grapesjs.init({
    container: containerRef.current,
    storageManager: false, // Disable local storage to prevent conflicts
    fromElement: false,    // Load content programmatically
    plugins: [newsletterPlugin], // Email-specific components and blocks
    height: "100%",
    width: "auto",
  });

  // Load initial content
  editor.setComponents(htmlContent);
  editorRef.current = editor;

  // Cleanup on unmount
  return () => {
    editor.destroy();
    editorRef.current = null;
  };
}, [htmlContent]);
```

**Critical Implementation Details:**
- `storageManager: false` prevents conflicts with application state management
- `fromElement: false` allows programmatic content loading
- The newsletter plugin provides email-specific blocks (headers, footers, social media, etc.)
- Proper cleanup prevents memory leaks in single-page applications

### Phase 3: Content Extraction and HTML Generation

The save functionality extracts both HTML structure and CSS styles to create complete email documents:

```typescript
const handleSave = async () => {
  if (!editorRef.current) return;

  // Extract HTML structure and CSS styles separately
  const html = editorRef.current.getHtml();
  const css = editorRef.current.getCss();
  
  // Combine into complete HTML document
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
${css}
  </style>
</head>
<body>
${html}
</body>
</html>`;

  setIsSaving(true);
  setSaveError(null);

  try {
    await onSave(fullHtml);
  } catch (err) {
    setSaveError(err instanceof Error ? err.message : "Failed to save. Please try again.");
  } finally {
    setIsSaving(false);
  }
};
```

**Why This Approach:**
- **Complete Documents**: Email clients require complete HTML documents with embedded styles
- **Inline CSS**: Many email clients don't support external stylesheets
- **Viewport Meta**: Ensures proper mobile rendering
- **Error Boundaries**: Graceful handling of save failures with user feedback

### Phase 4: FormData Conversion Utility

The component includes a utility function for converting HTML to FormData for file upload scenarios:

```typescript
export function buildSaveFormData(html: string): FormData {
  const blob = new Blob([html], { type: "text/html" });
  const formData = new FormData();
  formData.append("image", blob, "email-edited.html");
  return formData;
}
```

This utility enables integration with file upload APIs that expect FormData, treating the HTML email as a file attachment.

### Phase 5: Error Handling and User Feedback

The component implements comprehensive error handling with visual feedback:

```typescript
const [isSaving, setIsSaving] = useState(false);
const [saveError, setSaveError] = useState<string | null>(null);

// Error display in UI
{saveError && (
  <div className="bg-red-50 border-t border-red-200 px-4 py-3 text-red-800">
    {saveError}
  </div>
)}

// Save button with loading state
<button
  onClick={handleSave}
  disabled={isSaving}
  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
>
  {isSaving ? "Saving..." : "Save"}
</button>
```

The error handling provides immediate feedback while preventing user confusion during save operations.

### Phase 6: Integration Patterns and Usage

The email editor is designed for flexible integration into larger workflows:

#### Modal Integration Pattern
```typescript
// Parent component usage
const [showEmailEditor, setShowEmailEditor] = useState(false);
const [emailContent, setEmailContent] = useState("<p>Initial content</p>");

const handleEmailSave = async (html: string) => {
  // Save to backend
  const response = await fetch('/api/emails/save', {
    method: 'POST',
    headers: { 'Content-Type': 'text/html' },
    body: html,
  });
  
  if (response.ok) {
    setEmailContent(html);
    setShowEmailEditor(false);
  } else {
    throw new Error('Failed to save email');
  }
};

return (
  <>
    {showEmailEditor && (
      <div className="fixed inset-0 z-50 bg-white">
        <EmailEditorPanel
          htmlContent={emailContent}
          onSave={handleEmailSave}
          onClose={() => setShowEmailEditor(false)}
        />
      </div>
    )}
  </>
);
```

#### File Upload Integration
```typescript
const handleEmailSaveAsFile = async (html: string) => {
  const formData = buildSaveFormData(html);
  
  const response = await fetch('/api/upload/email', {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error('Upload failed');
  }
};
```

### Phase 7: GrapesJS Newsletter Plugin Features

The newsletter plugin provides email-specific functionality:

- **Responsive Email Blocks**: Pre-built components optimized for email clients
- **Email-Safe CSS**: Automatic generation of email-compatible styles
- **Template Library**: Common email layouts (newsletters, promotions, transactional)
- **Social Media Integration**: Ready-to-use social media blocks
- **Email Testing**: Preview across different email clients

The plugin ensures generated emails work consistently across major email providers (Gmail, Outlook, Apple Mail, etc.) by using email-safe HTML and CSS patterns.

This email editor system provides a professional-grade email creation experience while maintaining integration flexibility and robust error handling throughout the editing and saving process.

## State Management & Async Patterns

### Why we use `useRef` alongside `useState`

In heavily asynchronous components (like `preview/image/page.tsx`), you will see patterns like this:

```typescript
const [creatives, setCreatives] = useState([]);
const creativesRef = useRef([]);
```

**Why?** The polling function `poll()` is defined inside a `useEffect` that only runs once on mount. If `poll()` tries to read `creatives.length`, it will *always* read `0` because it captured the state at mount time. By reading `creativesRef.current`, the polling loop always has access to the most up-to-date data, while `setCreatives` is still used to trigger UI re-renders.

### Deduplication Patterns

The application frequently deals with duplicate data from API calls. The `dedupeCreativesById` function ensures the UI doesn't show duplicate entries:

```typescript
function dedupeCreativesById(creatives: PreviewCreative[]): PreviewCreative[] {
  const seen = new Set<string>();
  return creatives.filter((creative) => {
    if (seen.has(creative.id)) return false;
    seen.add(creative.id);
    return true;
  });
}
```

### Polling Strategy with Exponential Backoff

The preview page implements sophisticated polling with increasing delays:

```typescript
function getPreviewPollDelay(count: number): number {
  return count < 10 ? 2000 : Math.min(BASE_INTERVAL * (count - 10 + 1), MAX_INTERVAL);
}
```

This starts with 2-second intervals for the first 10 polls, then gradually increases to avoid overwhelming the server while still providing responsive updates.

### Session-Based Creative Filtering

The application groups creatives by "sessions" - batches of content generated together. This is implemented through time-window filtering:

```typescript
function getBatchSessionImages(allImages: PreviewCreative[], refCreative: PreviewCreative): PreviewCreative[] {
  const refTime = new Date(refCreative.updatedAt || refCreative.createdAt).getTime();
  const timeWindow = 300000; // 5 minutes
  
  return allImages.filter((creative) => {
    const creativeTime = new Date(creative.updatedAt || creative.createdAt).getTime();
    const timeDiff = Math.abs(creativeTime - refTime);
    return timeDiff <= timeWindow && !creative.isEdited;
  });
}
```

This ensures that when a user generates multiple variants, they're all shown together even if other creatives exist in the campaign.

---

## Canvas Editor Implementation

### Fabric.js Architecture (`components/editor/EditorCanvas.tsx`)

The canvas editor is built on **Fabric.js 7.3.1** and implements a sophisticated layer-based editing system. The component is over 2,100 lines and handles everything from basic shape creation to advanced text effects.

#### Layer System Design

Every object on the canvas has metadata attached:

```typescript
function setLayerMetadata(obj: fabric.FabricObject, layer: Pick<LayerDef, "id" | "label" | "type">) {
  (obj as any).__layerId = layer.id;
  (obj as any).__layerLabel = layer.label;
  (obj as any).__layerType = layer.type;
}
```

This metadata enables:
- **Layer Panel Management**: Show/hide, lock/unlock, reorder layers
- **Undo/Redo System**: Serialize canvas state with layer information intact
- **Export Control**: Exclude certain layers (like guidelines) from final export

#### Text Styling with Selection Support

The editor supports both object-level and selection-level text styling:

```typescript
function getTextStyleFromObject(obj: fabric.IText): TextStyle {
  const base = buildBaseTextStyle(obj);
  if (!obj.isEditing) return base;

  // When editing text, check for selection-specific styles
  const selectionStyle = obj.getSelectionStyles()?.[0] as any;
  if (!selectionStyle) return base;

  applySelectionTextOverrides(base, selectionStyle);
  return base;
}
```

This allows users to style individual words or characters within a text object, similar to professional design tools.

#### Highlight System for Text

The editor implements a sophisticated text highlighting system:

```typescript
const syncHighlightRect = (canvas: fabric.Canvas, textObj: fabric.FabricObject) => {
  const id = (textObj as any).__layerId;
  if (!id) return;

  const existing = canvas.getObjects().find(
    (o) => (o as any).__highlightFor === id
  ) as fabric.Rect | undefined;

  const enabled = !!(textObj as any).__highlightEnabled;

  if (!enabled) {
    if (existing) { canvas.remove(existing); canvas.renderAll(); }
    return;
  }

  // Create or update highlight rectangle behind text
  const color = (textObj as any).__highlightColor || "#ffff00";
  const opacity = (textObj as any).__highlightOpacity ?? 0.5;
  const padding = (textObj as any).__highlightPadding ?? 8;
  
  // Calculate rectangle position based on text bounds...
};
```

The highlight rect is automatically positioned and sized based on the text object's dimensions and follows it during moves/resizes.

#### Curved Text Implementation

The editor supports curved text effects through canvas rendering:

```typescript
function renderCurvedTextToDataURL(
  text: string,
  effect: CurvedTextEffect,
  opts: Required<CurvedTextOptions>
): string {
  // Create offscreen canvas
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  
  // Render each character individually along the curve
  switch (effect) {
    case "arc-up":
    case "arc-down":
      renderArc(ctx, text, cx, cy, totalW, radius, effect === "arc-up");
      break;
    case "circle":
      renderCircle(ctx, text, cx, cy, totalW, radius);
      break;
    // ... other effects
  }
  
  return canvas.toDataURL("image/png");
}
```

Each character is positioned and rotated individually to follow the curve path, then the result is converted to an image and placed on the main canvas.

#### Zoom and Pan System

The canvas implements smooth zoom with wheel events:

```typescript
const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  const nW = naturalSizeRef.current.w;
  const nH = naturalSizeRef.current.h;
  
  // Different sensitivity for pinch vs scroll
  const sensitivity = e.ctrlKey ? 0.01 : 0.003;
  const delta = -e.deltaY * sensitivity;
  const newZoom = Math.min(4, Math.max(0.1, canvas.getZoom() + delta));
  
  canvas.setZoom(newZoom);
  canvas.setDimensions({ width: nW * newZoom, height: nH * newZoom });
  canvas.renderAll();
};
```

The zoom system maintains the natural canvas size while scaling the viewport, ensuring export quality remains consistent.

#### History System with Debouncing

Canvas changes are tracked for undo/redo:

```typescript
const markDirty = () => {
  if (isUndoingRef.current) return;
  onDirtyRef.current();
  emitLayers(canvas);

  // Debounce history serialization to avoid layout race conditions
  if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
  historyTimerRef.current = setTimeout(() => {
    if (isUndoingRef.current || !fabricRef.current) return;
    try {
      const json = fabricRef.current.toJSON();
      historyRef.current.push(JSON.stringify(json));
      if (historyRef.current.length > 30) historyRef.current.shift();
    } catch (err) {
      console.warn("Failed to serialize canvas for history:", err);
    }
  }, 200);
};
```

The debouncing prevents performance issues during rapid changes while ensuring all significant modifications are captured.

---

## Image Generation & Adaptation System

### The Master Image Strategy

The core innovation of this system is the "Master Image" approach, which dramatically reduces AI generation costs while maintaining visual consistency:

1. **Initial Generation**: When a user requests image variants, the system generates only 1-2 "master" images:
   - **Landscape Master**: Generated at 16:9 or similar wide ratio
   - **Portrait Master**: Generated at 9:16 or similar tall ratio

2. **Mathematical Adaptation**: For each target platform, the system:
   - Identifies the closest master (landscape for wide targets, portrait for tall/square)
   - Performs center-crop mathematics to extract the exact target ratio
   - Uploads the cropped result to Google Cloud Storage

### Adaptation Algorithm (`handleAdaptImage`)

```typescript
const handleAdaptImage = async (sourceCreative: PreviewCreative, targetTab: typeof platformTabs[0]) => {
  // 1. Create placeholder creative in database
  const createRes = await fetch(`/api/campaigns/${campaignId}/creatives`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "IMAGE",
      promptType: "GUIDED",
      platformName: targetTab.label,
      aspectRatio: targetTab.aspectRatio,
    }),
  });

  // 2. Determine best master image to use
  const [tw, th] = targetTab.aspectRatio.split(":").map(Number);
  const targetIsLandscape = tw >= th;

  const allImageCreatives = creatives.filter(c => c.url);
  const landscapeMaster = allImageCreatives.find(c => {
    const [cw, ch] = (c.aspectRatio || "1:1").split(":").map(Number);
    return cw / ch > 1.2; // Identify landscape masters
  });
  const portraitMaster = allImageCreatives.find(c => {
    const [cw, ch] = (c.aspectRatio || "1:1").split(":").map(Number);
    return ch / cw > 1.2; // Identify portrait masters
  });

  // 3. Select best source
  let bestSource = sourceCreative;
  if (targetIsLandscape && landscapeMaster) {
    bestSource = landscapeMaster;
  } else if (!targetIsLandscape && portraitMaster) {
    bestSource = portraitMaster;
  }

  // 4. Send to adaptation API
  const res = await fetch(`/api/agents/adapt-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({
      campaign_id: campaignId,
      source_image_url: bestSource.url,
      target_aspect_ratio: targetTab.aspectRatio,
      platform_name: targetTab.label,
      creative_id: newCreativeId,
    }),
  });
};
```

### Platform-Aware Generation (`lib/platforms.ts`)

The system maintains a canonical list of platform specifications:

```typescript
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
    id: 'linkedin-post',
    name: 'LinkedIn Post',
    aspectRatio: '1.91:1',
    orientation: 'landscape',
  },
  // ... more platforms
];
```

The orientation is automatically resolved from aspect ratios:

```typescript
export function resolveOrientation(aspectRatio: string): Orientation {
  const parts = aspectRatio.split(':');
  const w = parseFloat(parts[0]);
  const h = parseFloat(parts[1]);

  if (w > h) return 'landscape';
  if (h > w) return 'portrait';
  return 'square';
}
```

### Image Proxy System

All images are served through `/api/image-proxy` to handle CORS and authentication:

```typescript
function toProxyImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return `/api/image-proxy?url=${encodeURIComponent(getPublicStorageUrl(raw))}`;
}

function getPublicStorageUrl(raw: string): string {
  return raw.startsWith("gs://")
    ? raw.replace("gs://", "https://storage.googleapis.com/")
    : raw.replace("https://storage.cloud.google.com/", "https://storage.googleapis.com/");
}
```

This ensures all images load correctly regardless of their storage location and handles authentication headers when needed.

---

## Authentication & Security

### Better Auth Integration

The application uses **Better Auth 1.6.0** with a sophisticated proxy pattern to maintain first-party cookies:

```typescript
// lib/auth-client.ts
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  fetchOptions: {
    credentials: "include",
  },
  plugins: [jwtClient()],
});

export async function getAgentToken(): Promise<string | null> {
  const { data, error } = await authClient.token();
  if (error || !data) return null;
  return data.token ?? null;
}
```

### Authentication Flow Architecture

1. **Frontend Routes**: All auth requests go to `/api/auth/*` on the frontend domain
2. **Proxy Pattern**: Next.js rewrites these to `${BACKEND_URL}/api/auth/*`
3. **First-Party Cookies**: This ensures cookies are always first-party, avoiding CORS and Safari ITP issues
4. **JWT Tokens**: For API calls to agents, JWT tokens are extracted and used as Bearer tokens

### Route Protection Pattern

```typescript
// hooks/useAuthGuard.ts
export function useAuthGuard() {
  const { data: session, isLoading } = authClient.useSession();
  const router = useRouter();
  
  useEffect(() => {
    if (!isLoading && !session) {
      router.push('/sign-in');
    }
  }, [session, isLoading, router]);
  
  return { session, isLoading, isAuthenticated: !!session };
}
```

### Server-Side Session Validation

Protected pages perform server-side session checks:

```typescript
async function getSessionFromBackend(): Promise<SessionPayload> {
  const cookie = (await headers()).get("cookie") ?? "";
  
  const authURL = (process.env.AUTH_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");
  
  try {
    const response = await fetch(`${authURL}/api/auth/get-session`, {
      headers: { cookie },
      cache: "no-store",
    });
    
    if (!response.ok) return null;
    return (await response.json()) as SessionPayload;
  } catch (err) {
    console.warn("Backend connection failed. Returning null session.", err);
    return null;
  }
}
```

### Security Headers Configuration

```typescript
// next.config.ts
async headers() {
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    // Required for SharedArrayBuffer (used by @ffmpeg/ffmpeg)
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
  ];

  if (process.env.NODE_ENV === "production") {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }

  return [{ source: "/:path*", headers }];
}
```

The COOP/COEP headers are specifically required for FFmpeg.wasm to function with SharedArrayBuffer.

---

## API Integration Patterns

### Proxy Architecture for Multi-Service Communication

The frontend communicates with two distinct backend services:

1. **Node.js Backend** (`localhost:8000`): Handles CRUD operations, authentication, and database management
2. **Python Agent Engine** (`localhost:8001`): Handles AI generation, image processing, and content creation

All requests are proxied through the frontend to maintain first-party cookies and avoid CORS:

```typescript
// next.config.ts
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: `${process.env.BACKEND_URL}/api/:path*`,
    },
  ];
}
```

### Agent API Integration Pattern

When calling AI agents, the frontend uses JWT tokens for authentication:

```typescript
const handleGenerate = async () => {
  // 1. Create creative record in Node.js backend
  const res = await fetch(`/api/campaigns/${campaignId}/creatives`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "IMAGE",
      promptType: "GUIDED",
      guidedBackgroundPrompt: JSON.stringify(formData.background),
      // ... other prompt data
    }),
  });
  
  const data = await res.json();
  const newCreativeId = data.creative?.id;

  // 2. Invoke Python agent with JWT token
  const agentBase = "/api"; // Proxied to agent service
  const token = await getAgentToken();
  
  if (token) {
    fetch(`${agentBase}/agents/image/invoke`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${token}` 
      },
      body: JSON.stringify({ 
        campaign_id: campaignId, 
        creative_id: newCreativeId, 
        variants 
      }),
    }).catch(err => console.warn("Image agent failed:", err));
  }

  // 3. Redirect to preview with polling
  router.replace(`/preview/image?campaignId=${campaignId}&creativeId=${newCreativeId}&batch=true`);
};
```

### Error Handling and Retry Logic

The application implements sophisticated error handling for network requests:

```typescript
async function fetchCampaignCreatives() {
  try {
    const res = await fetch(`/api/campaigns/${campaignId}/creatives`);
    if (!res.ok) return;
    
    const data = await res.json();
    // Process successful response...
  } catch (err) {
    console.error('Fetch creatives error:', err);
    // Continue polling on error - don't break the user experience
  }
}
```

### Image Proxy Implementation

All external images are proxied to handle CORS and authentication:

```typescript
// Image proxy route handles GCS URLs
function toProxyImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  
  // Convert gs:// URLs to HTTPS
  const https = raw.startsWith("gs://")
    ? raw.replace("gs://", "https://storage.googleapis.com/")
    : raw;
    
  // Proxy through frontend
  return `/api/image-proxy?url=${encodeURIComponent(https)}`;
}
```

### Polling Implementation with Cleanup

```typescript
useEffect(() => {
  let cancelled = false;
  let count = 0;

  const poll = async () => {
    if (cancelled) return;
    await fetchCampaignCreatives();
    count++;
    
    const allReady = areExpectedVariantsReady(creativesRef.current, expectedVariantsRef.current);
    
    if (count >= MAX_POLLS || allReady) {
      return; // Stop polling
    }
    
    setTimeout(poll, getPreviewPollDelay(count));
  };
  
  poll();
  return () => { cancelled = true; }; // Cleanup on unmount
}, [fetchCampaignCreatives]);
```

---

## Performance Optimizations

### Next.js App Router Optimizations

The application leverages several Next.js performance features:

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  output: "standalone",
  turbopack: {}, // Next.js 15+ default bundler for faster builds
};
```

### Canvas Performance Strategies

The Fabric.js canvas implements several performance optimizations:

1. **Event Debouncing**: History serialization is debounced to prevent performance issues during rapid changes:

```typescript
const markDirty = () => {
  if (isUndoingRef.current) return;
  
  // Debounce history serialization to avoid layout race conditions
  if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
  historyTimerRef.current = setTimeout(() => {
    try {
      const json = fabricRef.current.toJSON();
      historyRef.current.push(JSON.stringify(json));
      if (historyRef.current.length > 30) historyRef.current.shift();
    } catch (err) {
      console.warn("Failed to serialize canvas for history:", err);
    }
  }, 200);
};
```

2. **Selective Rendering**: Only update highlight rectangles when text objects change:

```typescript
canvas.on("object:moving", (e: any) => {
  const obj = e.target;
  if (obj && (obj.type === "i-text" || obj.type === "textbox")) {
    syncHighlightRect(canvas, obj); // Only for text objects
  }
});
```

3. **Zoom Optimization**: Maintain natural canvas size while scaling viewport:

```typescript
const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  const nW = naturalSizeRef.current.w;
  const nH = naturalSizeRef.current.h;
  
  const newZoom = Math.min(4, Math.max(0.1, canvas.getZoom() + delta));
  canvas.setZoom(newZoom);
  canvas.setDimensions({ width: nW * newZoom, height: nH * newZoom });
  canvas.renderAll();
};
```

### Polling Optimization with Exponential Backoff

The preview page implements intelligent polling that reduces server load:

```typescript
function getPreviewPollDelay(count: number): number {
  return count < 10 ? 2000 : Math.min(BASE_INTERVAL * (count - 10 + 1), MAX_INTERVAL);
}
```

This starts with 2-second intervals for responsive updates, then gradually increases to 10-second intervals to reduce server load.

### Image Loading Optimization

Images are loaded with proper error handling and fallbacks:

```typescript
<img
  src={creative.signedUrl ?? ""}
  alt={`Variant ${index + 1}`}
  className="w-full h-full object-cover transition-opacity duration-500"
  onError={(e) => {
    const url = getDisplayUrl(creative);
    if (url) (e.target as HTMLImageElement).src = url;
  }}
/>
```

### Memory Management

The application implements proper cleanup for timers and event listeners:

```typescript
useEffect(() => {
  const timer = setInterval(poll, 3000);
  return () => clearInterval(timer); // Cleanup on unmount
}, []);

useEffect(() => {
  globalThis.addEventListener("keydown", handleKeyDown);
  return () => {
    globalThis.removeEventListener("keydown", handleKeyDown);
  };
}, []);
```

### FFmpeg.wasm Optimization

Video processing is optimized for client-side performance:

```typescript
export function useFFmpegCompositor() {
  const [ffmpeg, setFFmpeg] = useState<FFmpeg | null>(null);
  
  // Load FFmpeg only when needed
  const loadFFmpeg = useCallback(async () => {
    if (!ffmpeg) {
      const ffmpegInstance = new FFmpeg();
      await ffmpegInstance.load();
      setFFmpeg(ffmpegInstance);
    }
  }, [ffmpeg]);
  
  // Process video with proper cleanup
  const processVideo = useCallback(async (inputFile: File) => {
    if (!ffmpeg) await loadFFmpeg();
    
    try {
      // Video processing logic...
    } finally {
      // Cleanup temporary files
      ffmpeg.deleteFile("input.mp4");
      ffmpeg.deleteFile("output.mp4");
    }
  }, [ffmpeg, loadFFmpeg]);
}
```

---

## Environment Configuration (`.env.local`)

To run the frontend locally, your `.env.local` must be configured correctly. The application routes traffic to two distinct backends.

```env
# Backend API (server-side Node.js CRUD service)
BACKEND_URL=http://localhost:8000
AUTH_BACKEND_URL=http://localhost:8000

# Public env vars (exposed to browser via NEXT_PUBLIC prefix)
NEXT_PUBLIC_API_URL=http://localhost:8000

# Points to the Python FastAPI Agent Engine:
NEXT_PUBLIC_AGENT_API_URL=http://localhost:8001/api/v1
NEXT_PUBLIC_APP_URL=process.env.NEXT_PUBLIC_APP_URL

# Set to "true" to bypass backend/agent and use mock data for rapid UI prototyping
NEXT_PUBLIC_USE_MOCK=false
USE_MOCK=false
```

### Environment Variable Usage Patterns

1. **BACKEND_URL**: Used by Next.js rewrites and server-side fetch calls
2. **NEXT_PUBLIC_API_URL**: Used by client-side auth and API calls
3. **NEXT_PUBLIC_AGENT_API_URL**: Direct agent calls (when not proxied)
4. **USE_MOCK**: Enables mock data mode for frontend development without backend dependencies

### Mock Data Development Mode

The application supports a mock data mode for rapid UI development:

```typescript
// lib/dummy-data.ts
export const USE_DUMMY_DATA = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export const dummySession = {
  user: { name: "John Doe", email: "john@example.com" },
  session: { expiresAt: new Date(Date.now() + 86400000).toISOString() }
};

// Usage in components
if (USE_DUMMY_DATA) {
  return dummySession;
}
```

This allows frontend developers to work on UI components without running the full backend stack.

---

## Testing & Development

### Testing Framework Architecture

The application uses **Jest 30.3.0** with **Testing Library** for comprehensive testing:

```typescript
// jest.config.ts
const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    '!**/*.d.ts',
  ],
};
```

### Testing Patterns

#### Component Testing with Async Behavior
```typescript
// __tests__/editor/TextStylePanel.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TextStylePanel from '@/components/editor/TextStylePanel';

describe('TextStylePanel', () => {
  it('updates font family when selection changes', async () => {
    const mockOnStyleChange = jest.fn();
    render(<TextStylePanel onStyleChange={mockOnStyleChange} />);
    
    const fontSelect = screen.getByLabelText(/font family/i);
    await userEvent.selectOptions(fontSelect, 'Arial');
    
    await waitFor(() => {
      expect(mockOnStyleChange).toHaveBeenCalledWith({
        fontFamily: 'Arial'
      });
    });
  });
});
```

#### Hook Testing with Polling Logic
```typescript
// __tests__/hooks/useAuthGuard.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useAuthGuard } from '@/hooks/useAuthGuard';

describe('useAuthGuard', () => {
  it('redirects when session expires', async () => {
    const mockPush = jest.fn();
    jest.mock('next/navigation', () => ({
      useRouter: () => ({ push: mockPush })
    }));
    
    const { result } = renderHook(() => useAuthGuard());
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/sign-in');
    });
  });
});
```

#### Integration Testing for Canvas Operations
```typescript
// __tests__/video/OverlayPropertiesPanel.test.ts
describe('Video Overlay Integration', () => {
  it('updates overlay properties and syncs with canvas', async () => {
    const mockCanvas = createMockCanvas();
    render(<OverlayPropertiesPanel canvas={mockCanvas} />);
    
    const opacitySlider = screen.getByLabelText(/opacity/i);
    await userEvent.type(opacitySlider, '0.5');
    
    expect(mockCanvas.getActiveObject().set).toHaveBeenCalledWith({
      opacity: 0.5
    });
  });
});
```

### Development Workflow

#### Local Development Setup
```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests in watch mode
pnpm test --watch

# Run tests with coverage
pnpm test --coverage

# Type checking
npx tsc --noEmit
```

#### Mock Data Development
For rapid UI development without backend dependencies:

```typescript
// Set in .env.local
NEXT_PUBLIC_USE_MOCK=true

// Components automatically use mock data
if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
  console.log("[Mock Mode] Skipping agent call - using mock data");
  return mockCreativeData;
}
```

#### Debugging Patterns

1. **Canvas Debugging**: Use browser dev tools to inspect Fabric.js objects
2. **Polling Debugging**: Console logs show polling progress and state changes
3. **Auth Debugging**: Import auth debug utilities for session inspection

```typescript
// Enable debug logging in development
if (process.env.NODE_ENV === 'development') {
  console.log('[Preview] Polling stopped. Count:', count, 'All ready:', allReady);
}
```

---

## Troubleshooting Guide

### Common Issues and Solutions

#### Authentication Issues

**Problem**: Auth works in Chrome but not Safari
**Root Cause**: Safari's Intelligent Tracking Prevention (ITP) blocks third-party cookies
**Solution**: Ensure all auth requests go through `/api/auth/*` on the frontend domain

```typescript
// ✅ Correct - First-party auth requests
const response = await fetch('/api/auth/get-session', {
  credentials: 'include'
});

// ❌ Wrong - Third-party auth requests
const response = await fetch('http://backend:8000/api/auth/get-session', {
  credentials: 'include'
});
```

**Problem**: CSRF/Origin errors from Better Auth
**Solution**: Check backend `trustedOrigins` includes frontend URL

```env
# Backend configuration
CLIENT_URL=process.env.NEXT_PUBLIC_APP_URL
TRUSTED_ORIGINS=process.env.NEXT_PUBLIC_APP_URL,https://app.example.com
```

#### Canvas Performance Issues

**Problem**: Canvas becomes slow with many objects
**Solution**: Implement object pooling and selective rendering

```typescript
// Disable events when not needed
canvas.selection = false;
obj.set({ selectable: false, evented: false });

// Use object pooling for frequent operations
const textPool = new Map();
function getPooledText(id: string) {
  if (!textPool.has(id)) {
    textPool.set(id, new fabric.Textbox(''));
  }
  return textPool.get(id);
}
```

**Problem**: Canvas export fails or produces blank images
**Solution**: Ensure all images are loaded with proper CORS headers

```typescript
// Wait for all images to load before export
await Promise.all(
  canvas.getObjects()
    .filter(obj => obj.type === 'image')
    .map(img => new Promise(resolve => {
      if (img.getSrc()) {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = resolve;
        image.src = img.getSrc();
      } else {
        resolve();
      }
    }))
);
```

#### Polling and State Issues

**Problem**: Polling stops working after component re-renders
**Root Cause**: Stale closure capturing old state values
**Solution**: Use `useRef` for values accessed in polling loops

```typescript
// ❌ Wrong - Stale closure
const [count, setCount] = useState(0);
useEffect(() => {
  const poll = () => {
    console.log(count); // Always logs 0
    if (count < 10) setTimeout(poll, 1000);
  };
  poll();
}, []); // Empty dependency array causes stale closure

// ✅ Correct - Use ref for polling
const [count, setCount] = useState(0);
const countRef = useRef(0);
useEffect(() => { countRef.current = count; }, [count]);

useEffect(() => {
  const poll = () => {
    console.log(countRef.current); // Always current value
    if (countRef.current < 10) setTimeout(poll, 1000);
  };
  poll();
}, []);
```

#### FFmpeg.wasm Issues

**Problem**: FFmpeg fails to load with SharedArrayBuffer errors
**Solution**: Ensure COOP/COEP headers are set correctly

```typescript
// next.config.ts
async headers() {
  return [{
    source: "/:path*",
    headers: [
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
    ],
  }];
}
```

**Problem**: Video processing fails silently
**Solution**: Add proper error handling and cleanup

```typescript
const processVideo = async (inputFile: File) => {
  try {
    if (!ffmpeg.loaded) await ffmpeg.load();
    
    await ffmpeg.writeFile("input.mp4", await fetchFile(inputFile));
    await ffmpeg.exec(["-i", "input.mp4", "-c", "copy", "output.mp4"]);
    
    const data = await ffmpeg.readFile("output.mp4");
    return new Blob([data], { type: "video/mp4" });
  } catch (error) {
    console.error("FFmpeg processing failed:", error);
    throw error;
  } finally {
    // Always cleanup temporary files
    try {
      await ffmpeg.deleteFile("input.mp4");
      await ffmpeg.deleteFile("output.mp4");
    } catch (cleanupError) {
      console.warn("Cleanup failed:", cleanupError);
    }
  }
};
```

#### Build and TypeScript Issues

**Problem**: TypeScript errors during build
**Solution**: Clear TypeScript cache and rebuild

```bash
# Clear TypeScript cache
rm -rf .next
rm tsconfig.tsbuildinfo
pnpm build
```

**Problem**: Module resolution errors
**Solution**: Check path mapping in `tsconfig.json`

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

#### Image Loading and CORS Issues

**Problem**: Images fail to load from Google Cloud Storage
**Solution**: Use the image proxy for all external images

```typescript
// ✅ Correct - Use proxy for all external images
const imageUrl = toProxyImageUrl(creative.url);

// ❌ Wrong - Direct GCS URLs may fail CORS
const imageUrl = creative.url;
```

**Problem**: Canvas export includes broken images
**Solution**: Preload all images with proper error handling

```typescript
async function preloadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn(`Failed to load image: ${src}`);
      // Create placeholder image
      const placeholder = new Image();
      placeholder.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2NjYyIvPjwvc3ZnPg==';
      resolve(placeholder);
    };
    img.src = src;
  });
}
```

### Debug Tools and Logging

#### Enable Debug Mode
```typescript
// Add to .env.local for verbose logging
DEBUG=true
NEXT_PUBLIC_DEBUG=true
```

#### Canvas Debug Utilities
```typescript
// Debug canvas state
function debugCanvas(canvas: fabric.Canvas) {
  console.log('Canvas objects:', canvas.getObjects().length);
  console.log('Active object:', canvas.getActiveObject());
  console.log('Canvas zoom:', canvas.getZoom());
  console.log('Canvas dimensions:', canvas.getWidth(), 'x', canvas.getHeight());
}

// Debug layer metadata
function debugLayers(canvas: fabric.Canvas) {
  canvas.getObjects().forEach((obj, index) => {
    console.log(`Layer ${index}:`, {
      id: (obj as any).__layerId,
      type: (obj as any).__layerType,
      visible: obj.visible,
      selectable: obj.selectable,
    });
  });
}
```

#### Network Debug Utilities
```typescript
// Debug API calls
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  console.log('API Call:', input, init);
  const response = await originalFetch(input, init);
  console.log('API Response:', response.status, response.statusText);
  return response;
};
```

This comprehensive troubleshooting guide covers the most common issues developers encounter when working with the Enterprise MarTech Frontend. The solutions are based on real-world debugging experience and provide both immediate fixes and long-term architectural improvements.

---


