import React, { useEffect, useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";

interface ExpiryChipProps {
  expiresAt: number;
}

interface ExpiryBucket {
  label: string;
  color: "gray" | "yellow" | "red";
  Icon: typeof Clock;
}

function bucketFor(now: number, expiresAt: number): ExpiryBucket {
  const msLeft = expiresAt - now;
  if (msLeft <= 0) {
    return { label: "Expired", color: "red", Icon: AlertTriangle };
  }
  const hoursLeft = msLeft / (60 * 60 * 1000);
  const daysLeft = hoursLeft / 24;

  if (hoursLeft < 6) {
    return {
      label: `Expires in ${Math.max(1, Math.ceil(hoursLeft))}h`,
      color: "red",
      Icon: AlertTriangle,
    };
  }
  if (hoursLeft < 24) {
    return {
      label: `Expires in ${Math.ceil(hoursLeft)}h`,
      color: "yellow",
      Icon: Clock,
    };
  }
  return {
    label: `Expires in ${Math.ceil(daysLeft)}d`,
    color: "gray",
    Icon: Clock,
  };
}

const styles: Record<ExpiryBucket["color"], string> = {
  gray: "bg-google-bg/80 border-google-border text-google-gray",
  yellow: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  red: "bg-red-500/10 border-red-500/30 text-red-400",
};

export const ExpiryChip: React.FC<ExpiryChipProps> = ({ expiresAt }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  const bucket = bucketFor(now, expiresAt);
  return (
    <div
      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${styles[bucket.color]}`}
    >
      <bucket.Icon size={11} />
      <span>{bucket.label}</span>
    </div>
  );
};
