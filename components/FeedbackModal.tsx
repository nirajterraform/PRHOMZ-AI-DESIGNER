import React from "react";
import { X } from "lucide-react";
import { FeedbackForm } from "./FeedbackForm";
import type { UserAccount } from "../types";

interface FeedbackModalProps {
  user: UserAccount;
  onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ user, onClose }) => (
  <div
    className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade"
    onClick={onClose}
  >
    <div
      className="bg-google-surface w-full max-w-lg rounded-[2rem] border border-google-border shadow-2xl overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-6 pt-6 pb-2 flex items-center justify-between">
        <h3 className="text-xl font-bold text-google-dark">Send feedback</h3>
        <button
          onClick={onClose}
          aria-label="Close"
          className="p-2 bg-google-bg rounded-full text-google-gray hover:text-google-dark hover:bg-google-border transition-all"
        >
          <X size={18} />
        </button>
      </div>
      <FeedbackForm
        user={user}
        context="menu"
        onSubmitted={() => setTimeout(onClose, 1500)}
        onDismiss={onClose}
        variant="modal"
      />
    </div>
  </div>
);
