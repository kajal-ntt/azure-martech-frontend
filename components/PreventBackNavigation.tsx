"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Prevents accidental browser back button navigation.
 * Shows a confirmation dialog to prevent users from losing their work.
 */
export default function PreventBackNavigation() {
  const pathname = usePathname();

  useEffect(() => {
    // Skip prevention on public pages, preview pages, and read-only pages (no unsaved changes)
    const publicPages = ["/sign-in", "/", "/sign-up"];
    const previewPages = ["/preview/image", "/preview/video", "/preview/blog", "/preview/email", "/previewall"];
    const readOnlyPages = ["/dashboard", "/campaigns/"];
    const creativesPages = ["/creatives/image", "/creatives/video", "/creatives/email", "/creatives/blog"]; // Allow back navigation from creatives pages
    const editorPages = ["/editor"]; // Editor has its own back navigation handling with isDirty check
    
    if (
      publicPages.includes(pathname) || 
      previewPages.some(page => pathname.startsWith(page)) ||
      readOnlyPages.some(page => pathname.startsWith(page)) ||
      creativesPages.some(page => pathname.startsWith(page)) ||
      editorPages.some(page => pathname.startsWith(page))
    ) {
      return;
    }

    // Add a dummy history entry to intercept back button
    globalThis.history.pushState(null, "", globalThis.location.href);

    const handlePopState = () => {
      // Push state again to stay on current page
      globalThis.history.pushState(null, "", globalThis.location.href);
      
      // Show confirmation dialog
      const shouldLeave = globalThis.confirm(
        "Are you sure you want to leave this page? Any unsaved changes may be lost."
      );
      
      if (shouldLeave) {
        // Check if we have a clean referrer in history state
        const state = globalThis.history.state;
        if (state?.from && state?.cleanHistory) {
          // Navigate to the stored referrer (campaign dashboard)
          globalThis.location.href = state.from;
        } else {
          // Fallback: go back by removing our dummy entries
          globalThis.history.go(-2);
        }
      }
    };

    globalThis.addEventListener("popstate", handlePopState);

    // Cleanup
    return () => {
      globalThis.removeEventListener("popstate", handlePopState);
    };
  }, [pathname]);

  return null;
}

