import { randomUUID } from "crypto";
import * as admin from "firebase-admin";

export const GALLERY_BUCKET = process.env.GALLERY_BUCKET ?? "prhomzmvp-nonprod-gallery";

/**
 * Uploads a buffer to the gallery bucket at the given path and returns a
 * Firebase-style download URL (long-lived, token-based).
 *
 * The token is written into the object's metadata as
 * `firebaseStorageDownloadTokens` — the same field the Firebase Storage client
 * SDK reads when constructing download URLs. Same URL format works in both the
 * Storage emulator and production.
 */
export async function uploadAndGetDownloadURL(
  storagePath: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const bucket = admin.storage().bucket(GALLERY_BUCKET);
  const file = bucket.file(storagePath);
  const token = randomUUID();

  await file.save(buffer, {
    contentType,
    metadata: {
      cacheControl: "public, max-age=86400",
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  const encodedPath = encodeURIComponent(storagePath);
  const baseUrl =
    process.env.FUNCTIONS_EMULATOR === "true"
      ? "http://127.0.0.1:9199"
      : "https://firebasestorage.googleapis.com";

  return `${baseUrl}/v0/b/${GALLERY_BUCKET}/o/${encodedPath}?alt=media&token=${token}`;
}
