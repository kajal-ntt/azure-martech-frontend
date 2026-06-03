import type { Creative, BrandKit } from "../../components/editor/EditorLayout";

export async function fetchCreative(id: string): Promise<Creative> {
  const res = await fetch(`/api/creatives/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch creative: ${res.status}`);
  }
  const data = await res.json();
  return data.creative ?? data;
}

export async function fetchSignedUrl(id: string): Promise<string> {
  const res = await fetch(`/api/creatives/${id}/signed-url`);
  if (!res.ok) {
    throw new Error(`Failed to fetch signed URL: ${res.status}`);
  }
  const data = await res.json();
  return data.url ?? "";
}

export async function fetchBrandKit(campaignId: string): Promise<BrandKit | null> {
  const res = await fetch(`/api/campaigns/${campaignId}/brand-kit`);
  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  return data.brandKit ?? null;
}

export async function uploadEditedImage(creativeId: string, blob: Blob): Promise<Creative> {
  const formData = new FormData();
  formData.append("image", blob, "edited.png");

  console.log("[Editor API] Uploading edited image for creative:", creativeId);
  console.log("[Editor API] Blob size:", blob.size, "bytes");

  // Creates a NEW creative record instead of overwriting the existing one
  const res = await fetch(`/api/creatives/${creativeId}/save-as-new`, {
    method: "POST",
    body: formData,
  });

  console.log("[Editor API] Response status:", res.status);

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    console.error("[Editor API] Save failed:", res.status, errorText);
    throw new Error(`Failed to save new creative: ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  console.log("[Editor API] Save successful, new creative ID:", data.creative?.id);
  return data.creative ?? data;
}
