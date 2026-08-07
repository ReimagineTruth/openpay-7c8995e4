import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  ExternalLink,
  Layers,
  Pickaxe,
  PiggyBank,
  RefreshCw,
  Store,
  Wallet,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { usePiUsdPrice, PI_TOKEN } from "@/lib/piPrice";
import { OUSD_TOKEN } from "@/lib/ousdPrice";
import {
  OPENPAY_PRO_APP_URL,
  OPENPAY_PRO_WALLET_URL,
  collectiblesToAssets,
  fetchUserCollectibles,
  proAssetLogo,
  type TrackedAsset,
} from "@/lib/openpayProAssets";
import { PRO_PAY_ASSETS } from "@/lib/openpayProTransfer";
import { cn } from "@/lib/utils";

export type AssetsBalances = {
  walletOusd: number;
  savingsOusd: number;
  miningOusd: number;
  merchantOusd?: number;
};

type AssetsSectionProps = {
  username?: string | null;
  balances: AssetsBalances;
  balanceHidden?: boolean;
};

type TokenRow = {
  id: string;
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
  logoUrl: string;
  badge: string;
  badgeClass: string;
  hint: string;
  onClick?: () => void;
};

const formatAmt = (n: number, hidden?: boolean, digits = 2) => {
  if (hidden) return "••••";
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const AssetsSection = ({
  username,
  balances,
  balanceHidden = false,
}: AssetsSectionProps) => {
  const navigate = useNavigate();
  const piPrice = usePiUsdPrice(30_000);
  const [loadingNfts, setLoadingNfts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nfts, setNfts] = useState<TrackedAsset[]>([]);

  const piUsd = piPrice.price > 0 ? piPrice.price : 0;
  const walletOusd = Number(balances.walletOusd) || 0;
  const savingsOusd = Number(balances.savingsOusd) || 0;
  const miningOusd = Number(balances.miningOusd) || 0;
  const merchantOusd = Number(balances.merchantOusd) || 0;
  const walletPi = piUsd > 0 ? walletOusd / piUsd : 0;

  const loadNfts = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoadingNfts(true);
    try {
      const rows = username ? await fetchUserCollectibles(username) : [];
      setNfts(collectiblesToAssets(rows));
    } finally {
      setLoadingNfts(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadNfts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const tokens: TokenRow[] = useMemo(() => {
    const rows: TokenRow[] = [
      {
        id: "ousd-wallet",
        symbol: "OUSD",
        name: "OpenUSD",
        balance: walletOusd,
        usdValue: walletOusd,
        logoUrl: OUSD_TOKEN.logoUrl,
        badge: "Wallet",
        badgeClass: "bg-[#007AFF]/12 text-[#007AFF]",
        hint: "Available balance",
        onClick: () => navigate("/dashboard"),
      },
      {
        id: "pi-equiv",
        symbol: "PI",
        name: "Pi Network",
        balance: walletPi,
        usdValue: walletOusd,
        logoUrl: PI_TOKEN.logo,
        badge: "Equiv.",
        badgeClass: "bg-[#5856D6]/12 text-[#5856D6]",
        hint: piUsd > 0
          ? `1 PI = $${piUsd.toFixed(4)}${piPrice.isFallback ? " (est.)" : ""}`
          : "Live PI rate unavailable",
        onClick: () => navigate("/dashboard"),
      },
      {
        id: "ousd-savings",
        symbol: "OUSD",
        name: "Savings",
        balance: savingsOusd,
        usdValue: savingsOusd,
        logoUrl: OUSD_TOKEN.logoUrl,
        badge: "Earn",
        badgeClass: "bg-[#34C759]/15 text-[#248A3D]",
        hint: "Savings balance",
        onClick: () => navigate("/dashboard"),
      },
      {
        id: "ousd-mining",
        symbol: "OUSD",
        name: "Mining rewards",
        balance: miningOusd,
        usdValue: miningOusd,
        logoUrl: OUSD_TOKEN.logoUrl,
        badge: "Mine",
        badgeClass: "bg-[#FF9500]/15 text-[#C93400]",
        hint: "Claimable mining balance",
        onClick: () => navigate("/mining"),
      },
    ];

    if (merchantOusd > 0) {
      rows.push({
        id: "ousd-merchant",
        symbol: "OUSD",
        name: "Merchant",
        balance: merchantOusd,
        usdValue: merchantOusd,
        logoUrl: OUSD_TOKEN.logoUrl,
        badge: "Biz",
        badgeClass: "bg-[#1d1d1f] text-white",
        hint: "Merchant available balance",
        onClick: () => navigate("/dashboard"),
      });
    }

    return rows;
  }, [walletOusd, walletPi, savingsOusd, miningOusd, merchantOusd, piUsd, piPrice.isFallback, navigate]);

  const totalUsd = walletOusd + savingsOusd + miningOusd + merchantOusd;

  return (
    <div className="mx-4 mt-4 space-y-4">
      {/* Total */}
      <div className="dash-panel">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Token balances
            </p>
            <p className="mt-1 text-3xl font-bold tracking-[-0.03em] text-foreground">
              {balanceHidden ? "••••••" : `$${formatAmt(totalUsd, false)}`}
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {tokens.length} balances
              {username ? ` · @${username}` : ""}
              {piUsd > 0 ? ` · PI $${piUsd.toFixed(4)}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadNfts(true)}
            disabled={refreshing}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f2f2f7] text-[#007AFF] disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            className="h-11 rounded-2xl bg-[#007AFF] text-[15px] font-semibold text-white hover:bg-[#0066d6]"
            onClick={() => window.open(OPENPAY_PRO_WALLET_URL, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="mr-1.5 h-4 w-4" />
            Pro Wallet
          </Button>
          <Button
            variant="secondary"
            className="h-11 rounded-2xl text-[15px] font-semibold"
            onClick={() => navigate("/send/pro")}
          >
            <ArrowUpRight className="mr-1.5 h-4 w-4" />
            Send to Pro
          </Button>
        </div>
      </div>

      {/* Real token balances */}
      <div className="dash-panel">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#007AFF]/10">
            <Wallet className="h-4 w-4 text-[#007AFF]" />
          </span>
          <div>
            <h3 className="text-[15px] font-bold text-foreground">Your tokens</h3>
            <p className="text-[11px] text-muted-foreground">Live OpenPay balances</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-[#f2f2f7]">
          {tokens.map((token, i) => (
            <button
              key={token.id}
              type="button"
              onClick={token.onClick}
              className={cn(
                "flex w-full items-center gap-3 px-3.5 py-3.5 text-left transition-colors active:bg-black/[0.04] hover:bg-white/70",
                i > 0 && "border-t border-black/[0.04]",
              )}
            >
              <img
                src={token.logoUrl}
                alt=""
                className="h-11 w-11 rounded-full object-cover ring-1 ring-black/5"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[15px] font-semibold text-[#1d1d1f]">{token.name}</p>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                      token.badgeClass,
                    )}
                  >
                    {token.badge}
                  </span>
                </div>
                <p className="truncate text-[12px] text-[#8e8e93]">{token.hint}</p>
              </div>
              <div className="text-right">
                <p className="text-[16px] font-bold tabular-nums text-[#1d1d1f]">
                  {formatAmt(token.balance, balanceHidden, token.symbol === "PI" ? 4 : 2)}{" "}
                  <span className="text-[12px] font-semibold text-[#8e8e93]">{token.symbol}</span>
                </p>
                <p className="text-[12px] tabular-nums text-[#8e8e93]">
                  {balanceHidden ? "••••" : `$${formatAmt(token.usdValue, false)}`}
                </p>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-[#f2f2f7] px-3 py-2.5 text-center">
            <PiggyBank className="mx-auto h-4 w-4 text-[#34C759]" />
            <p className="mt-1 text-[10px] font-semibold text-[#8e8e93]">Savings</p>
            <p className="text-[13px] font-bold tabular-nums text-[#1d1d1f]">
              {formatAmt(savingsOusd, balanceHidden)}
            </p>
          </div>
          <div className="rounded-2xl bg-[#f2f2f7] px-3 py-2.5 text-center">
            <Pickaxe className="mx-auto h-4 w-4 text-[#FF9500]" />
            <p className="mt-1 text-[10px] font-semibold text-[#8e8e93]">Mining</p>
            <p className="text-[13px] font-bold tabular-nums text-[#1d1d1f]">
              {formatAmt(miningOusd, balanceHidden)}
            </p>
          </div>
          <div className="rounded-2xl bg-[#f2f2f7] px-3 py-2.5 text-center">
            <Store className="mx-auto h-4 w-4 text-[#007AFF]" />
            <p className="mt-1 text-[10px] font-semibold text-[#8e8e93]">Merchant</p>
            <p className="text-[13px] font-bold tabular-nums text-[#1d1d1f]">
              {formatAmt(merchantOusd, balanceHidden)}
            </p>
          </div>
        </div>
      </div>

      {/* OpenPay Pro assets (open wallet to see on-chain balances) */}
      <div className="dash-panel">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1d1d1f]">
              <BrandLogo variant="white" animate={false} className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-[15px] font-bold text-foreground">OpenPay Pro assets</h3>
              <p className="text-[11px] text-muted-foreground">
                Self-custody balances live in Pro wallet
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-[#f2f2f7]">
          {PRO_PAY_ASSETS.map((a, i) => (
            <button
              key={a.key}
              type="button"
              onClick={() => window.open(OPENPAY_PRO_WALLET_URL, "_blank", "noopener,noreferrer")}
              className={cn(
                "flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors active:bg-black/[0.04] hover:bg-white/70",
                i > 0 && "border-t border-black/[0.04]",
              )}
            >
              <img
                src={proAssetLogo(a.key)}
                alt=""
                className="h-10 w-10 rounded-full object-cover ring-1 ring-black/5"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-[#1d1d1f]">{a.label}</p>
                <p className="truncate text-[11px] text-[#8e8e93]">{a.hint}</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#1d1d1f] px-2.5 py-1 text-[11px] font-semibold text-white">
                View balance
                <ExternalLink className="h-3 w-3" />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* NFT quantities */}
      <div className="dash-panel">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#5856D6]/12">
              <Layers className="h-4 w-4 text-[#5856D6]" />
            </span>
            <div>
              <h3 className="text-[15px] font-bold text-foreground">NFT balances</h3>
              <p className="text-[11px] text-muted-foreground">OpenNFT holdings</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/web3/nft")}
            className="text-[12px] font-semibold text-[#007AFF]"
          >
            Marketplace
          </button>
        </div>

        {loadingNfts ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-[#f2f2f7]" />
            ))}
          </div>
        ) : nfts.length === 0 ? (
          <div className="rounded-2xl bg-[#f2f2f7] px-4 py-5 text-center text-[13px] text-[#8e8e93]">
            No NFT balances yet
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-[#f2f2f7]">
            {nfts.map((nft, i) => (
              <button
                key={nft.id}
                type="button"
                onClick={() => {
                  if (nft.href?.startsWith("http")) {
                    window.open(nft.href, "_blank", "noopener,noreferrer");
                  } else {
                    navigate(nft.href || "/web3/nft");
                  }
                }}
                className={cn(
                  "flex w-full items-center gap-3 px-3.5 py-3 text-left",
                  i > 0 && "border-t border-black/[0.04]",
                )}
              >
                {nft.logoUrl ? (
                  <img src={nft.logoUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">
                    <BrandLogo className="h-5 w-5 text-[#007AFF]" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-[#1d1d1f]">{nft.name}</p>
                  <p className="text-[11px] text-[#8e8e93]">Collectible</p>
                </div>
                <p className="text-[15px] font-bold tabular-nums text-[#1d1d1f]">
                  ×{formatAmt(Number(nft.balance || 0), balanceHidden, 0)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pb-2 text-center">
        <a
          href={OPENPAY_PRO_APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#007AFF]"
        >
          Open OpenPay Pro for on-chain token balances
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
};

export default AssetsSection;
