import { doc, onSnapshot } from "firebase/firestore";
import { firestore } from "./firebaseClient";
import type { UserAccount } from "../types";

export function subscribeToUser(
  uid: string,
  onChange: (user: UserAccount | null) => void,
): () => void {
  const ref = doc(firestore, "users", uid);
  return onSnapshot(ref, (snap) => {
    onChange(snap.exists() ? (snap.data() as UserAccount) : null);
  });
}
