/**
 * Triggers a true PNG download of a cross-origin image URL.
 *
 * Why this exists: the <a download="..."> attribute is silently ignored by
 * browsers when the URL's origin differs from the page origin. Our images live
 * on firebasestorage.googleapis.com and Cloud Run — not on prhomzmvp-nonprod.web.app.
 * So the naive `link.click()` pattern opens the image in a new tab instead of
 * downloading. This helper fetches the bytes into a same-origin Blob URL,
 * which the browser is happy to download.
 */
export async function downloadImage(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (err) {
    console.error("Image download failed, falling back to new-tab open:", err);
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
