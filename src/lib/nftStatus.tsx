import React from "react";

export type NftStatus = "available" | "limited" | "soldout" | "auction";

export const getNftStatus = (sold: number, total: number, hasAuction = false): NftStatus => {
  if (hasAuction) return "auction";
  const remaining = Math.max(0, total - sold);
  if (remaining <= 0) return "soldout";
  if (remaining <= 3 || (total > 0 && remaining / total <= 0.1)) return "limited";
  return "available";
};

export const statusMeta = (s: NftStatus) => {
  switch (s) {
    case "available":
      return { label: "Available", color: "#10B981", bg: "rgba(16,185,129,0.15)" };
    case "limited":
      return { label: "Limited", color: "#F59E0B", bg: "rgba(245,158,11,0.15)" };
    case "soldout":
      return { label: "Sold Out", color: "#EF4444", bg: "rgba(239,68,68,0.15)" };
    case "auction":
      return { label: "Live Auction", color: "hsl(217 91% 60%)", bg: "rgba(59,130,246,0.15)" };
  }
};

export const NftStatusBadge = ({
  sold,
  total,
  hasAuction,
  className = "",
}: {
  sold: number;
  total: number;
  hasAuction?: boolean;
  className?: string;
}) => {
  const status = getNftStatus(sold, total, hasAuction);
  const meta = statusMeta(status);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${className}`}
      style={{ color: meta.color, backgroundColor: meta.bg, borderColor: `${meta.color}40` }}
    >
      {meta.label}
    </span>
  );
};
