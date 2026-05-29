import React from "react";
import { Clock, CalendarDays, Infinity as InfinityIcon, AlertTriangle } from "lucide-react";
import type { UserAccount } from "../types";
import {
  getDailyQuotaSnapshot,
  getMonthlyQuotaSnapshot,
  type QuotaSeverity,
  type QuotaSnapshot,
} from "../services/quotaService";

interface QuotaBadgeProps {
  user: UserAccount | null;
  onUpgradeClick?: () => void;
}

/**
 * Renders 0, 1, or 2 chips depending on which limits are finite for the user's
 * tier:
 *   - Freemium / Basic: daily + monthly chips
 *   - Advanced: monthly chip only (daily is unlimited)
 *   - Designer: no chips (both unlimited)
 *
 * Each chip shows used / limit, a progress bar, and is color-coded by severity.
 * Clicking a chip in the exhausted state calls `onUpgradeClick`.
 */
export const QuotaBadge: React.FC<QuotaBadgeProps> = ({ user, onUpgradeClick }) => {
  if (!user) return null;

  const daily = getDailyQuotaSnapshot(user);
  const monthly = getMonthlyQuotaSnapshot(user);

  // Designer (both unlimited) gets no chip — render a single "Unlimited" indicator instead.
  if (daily.isUnlimited && monthly.isUnlimited) {
    return <UnlimitedBadge />;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {!daily.isUnlimited && (
        <QuotaChip
          icon={Clock}
          label="Today"
          snapshot={daily}
          onUpgradeClick={onUpgradeClick}
        />
      )}
      {!monthly.isUnlimited && (
        <QuotaChip
          icon={CalendarDays}
          label="This month"
          snapshot={monthly}
          onUpgradeClick={onUpgradeClick}
        />
      )}
    </div>
  );
};

interface QuotaChipProps {
  icon: React.FC<{ size?: number; className?: string }>;
  label: string;
  snapshot: QuotaSnapshot;
  onUpgradeClick?: () => void;
}

const QuotaChip: React.FC<QuotaChipProps> = ({ icon: Icon, label, snapshot, onUpgradeClick }) => {
  const styles = chipStyles(snapshot.severity);
  const isExhausted = snapshot.severity === "exhausted";
  const interactive = isExhausted && !!onUpgradeClick;

  const inner = (
    <>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center space-x-2">
          <Icon size={14} className={styles.iconClass} />
          <span className={`text-[10px] font-bold uppercase tracking-widest ${styles.labelClass}`}>
            {label}
          </span>
        </div>
        {isExhausted && <AlertTriangle size={12} className="text-red-400" />}
      </div>

      <div className="flex items-baseline justify-between mb-2">
        <span className={`text-base font-bold ${styles.valueClass} tabular-nums`}>
          {snapshot.used} / {snapshot.limit}
        </span>
        <span className={`text-[10px] font-medium ${styles.subtextClass} tabular-nums`}>
          {snapshot.remaining} left
        </span>
      </div>

      <div className="h-1.5 bg-google-bg rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${styles.fillClass}`}
          style={{ width: `${snapshot.percentUsed}%` }}
        />
      </div>

      {isExhausted && onUpgradeClick && (
        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-red-400">
          Upgrade for more →
        </p>
      )}
    </>
  );

  if (interactive) {
    return (
      <button
        onClick={onUpgradeClick}
        className={`min-w-[160px] text-left px-4 py-3 rounded-xl border transition-all ${styles.containerClass} hover:scale-[1.02] active:scale-[0.98]`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={`min-w-[160px] px-4 py-3 rounded-xl border ${styles.containerClass}`}>
      {inner}
    </div>
  );
};

const UnlimitedBadge: React.FC = () => (
  <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-google-blue/10 border border-google-blue/30">
    <InfinityIcon size={14} className="text-google-blue" />
    <span className="text-[10px] font-bold uppercase tracking-widest text-google-blue">
      Unlimited renders
    </span>
  </div>
);

interface ChipStyles {
  containerClass: string;
  iconClass: string;
  labelClass: string;
  valueClass: string;
  subtextClass: string;
  fillClass: string;
}

function chipStyles(severity: QuotaSeverity): ChipStyles {
  switch (severity) {
    case "exhausted":
      return {
        containerClass: "bg-red-400/10 border-red-400/30 cursor-pointer",
        iconClass: "text-red-400",
        labelClass: "text-red-400",
        valueClass: "text-google-dark",
        subtextClass: "text-red-400",
        fillClass: "bg-red-400",
      };
    case "critical":
      return {
        containerClass: "bg-orange-400/10 border-orange-400/30",
        iconClass: "text-orange-400",
        labelClass: "text-orange-400",
        valueClass: "text-google-dark",
        subtextClass: "text-orange-400",
        fillClass: "bg-orange-400",
      };
    case "warning":
      return {
        containerClass: "bg-yellow-400/10 border-yellow-400/30",
        iconClass: "text-yellow-500",
        labelClass: "text-yellow-600",
        valueClass: "text-google-dark",
        subtextClass: "text-yellow-600",
        fillClass: "bg-yellow-400",
      };
    case "ok":
    default:
      return {
        containerClass: "bg-google-surface border-google-border",
        iconClass: "text-google-blue",
        labelClass: "text-google-gray",
        valueClass: "text-google-dark",
        subtextClass: "text-google-gray",
        fillClass: "bg-google-blue",
      };
  }
}
