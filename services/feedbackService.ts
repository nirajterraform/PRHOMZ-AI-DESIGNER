import { addDoc, collection } from "firebase/firestore";
import { firestore } from "./firebaseClient";
import { auth } from "./firebaseClient";
import type { UserAccount } from "../types";

export type FeedbackContext = "remodel-result" | "menu";

export interface SubmitFeedbackInput {
  rating: number;
  comment: string;
  context: FeedbackContext;
  imageId?: string | null;
  user: UserAccount;
}

export async function submitFeedback(input: SubmitFeedbackInput): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in");
  if (uid !== input.user.id) throw new Error("User mismatch");
  if (input.rating < 1 || input.rating > 5) throw new Error("Rating must be 1-5");

  await addDoc(collection(firestore, "feedback"), {
    uid,
    email: input.user.email || "",
    tier: input.user.tier,
    rating: input.rating,
    comment: input.comment.trim().slice(0, 2000),
    context: input.context,
    imageId: input.imageId ?? null,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    createdAt: Date.now(),
  });
}
