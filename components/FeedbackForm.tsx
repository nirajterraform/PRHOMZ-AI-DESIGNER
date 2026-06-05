import React, { useState } from "react";
import { Star, Send, CheckCircle2 } from "lucide-react";
import type { UserAccount } from "../types";
import { submitFeedback, type FeedbackContext } from "../services/feedbackService";

interface FeedbackFormProps {
  user: UserAccount;
  context: FeedbackContext;
  imageId?: string | null;
  onSubmitted?: () => void;
  onDismiss?: () => void;
  variant?: "inline" | "modal";
}

export const FeedbackForm: React.FC<FeedbackFormProps> = ({
  user,
  context,
  imageId,
  onSubmitted,
  onDismiss,
  variant = "inline",
}) => {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (rating < 1) {
      setError("Please pick a star rating first.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await submitFeedback({ rating, comment, context, imageId, user });
      setSubmitted(true);
      onSubmitted?.();
    } catch (e) {
      setError((e as Error).message || "Couldn't submit feedback. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className={containerClass(variant)}>
        <div className="flex items-center space-x-3 text-google-blue">
          <CheckCircle2 size={20} />
          <p className="text-sm font-bold">Thanks — your feedback helps us improve PRHOMZ AI Designer.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass(variant)}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-google-dark">How was this design?</h4>
            <p className="text-xs text-google-gray mt-0.5">Your rating helps us improve.</p>
          </div>
          {onDismiss && variant === "inline" && (
            <button
              onClick={onDismiss}
              className="text-[10px] font-bold uppercase tracking-widest text-google-gray hover:text-google-dark transition-colors"
            >
              Skip
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = n <= (hovered || rating);
            return (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setRating(n)}
                className="transition-transform hover:scale-110"
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
              >
                <Star
                  size={24}
                  className={filled ? "fill-google-blue text-google-blue" : "text-google-gray"}
                />
              </button>
            );
          })}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What could we improve? (optional)"
          maxLength={2000}
          rows={2}
          className="w-full bg-google-bg border border-google-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-google-blue focus:outline-none text-google-dark placeholder-google-gray resize-none"
        />

        {error && <p className="text-xs text-red-400 font-semibold">{error}</p>}

        <div className="flex items-center justify-end space-x-3">
          {onDismiss && variant === "modal" && (
            <button
              onClick={onDismiss}
              className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-google-gray hover:text-google-dark transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting || rating < 1}
            className="px-5 py-2.5 bg-google-blue text-google-bg rounded-xl text-xs font-bold uppercase tracking-widest shadow hover:brightness-110 transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={14} />
            <span>{submitting ? "Sending..." : "Submit"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

function containerClass(variant: "inline" | "modal"): string {
  if (variant === "modal") {
    return "p-6";
  }
  return "mt-4 bg-google-surface border border-google-border rounded-2xl p-5 shadow-sm";
}
