import React, { useState } from "react";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { deleteAccount } from "../services/authService";
import type { UserAccount } from "../types";

interface DeleteAccountModalProps {
  user: UserAccount;
  galleryCount: number;
  onClose: () => void;
  onDeleted: () => void;
}

const CONFIRM_PHRASE = "DELETE";

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  user,
  galleryCount,
  onClose,
  onDeleted,
}) => {
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = confirmText === CONFIRM_PHRASE && !submitting;

  const handleDelete = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    setError(null);
    try {
      await deleteAccount();
      onDeleted();
    } catch (e) {
      setError((e as Error).message || "Couldn't delete account. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade"
      onClick={submitting ? undefined : onClose}
    >
      <div
        className="bg-google-surface w-full max-w-lg rounded-[2rem] border border-red-400/40 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-2 flex items-center justify-between border-b border-google-border">
          <div className="flex items-center space-x-3 text-red-400">
            <AlertTriangle size={22} />
            <h3 className="text-xl font-bold">Delete your account</h3>
          </div>
          {!submitting && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-2 bg-google-bg rounded-full text-google-gray hover:text-google-dark hover:bg-google-border transition-all"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="p-6 space-y-5 text-sm text-google-dark">
          <p className="leading-relaxed">
            This will permanently delete your PRHOMZ AI Designer account. <span className="font-bold">This action cannot be undone after the 30-day grace period.</span>
          </p>

          <div className="bg-google-bg rounded-xl border border-google-border p-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-google-gray">What will happen</p>
            <ul className="list-disc list-inside space-y-1 text-google-dark text-xs leading-relaxed">
              <li>Your account ({user.email}) will be disabled immediately — you will be signed out.</li>
              {user.subscriptionStatus === "active" && (
                <li>Your <span className="font-bold uppercase">{user.tier}</span> subscription will be cancelled. No further charges will occur and no refund will be issued for the current period.</li>
              )}
              <li><span className="font-bold">{galleryCount}</span> gallery {galleryCount === 1 ? "item" : "items"} and all stored images will be deleted after a 30-day grace period.</li>
              <li>Your past feedback will be retained but anonymized.</li>
              <li>You will not be able to sign back in. If you want to restore the account during the grace period, contact support.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-delete" className="text-[10px] font-bold uppercase tracking-widest text-google-gray block">
              To confirm, type <span className="text-red-400 font-black">{CONFIRM_PHRASE}</span> below
            </label>
            <input
              id="confirm-delete"
              type="text"
              autoComplete="off"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={submitting}
              placeholder={CONFIRM_PHRASE}
              className="w-full bg-google-bg border border-google-border rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-red-400 focus:outline-none text-google-dark placeholder-google-gray"
            />
          </div>

          {error && <p className="text-xs text-red-400 font-semibold">{error}</p>}
        </div>

        <div className="p-4 border-t border-google-border bg-google-bg/30 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-google-gray hover:text-google-dark transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!canConfirm}
            className="px-5 py-2.5 bg-red-400 text-google-bg rounded-xl text-xs font-bold uppercase tracking-widest shadow hover:brightness-110 transition-all flex items-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete forever</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
