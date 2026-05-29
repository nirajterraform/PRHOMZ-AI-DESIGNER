import React from "react";
import { AlertTriangle, Sparkles, X } from "lucide-react";
import type { UserAccount } from "../types";

interface PreRenderWarningModalProps {
  isOpen: boolean;
  user: UserAccount;
  dailyUsed: number;
  dailyLimit: number;
  onContinue: () => void;
  onSeePlans: () => void;
  onClose: () => void;
}

/**
 * Shown immediately before the user's last allowed daily render. Gives them
 * one friendly heads-up + an upgrade off-ramp before they spend their last
 * slot. Once-per-day suppression is owned by the caller via localStorage.
 */
export const PreRenderWarningModal: React.FC<PreRenderWarningModalProps> = ({
  isOpen,
  user,
  dailyUsed,
  dailyLimit,
  onContinue,
  onSeePlans,
  onClose,
}) => {
  if (!isOpen) return null;

  const tierLabel = user.tier.charAt(0).toUpperCase() + user.tier.slice(1);
  const remaining = Math.max(0, dailyLimit - dailyUsed);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

      <div className="relative bg-google-surface border border-google-border rounded-3xl shadow-2xl max-w-md w-full p-8 animate-fade">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-google-gray hover:text-google-dark hover:bg-google-bg rounded-full transition-all"
        >
          <X size={18} />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center">
            <AlertTriangle size={20} className="text-yellow-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-600">Heads up</p>
            <h3 className="text-xl font-semibold text-google-dark">Last render of the day</h3>
          </div>
        </div>

        <p className="text-sm text-google-gray leading-relaxed mb-5">
          You're about to use your <span className="font-bold text-google-dark">final daily render</span> on
          the {tierLabel} plan. After this, you'll need to wait 24 hours — or upgrade for more renders today.
        </p>

        <div className="bg-google-bg border border-google-border rounded-2xl px-4 py-3 mb-6 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-google-gray">Today's usage</span>
          <span className="text-base font-bold text-google-dark tabular-nums">
            {dailyUsed} / {dailyLimit}
            <span className="ml-2 text-xs font-medium text-google-gray">({remaining} left)</span>
          </span>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <button
            onClick={onContinue}
            className="flex-1 px-6 py-3 rounded-xl border border-google-border text-google-dark font-bold text-sm hover:bg-google-bg transition-all active:scale-[0.98]"
          >
            Continue anyway
          </button>
          <button
            onClick={onSeePlans}
            className="flex-1 px-6 py-3 rounded-xl bg-google-blue text-google-bg font-bold text-sm hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
          >
            <Sparkles size={14} />
            <span>See plans</span>
          </button>
        </div>
      </div>
    </div>
  );
};
