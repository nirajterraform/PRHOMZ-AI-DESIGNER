import React from "react";
import { Ban, Sparkles, X, Clock, CalendarDays } from "lucide-react";
import type { UserAccount } from "../types";

export type QuotaExceededReason = "daily_exceeded" | "monthly_exceeded";

interface QuotaExceededModalProps {
  isOpen: boolean;
  user: UserAccount;
  reason: QuotaExceededReason;
  dailyUsed: number;
  dailyLimit: number;
  monthlyUsed: number;
  monthlyLimit: number;
  onClose: () => void;
  onUpgrade: () => void;
}

/**
 * Friendly recovery modal shown when the server rejects a render with
 * HttpsError(resource-exhausted). Replaces the bare `alert()` previously used.
 *
 * Copy is intentionally informative, not aggressive — see Phase 5 §3.6.
 */
export const QuotaExceededModal: React.FC<QuotaExceededModalProps> = ({
  isOpen,
  user,
  reason,
  dailyUsed,
  dailyLimit,
  monthlyUsed,
  monthlyLimit,
  onClose,
  onUpgrade,
}) => {
  if (!isOpen) return null;

  const tierLabel = user.tier.charAt(0).toUpperCase() + user.tier.slice(1);
  const isDaily = reason === "daily_exceeded";

  const title = isDaily ? "Daily limit reached" : "Monthly limit reached";
  const body = isDaily
    ? `You've used today's ${dailyLimit} renders on the ${tierLabel} plan. They reset on a rolling 24-hour window — or upgrade for more renders right now.`
    : `You've used this month's ${monthlyLimit} renders on the ${tierLabel} plan. Your monthly bucket resets on the 1st — or upgrade for more renders right now.`;

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
          <div className="w-11 h-11 rounded-2xl bg-red-400/15 border border-red-400/30 flex items-center justify-center">
            <Ban size={20} className="text-red-400" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">Quota reached</p>
            <h3 className="text-xl font-semibold text-google-dark">{title}</h3>
          </div>
        </div>

        <p className="text-sm text-google-gray leading-relaxed mb-5">{body}</p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <CounterTile
            icon={Clock}
            label="Today"
            used={dailyUsed}
            limit={dailyLimit}
            highlight={isDaily}
          />
          <CounterTile
            icon={CalendarDays}
            label="This month"
            used={monthlyUsed}
            limit={monthlyLimit}
            highlight={!isDaily}
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 rounded-xl border border-google-border text-google-dark font-bold text-sm hover:bg-google-bg transition-all active:scale-[0.98]"
          >
            Got it
          </button>
          <button
            onClick={onUpgrade}
            className="flex-1 px-6 py-3 rounded-xl bg-google-blue text-google-bg font-bold text-sm hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
          >
            <Sparkles size={14} />
            <span>Upgrade</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface CounterTileProps {
  icon: React.FC<{ size?: number; className?: string }>;
  label: string;
  used: number;
  limit: number;
  highlight: boolean;
}

const CounterTile: React.FC<CounterTileProps> = ({ icon: Icon, label, used, limit, highlight }) => {
  const isUnlimited = !isFinite(limit);
  const container = highlight
    ? "bg-red-400/10 border-red-400/30"
    : "bg-google-bg border-google-border";
  const iconColor = highlight ? "text-red-400" : "text-google-blue";
  const labelColor = highlight ? "text-red-400" : "text-google-gray";

  return (
    <div className={`px-4 py-3 rounded-2xl border ${container}`}>
      <div className="flex items-center space-x-2 mb-2">
        <Icon size={12} className={iconColor} />
        <span className={`text-[10px] font-bold uppercase tracking-widest ${labelColor}`}>{label}</span>
      </div>
      <p className="text-base font-bold text-google-dark tabular-nums">
        {isUnlimited ? "Unlimited" : `${used} / ${limit}`}
      </p>
    </div>
  );
};
