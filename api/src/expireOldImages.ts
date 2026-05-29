import * as admin from "firebase-admin";
import { GALLERY_BUCKET } from "./lib/storage";

export interface ExpireOldImagesOutput {
  deletedCount: number;
}

/**
 * Sweeps gallery docs where expiresAt < now, deletes them from Firestore and
 * the matching Storage objects. Limited to 500 per run to keep latency bounded;
 * Cloud Scheduler invokes hourly, so a backlog clears within a few runs.
 *
 * Replaces the firebase-functions onSchedule from the Cloud Functions era.
 */
export async function handleExpireOldImages(): Promise<ExpireOldImagesOutput> {
  const db = admin.firestore();
  const bucket = admin.storage().bucket(GALLERY_BUCKET);
  const now = Date.now();

  const expiredSnap = await db
    .collectionGroup("gallery")
    .where("expiresAt", "<", now)
    .limit(500)
    .get();

  if (expiredSnap.empty) {
    console.log(JSON.stringify({ severity: "INFO", event: "expire_old_images_run", deletedCount: 0 }));
    return { deletedCount: 0 };
  }

  let deletedCount = 0;
  const batch = db.batch();

  for (const doc of expiredSnap.docs) {
    const data = doc.data();
    batch.delete(doc.ref);

    const paths: string[] = [];
    if (data.storagePath) paths.push(data.storagePath);
    if (data.thumbnailPath) paths.push(data.thumbnailPath);

    for (const path of paths) {
      try {
        await bucket.file(path).delete({ ignoreNotFound: true });
      } catch (e) {
        console.warn(
          JSON.stringify({
            severity: "WARNING",
            event: "storage_delete_failed",
            path,
            error: (e as Error).message,
          }),
        );
      }
    }
    deletedCount++;
  }

  await batch.commit();
  console.log(JSON.stringify({ severity: "INFO", event: "expire_old_images_run", deletedCount }));
  return { deletedCount };
}
