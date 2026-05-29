import * as admin from "firebase-admin";
import sharp from "sharp";
import { GALLERY_BUCKET } from "./lib/storage";

const THUMB_WIDTH = 400;
const THUMB_HEIGHT = 300;
const THUMB_QUALITY = 80;

/**
 * GCS object-finalize handler. Eventarc binary-mode delivers the object
 * metadata JSON directly as the request body. We only care about new uploads
 * under `gallery/{uid}/{imageId}.{ext}` — anything else (thumbnails, files in
 * other prefixes) is ignored.
 *
 * Replaces the v2 firebase-functions onObjectFinalized trigger.
 */
export interface GcsFinalizeEvent {
  bucket?: string;
  name?: string;
  contentType?: string;
  size?: string;
  generation?: string;
}

export interface OnGalleryFinalizeOutput {
  skipped?: string;
  thumbnailPath?: string;
  uid?: string;
  imageId?: string;
}

export async function handleOnGalleryFinalize(event: GcsFinalizeEvent): Promise<OnGalleryFinalizeOutput> {
  const filePath = event?.name;
  if (!filePath) return { skipped: "no_name" };

  if (!filePath.startsWith("gallery/")) return { skipped: "not_gallery_prefix" };
  if (filePath.includes("_thumb")) return { skipped: "is_thumbnail" };

  const parts = filePath.split("/");
  if (parts.length !== 3) return { skipped: "unexpected_path_shape" };
  const uid = parts[1];
  const imageId = parts[2].replace(/\.[^.]+$/, "");

  const bucket = admin.storage().bucket(event.bucket || GALLERY_BUCKET);
  const sourceFile = bucket.file(filePath);
  const [sourceBuffer] = await sourceFile.download();

  const thumbBuffer = await sharp(sourceBuffer)
    .resize(THUMB_WIDTH, THUMB_HEIGHT, { fit: "cover" })
    .jpeg({ quality: THUMB_QUALITY })
    .toBuffer();

  const thumbPath = `gallery/${uid}/${imageId}_thumb.jpg`;
  await bucket.file(thumbPath).save(thumbBuffer, {
    contentType: "image/jpeg",
    metadata: { cacheControl: "public, max-age=86400" },
  });

  const galleryDocRef = admin.firestore().doc(`users/${uid}/gallery/${imageId}`);
  const docSnap = await galleryDocRef.get();
  if (!docSnap.exists) {
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        event: "gallery_doc_missing_on_finalize",
        uid,
        imageId,
      }),
    );
    return { skipped: "gallery_doc_missing", uid, imageId };
  }

  await galleryDocRef.update({ thumbnailPath: thumbPath });
  return { thumbnailPath: thumbPath, uid, imageId };
}
