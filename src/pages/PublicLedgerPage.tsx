import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, RefreshCw, Search, ChevronDown, Settings, Globe, Check, X, Copy, Blocks } from "lucide-react";

import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";

type PublicLedgerEntry = {
  amount: number;
  note: string | null;
  status: string;
  occurred_at: string;
  event_type: string;
  currency_code?: string;
  sender_amount?: number;
  sender_currency_code?: string;
  receiver_amount?: number;
  receiver_currency_code?: string;
  payload?: any;
  sender_name?: string;
  sender_username?: string;
  sender_avatar?: string;
  receiver_name?: string;
  receiver_username?: string;
  receiver_avatar?: string;
};

const PAGE_SIZE = 30;
const PI_LOGO_URL = "https://i.ibb.co/jk8XtTPj/pi-network-pi-icons-pi-logo-design-illustration-trendy-and-modern-crypto-currency-pi-symbol-for-logo.png";
const USDT_FALLBACK_ICON_URL = "/icons/usdt.svg";
const USDC_FALLBACK_ICON_URL = "/icons/usdc.svg";

const categoryLabels: Record<string, string> = {
  all: "All Transactions",
  topup: "Top Up",
  withdraw: "Withdraw",
  swap: "Swap",
  nft: "NFT",
  staking: "Staking",
  loan: "Loan",
  affiliate: "Affiliate",
  mining: "Mining",
  other: "Other",
};

const categoryColors: Record<string, string> = {
  topup: "bg-green-600",
  withdraw: "bg-red-600",
  swap: "bg-purple-600",
  nft: "bg-pink-600",
  staking: "bg-yellow-600",
  loan: "bg-orange-600",
  affiliate: "bg-teal-600",
  mining: "bg-cyan-600",
  other: "bg-gray-600",
};
const PROVIDER_LOGOS: Record<string, string> = {
  "Pi Payment": PI_LOGO_URL,
  "Pi Wallet": PI_LOGO_URL,
  "Pi": PI_LOGO_URL,
  "PI": PI_LOGO_URL,
  "pi": PI_LOGO_URL,
  PayPal: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/PayPal.svg/1920px-PayPal.svg.png",
  "Ewallet QR PH": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/QR_Ph_Logo.svg/960px-QR_Ph_Logo.svg.png?20250310160234",
  "QR PH": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/QR_Ph_Logo.svg/960px-QR_Ph_Logo.svg.png?20250310160234",
  "QR": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/QR_Ph_Logo.svg/960px-QR_Ph_Logo.svg.png?20250310160234",
  "Apple Pay": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Apple_Pay_logo.svg/1920px-Apple_Pay_logo.svg.png",
  "Google Pay": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Google_Pay_Logo.svg/1920px-Google_Pay_Logo.svg.png",
  "Debit Card": "https://i.ibb.co/G3FGwngR/Visa-Inc-logo-2021-present-svg.png",
  "Credit Card": "https://i.ibb.co/9kkZmFDq/Mastercard-2019-logo-svg.png",
  "Visa": "https://i.ibb.co/G3FGwngR/Visa-Inc-logo-2021-present-svg.png",
  "Mastercard": "https://i.ibb.co/9kkZmFDq/Mastercard-2019-logo-svg.png",
  Stripe: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Stripe_Logo%2C_revised_2016.svg/1920px-Stripe_Logo%2C_revised_2016.svg.png",
  Venmo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Venmo_Logo.svg/1920px-Venmo_Logo.svg.png",
  "Bank Transfer": "https://i.ibb.co/6P6X9k2J/bank-transfer-icon.png",
  "Wire Transfer": "https://i.ibb.co/6P6X9k2J/bank-transfer-icon.png",
  "Cash": "https://i.ibb.co/3Rj2v1mL/cash-icon.png",
  "Check": "https://i.ibb.co/3Rj2v1mL/cash-icon.png",
  "Crypto": "https://i.ibb.co/jk8XtTPj/pi-network-pi-icons-pi-logo-design-illustration-trendy-and-modern-crypto-currency-pi-symbol-for-logo.png",
  "Bitcoin": "https://i.ibb.co/L8Q4b1fF/bitcoin-logo.png",
  "Ethereum": "https://i.ibb.co/68vQz2kK/ethereum-logo.png",
  "USDT": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Tether_Logo.svg/1920px-Tether_Logo.svg.png",
  "USDC": "https://upload.wikimedia.org/wikipedia/fr/1/18/Logo-USDC-2023.png",
  "MRWN": "https://i.ibb.co/tTZvkjmN/a078a5ec-3c63-4ec5-8ade-f270722deab5-1-removebg-preview.png",
  "Other": "https://i.ibb.co/3Rj2v1mL/cash-icon.png",
};
const isMissingPrivateLedgerRpcError = (message: string | undefined) =>
  Boolean(message) &&
  (message.includes("public.get_private_ledger_transaction")
    || message.includes("Could not find the function public.get_private_ledger_transaction"));

const redactLedgerNote = (note: string) =>
  note
    .replace(/@[\w.-]+/g, "@hidden")
    .replace(/OpenPay\s+[A-Za-z0-9_.-]+/g, "OpenPay [hidden]")
    .replace(/\bWallet\s+[A-Za-z0-9-]{6,}\b/g, "Wallet [hidden]")
    .replace(/\bOPEA[0-9A-Z]{6,}\b/g, "OPEA****")
    .replace(/\bOP[A-Z0-9]{6,}\b/g, (match) => `${match.slice(0, 4)}****`);

const PublicLedgerPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const transactionId = (searchParams.get("tx") || "").trim();
  const { currencies } = useCurrency();
  const [entries, setEntries] = useState<PublicLedgerEntry[]>([]);
  const [privateView, setPrivateView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [filteredEntries, setFilteredEntries] = useState<PublicLedgerEntry[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [useApi, setUseApi] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showApiDocs, setShowApiDocs] = useState(false);

  const getInitials = (name: string) => (name || "U").split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const getPiCodeLabel = (code: string) => {
    const upper = String(code || "").toUpperCase();
    if (upper === "PI") return "PI";
    if (upper === "OUSD") return "OPEN USD";
    return `PI ${upper}`;
  };

  const formatAmountWithCurrency = (amount: number, code: string) => {
    const upper = String(code || "OUSD").toUpperCase();
    const meta = currencies.find((currency) => currency.code === upper);
    const symbol = meta?.symbol || (upper === "PI" ? "Ãâ‚¬" : "$");
    const label = getPiCodeLabel(upper);
    const flag = meta?.flag || (upper === "PI" ? "PI" : "OP");
    return `${flag} ${label} ${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const renderProfile = (
    name?: string,
    avatar?: string,
    username?: string,
    amount?: number,
    currencyCode?: string
  ) => {
    if (!name && !username) return null;
    return (
      <div className="flex items-center gap-2">
        {avatar ? (
          <img src={avatar} alt={name} className="h-6 w-6 rounded-full object-cover border border-border/50" />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-muted-foreground border border-border/50">
            {getInitials(name || username || "?")}
          </div>
        )}
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold text-foreground leading-tight">
            {name || (username ? `@${username}` : "")}
          </span>
          {username && name && <span className="text-[9px] text-muted-foreground leading-tight">@{username}</span>}
          {Number.isFinite(amount) && currencyCode && (
            <span className="text-[9px] text-muted-foreground leading-tight">
              {formatAmountWithCurrency(Number(amount), currencyCode)}
            </span>
          )}
        </div>
      </div>
    );
  };

  const loadPage = async (nextOffset = 0) => {
    setLoading(true);
    try {
      const activeCategory = selectedCategory === "all" ? null : selectedCategory;
      const activeSearch = searchQuery.trim() || null;

      if (useApi && apiEndpoint) {
        // Load from public API endpoint (external integration mode)
        const url = new URL(apiEndpoint);
        url.searchParams.set("limit", String(PAGE_SIZE));
        url.searchParams.set("offset", String(nextOffset));
        if (activeCategory) url.searchParams.set("category", activeCategory);
        if (activeSearch) url.searchParams.set("search", activeSearch);

        const response = await fetch(url.toString());
        if (!response.ok) throw new Error(`API request failed: ${response.status}`);
        const result = await response.json();
        const rows = (result.data || []) as PublicLedgerEntry[];
        setEntries(rows);
        setOffset(nextOffset);
        setHasMore(rows.length === PAGE_SIZE);
      } else {
        // Server-side filtering via v2 RPC so category/search work across the full history
        const { data, error } = await supabase.rpc("get_public_ledger_v2" as any, {
          p_limit: PAGE_SIZE,
          p_offset: nextOffset,
          p_category: activeCategory,
          p_search: activeSearch,
        });

        if (error) throw new Error(error.message || "Failed to load ledger.");

        const rows = (data || []) as PublicLedgerEntry[];
        setEntries(rows);
        setOffset(nextOffset);
        setHasMore(rows.length === PAGE_SIZE);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load ledger.");
    } finally {
      setLoading(false);
    }
  };


  const getTransactionCategory = (entry: PublicLedgerEntry): string => {
    const evt = (entry.event_type || "").toLowerCase();
    
    if (evt.includes("topup") || evt.includes("deposit") || evt.includes("receive") || evt.includes("incoming")) {
      return "topup";
    }
    if (evt.includes("withdraw") || evt.includes("payout") || evt.includes("send") || evt.includes("outgoing") || evt.includes("payment")) {
      return "withdraw";
    }
    if (evt.includes("swap") || evt.includes("exchange") || evt.includes("convert")) {
      return "swap";
    }
    if (evt.includes("nft") || evt.includes("mint") || evt.includes("auction") || evt.includes("sale")) {
      return "nft";
    }
    if (evt.includes("stake") || evt.includes("staking")) {
      return "staking";
    }
    if (evt.includes("loan") || evt.includes("borrow")) {
      return "loan";
    }
    if (evt.includes("affiliate") || evt.includes("referral")) {
      return "affiliate";
    }
    if (evt.includes("mining") || evt.includes("reward")) {
      return "mining";
    }
    return "other";
  };

  const filterEntries = () => {
    let filtered = [...entries];
    
    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(entry => getTransactionCategory(entry) === selectedCategory);
    }
    
    // Filter by search query (username search)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(entry => {
        const senderUsername = entry.sender_username?.toLowerCase() || "";
        const receiverUsername = entry.receiver_username?.toLowerCase() || "";
        const senderName = entry.sender_name?.toLowerCase() || "";
        const receiverName = entry.receiver_name?.toLowerCase() || "";
        const note = entry.note?.toLowerCase() || "";
        
        return (
          senderUsername.includes(query) ||
          receiverUsername.includes(query) ||
          senderName.includes(query) ||
          receiverName.includes(query) ||
          note.includes(query)
        );
      });
    }
    
    setFilteredEntries(filtered);
  };

  // Local filtered view (kept for note redaction / hidden fields) — server already filtered.
  useEffect(() => {
    filterEntries();
  }, [entries]);

  // Reload from backend whenever the category or search filter changes so results
  // apply to the full ledger history, not just the currently loaded page.
  useEffect(() => {
    if (transactionId) return;
    const t = setTimeout(() => {
      void loadPage(0);
    }, searchQuery ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, searchQuery, useApi, apiEndpoint]);


  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showCategoryDropdown) {
        const target = event.target as HTMLElement;
        const dropdown = document.getElementById('category-dropdown');
        if (dropdown && !dropdown.contains(target)) {
          setShowCategoryDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCategoryDropdown]);

  const loadTransaction = async (txId: string) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id;
      setUserId(currentUserId || null);
      
      // Always use get_public_ledger_transaction to get transaction details
      let { data, error } = await supabase.rpc("get_public_ledger_transaction", { p_transaction_id: txId });

      if (error) throw new Error(error.message || "Failed to load ledger transaction.");
      const row = Array.isArray(data) ? data[0] : data;
      
      // If user is authenticated, check if this is their personal transaction
      let isUserTransaction = false;
      if (currentUserId && row) {
        const rowData = row as any; // Type assertion to access payload
        const senderId = rowData.payload?.sender_id;
        const receiverId = rowData.payload?.receiver_id;
        const actorId = rowData.payload?.actor_user_id;
        const relatedId = rowData.payload?.related_user_id;
        
        isUserTransaction = senderId === currentUserId || receiverId === currentUserId || actorId === currentUserId || relatedId === currentUserId;
      }
      
      setEntries(row ? [row as PublicLedgerEntry] : []);
      setPrivateView(Boolean(row) && Boolean(currentUserId) && isUserTransaction);
      setOffset(0);
      setHasMore(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load ledger transaction.");
      setEntries([]);
      setPrivateView(false);
      setOffset(0);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (transactionId) {
      void loadTransaction(transactionId);
      return;
    }
    void loadPage(0);
  }, [transactionId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-paypal-blue to-[#0073e6] px-4 py-8 text-white animate-fadeInUp">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 animate-slideInDown">
          <h1 className="text-3xl font-bold mb-2 animate-float">OpenLedger</h1>
          <p className="text-white/80">Transparent financial records for all transactions</p>
        </div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} aria-label="Back to home" className="hover-lift">
              <ArrowLeft className="h-6 w-6 text-foreground" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">OpenLedger</h1>
              <p className="text-xs text-white/80">
                {transactionId
                  ? `OpenLedger record for transaction ${transactionId.slice(0, 8)}...`
                  : "OpenLedger transaction history. User IDs are not shown."}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (loading) return;
              if (transactionId) {
                loadTransaction(transactionId);
              } else {
                loadPage(0);
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <a
            href="https://www.openpyledger.space/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center gap-2 rounded-full bg-white/15 hover:bg-white/25 px-3 text-sm font-semibold text-white transition-colors border border-white/30 backdrop-blur"
          >
            <Blocks className="h-4 w-4" />
            Blockchain
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="bg-white/10 hover:bg-white/20 flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold text-white transition-colors"
            title="API Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>

        {/* Search and Filter */}
        {!transactionId && (
          <div className="mb-6 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
              <input
                type="text"
                placeholder="Search by username or transaction details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Category Filter Dropdown */}
            <div className="relative" id="category-dropdown">
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
              >
                <span className="text-sm font-medium">
                  {selectedCategory === "all" ? "All Transactions" : categoryLabels[selectedCategory]}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showCategoryDropdown ? "rotate-180" : ""}`} />
              </button>

              {showCategoryDropdown && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                  {Object.entries(categoryLabels).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedCategory(key);
                        setShowCategoryDropdown(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                        selectedCategory === key
                          ? "bg-blue-600 text-white"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {filteredEntries.length === 0 && !loading ? (
        <p className="py-12 text-center text-muted-foreground">
          {searchQuery || selectedCategory !== "all" 
            ? "No transactions match your search or filter." 
            : "No ledger transactions yet."}
        </p>
      ) : (
        <div className="paypal-surface divide-y divide-border/70 rounded-3xl">
          {filteredEntries.map((row, index) => {
            const evt = (row.event_type || "").toLowerCase();
            const isTopup = evt.includes("topup") || evt.includes("deposit") || evt.includes("receive") || evt.includes("incoming");
            const isWithdraw = evt.includes("withdraw") || evt.includes("payout") || evt.includes("send") || evt.includes("outgoing") || evt.includes("payment");
            const paymentMethod = String(row.payload?.payment_method || row.payload?.provider || row.note || "").trim();
            const category = getTransactionCategory(row);
            
            // Enhanced logo detection with multiple fallback strategies
            const getProviderLogo = (method: string): string => {
              if (!method) return "";
              
              // Direct match first
              if (PROVIDER_LOGOS[method]) return PROVIDER_LOGOS[method];
              
              // Case insensitive match
              const upperMethod = method.toUpperCase();
              for (const [key, url] of Object.entries(PROVIDER_LOGOS)) {
                if (key.toUpperCase() === upperMethod) return url;
              }
              
              // Partial match for common variations
              if (upperMethod.includes("PI") || upperMethod.includes("PI NETWORK")) return PI_LOGO_URL;
              if (upperMethod.includes("PAYPAL")) return PROVIDER_LOGOS["PayPal"];
              if (upperMethod.includes("QR") || upperMethod.includes("EWALLET")) return PROVIDER_LOGOS["Ewallet QR PH"];
              if (upperMethod.includes("APPLE")) return PROVIDER_LOGOS["Apple Pay"];
              if (upperMethod.includes("GOOGLE")) return PROVIDER_LOGOS["Google Pay"];
              if (upperMethod.includes("VISA")) return PROVIDER_LOGOS["Visa"];
              if (upperMethod.includes("MASTERCARD")) return PROVIDER_LOGOS["Mastercard"];
              if (upperMethod.includes("STRIPE")) return PROVIDER_LOGOS["Stripe"];
              if (upperMethod.includes("VENMO")) return PROVIDER_LOGOS["Venmo"];
              if (upperMethod.includes("BANK") || upperMethod.includes("WIRE")) return PROVIDER_LOGOS["Bank Transfer"];
              if (upperMethod.includes("CASH") || upperMethod.includes("CHECK")) return PROVIDER_LOGOS["Cash"];
              if (upperMethod.includes("BITCOIN") || upperMethod.includes("BTC")) return PROVIDER_LOGOS["Bitcoin"];
              if (upperMethod.includes("ETHEREUM") || upperMethod.includes("ETH")) return PROVIDER_LOGOS["Ethereum"];
              if (upperMethod.includes("USDT") || upperMethod.includes("TETHER")) return PROVIDER_LOGOS["USDT"];
              if (upperMethod.includes("USDC")) return PROVIDER_LOGOS["USDC"];
              if (upperMethod.includes("CRYPTO")) return PROVIDER_LOGOS["Crypto"];
              
              return PROVIDER_LOGOS["Other"];
            };
            
            const providerLogo = getProviderLogo(paymentMethod);
            const noteHint = String(row.note || "").toLowerCase();
            const inferredPiLogo = (isTopup || isWithdraw) && (
              noteHint.includes("pi") || 
              noteHint.includes("wallet top up") ||
              noteHint.includes("pi payment") ||
              noteHint.includes("pi wallet") ||
              noteHint.includes("pi network")
            );
            const methodLogo =
              row.payload?.payment_method_logo ||
              row.payload?.logo_url ||
              providerLogo ||
              (row.payload?.pi_wallet_address ? PI_LOGO_URL : "") ||
              (inferredPiLogo ? PI_LOGO_URL : "");
            const upperMethodHint = String(paymentMethod || noteHint || "").toUpperCase();
            const methodFallbackLogo =
              upperMethodHint.includes("USDT") || upperMethodHint.includes("TETHER")
                ? USDT_FALLBACK_ICON_URL
                : upperMethodHint.includes("USDC")
                  ? USDC_FALLBACK_ICON_URL
                  : "";
            const currencyCode = String(row.currency_code || "OUSD").toUpperCase();
            const currencyMeta = currencies.find((currency) => currency.code === currencyCode);
            const currencyFlag = currencyMeta?.flag || (currencyCode === "PI" ? "PI" : "OP");
            const currencySymbol = currencyMeta?.symbol || (currencyCode === "PI" ? "Ï€" : "$");
            const currencyLabel = getPiCodeLabel(currencyCode);
            const senderCurrencyCode = String(row.sender_currency_code || row.payload?.sender_currency_code || currencyCode || "OUSD").toUpperCase();
            const receiverCurrencyCode = String(row.receiver_currency_code || row.payload?.receiver_currency_code || currencyCode || "OUSD").toUpperCase();
            const senderAmountRaw = row.sender_amount ?? row.payload?.sender_amount ?? row.amount;
            const receiverAmountRaw = row.receiver_amount ?? row.payload?.receiver_amount ?? row.amount;
            const senderAmountValue = Number(senderAmountRaw || 0);
            const receiverAmountValue = Number(receiverAmountRaw || 0);
            const senderMeta = currencies.find((currency) => currency.code === senderCurrencyCode);
            const receiverMeta = currencies.find((currency) => currency.code === receiverCurrencyCode);
            const senderSymbol = senderMeta?.symbol || (senderCurrencyCode === "PI" ? "Ï€" : "$");
            const receiverSymbol = receiverMeta?.symbol || (receiverCurrencyCode === "PI" ? "Ï€" : "$");
            const senderFlag = senderMeta?.flag || (senderCurrencyCode === "PI" ? "PI" : "OP");
            const receiverFlag = receiverMeta?.flag || (receiverCurrencyCode === "PI" ? "PI" : "OP");
            const senderLabel = getPiCodeLabel(senderCurrencyCode);
            const receiverLabel = getPiCodeLabel(receiverCurrencyCode);
            const showTransferAmounts = Number.isFinite(senderAmountValue) && Number.isFinite(receiverAmountValue);
            const currencyIcon = currencySymbol;
            const primaryName = row.receiver_name || row.sender_name || "";
            const primaryAvatar = row.receiver_avatar || row.sender_avatar || "";
            const primaryUsername = row.receiver_username || row.sender_username || "";
            const numericAmount = Number(row.amount ?? receiverAmountValue ?? senderAmountValue ?? 0);
            const displayAmountValue = Number.isFinite(receiverAmountValue)
              ? receiverAmountValue
              : Number.isFinite(senderAmountValue)
                ? senderAmountValue
                : numericAmount;
            const displayCurrencySymbol = Number.isFinite(receiverAmountValue)
              ? receiverSymbol
              : Number.isFinite(senderAmountValue)
                ? senderSymbol
                : currencySymbol;
            const amountClass =
              numericAmount > 0
                ? "text-green-600"
                : numericAmount < 0
                  ? "text-red-600"
                  : isTopup
                    ? "text-green-600"
                    : isWithdraw
                      ? "text-red-600"
                      : "text-foreground";
            
            return (
              <div key={`${row.occurred_at}-${index}`} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {(isTopup || isWithdraw) && methodLogo ? (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/50 overflow-hidden border border-border/50">
                      <img
                        src={methodLogo}
                        alt="Method"
                        className="h-6 w-6 object-contain"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          if (!methodFallbackLogo) return;
                          e.currentTarget.src = methodFallbackLogo;
                        }}
                      />
                    </div>
                  ) : (
                    primaryName || primaryUsername ? (
                      primaryAvatar ? (
                        <img src={primaryAvatar} alt={primaryName || primaryUsername} className="h-10 w-10 shrink-0 rounded-full object-cover border border-border/50" />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-muted-foreground border border-border/50">
                          {getInitials(primaryName || primaryUsername || "?")}
                        </div>
                      )
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paypal-blue/10 text-paypal-blue font-bold">
                        {currencyIcon}
                      </div>
                    )
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">{categoryLabels[category] || "Transaction"}</p>
                      <span className={`rounded-md ${categoryColors[category] || categoryColors.other} px-1.5 py-0.5 text-[10px] font-bold text-white uppercase`}>
                        {category}
                      </span>
                      {currencyCode && (
                        <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground uppercase">
                          {currencyFlag} {currencyLabel}
                        </span>
                      )}
                      {(row.sender_name || row.sender_username || row.receiver_name || row.receiver_username) && (
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          • {(row.sender_name || row.sender_username || "Sender")}
                          {" → "}
                          {(row.receiver_name || row.receiver_username || "Receiver")}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(row.occurred_at), "MMM d, yyyy HH:mm")} • {(row.event_type || "").replace(/_/g, " ")}
                    </p>
                    {showTransferAmounts && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Sender: {senderFlag} {senderLabel} {senderSymbol}{senderAmountValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} → Receiver: {receiverFlag} {receiverLabel} {receiverSymbol}{receiverAmountValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    )}
                    
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {(row.sender_name || row.sender_username) && renderProfile(
                        row.sender_name,
                        row.sender_avatar,
                        row.sender_username,
                        senderAmountValue,
                        senderCurrencyCode
                      )}
                      {(row.sender_name || row.sender_username) && (row.receiver_name || row.receiver_username) && (
                        <span className="text-muted-foreground text-[10px]">→</span>
                      )}
                      {(row.receiver_name || row.receiver_username) && renderProfile(
                        row.receiver_name,
                        row.receiver_avatar,
                        row.receiver_username,
                        receiverAmountValue,
                        receiverCurrencyCode
                      )}
                    </div>

                    {row.note && (
                      <p className="text-[11px] text-muted-foreground mt-1.5 italic line-clamp-2">
                        {privateView ? row.note : redactLedgerNote(row.note)}
                      </p>
                    )}
                    {row.note && row.note.includes('Platform fee') && (
                      <p className="text-[10px] text-blue-600 font-medium mt-1">
                        📋 Platform Fee Transaction
                      </p>
                    )}
                    <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mt-1">
                      Status: <span className={row.status === "completed" ? "text-green-600" : "text-amber-600"}>{row.status || "unknown"}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right sm:ml-4">
                  <p className={`font-bold ${amountClass}`}>
                    {displayCurrencySymbol}{displayAmountValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">{categoryLabels[category] || "Transaction"}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          className="paypal-surface h-9 rounded-full px-4 text-sm font-semibold text-foreground disabled:opacity-50"
          onClick={() => loadPage(Math.max(0, offset - PAGE_SIZE))}
          disabled={loading || offset === 0 || !!transactionId}
        >
          Previous
        </button>
        <button
          className="paypal-surface h-9 rounded-full px-4 text-sm font-semibold text-foreground disabled:opacity-50"
          onClick={() => loadPage(offset + PAGE_SIZE)}
          disabled={loading || !hasMore || !!transactionId}
        >
          Next
        </button>
      </div>

      {/* API Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full text-gray-900">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Settings className="h-5 w-5" />
                API Settings
              </h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Use Public API</p>
                  <p className="text-sm text-gray-500">Load data from external OpenLedger API</p>
                </div>
                <button
                  onClick={() => setUseApi(!useApi)}
                  className={`w-12 h-6 rounded-full transition-colors ${useApi ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${useApi ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {useApi && (
                <div>
                  <label className="block text-sm font-medium mb-2">API Endpoint</label>
                  <input
                    type="text"
                    value={apiEndpoint}
                    onChange={(e) => setApiEndpoint(e.target.value)}
                    placeholder={`${LEDGER_API_BASE}/public`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-gray-500">Point at any OpenLedger-compatible /public endpoint.</span>
                    <button
                      type="button"
                      onClick={() => setApiEndpoint(`${LEDGER_API_BASE}/public`)}
                      className="font-semibold text-blue-600 hover:underline"
                    >
                      Use OpenPay
                    </button>
                  </div>
                </div>
              )}


              <button
                onClick={() => setShowApiDocs(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                <Globe className="h-4 w-4" />
                View API Documentation
              </button>

              <button
                onClick={() => {
                  setShowSettings(false);
                  loadPage(0);
                }}
                className="w-full px-4 py-2 bg-gray-200 text-gray-900 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Save & Reload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Documentation Modal */}
      {showApiDocs && <ApiDocsModal onClose={() => setShowApiDocs(false)} />}

    </div>
  );
};

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  "https://your-project.supabase.co";
const LEDGER_API_BASE = `${SUPABASE_URL}/functions/v1/ledger-api`;

const CopyBlock = ({ code, language = "" }: { code: string; language?: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="relative group">
      <pre className="bg-gray-900 text-green-300 p-4 pr-12 rounded-lg overflow-x-auto text-xs leading-relaxed whitespace-pre-wrap break-all">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/20"
        aria-label="Copy"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
      {language && (
        <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider text-white/40">
          {language}
        </span>
      )}
    </div>
  );
};

const ApiDocsModal = ({ onClose }: { onClose: () => void }) => {
  const publicUrl = `${LEDGER_API_BASE}/public?limit=50&category=topup`;
  const statsUrl = `${LEDGER_API_BASE}/stats`;
  const txUrl = `${LEDGER_API_BASE}/transactions`;
  const eventsUrl = `${LEDGER_API_BASE}/events`;

  const jsSnippet = useMemo(
    () => `// 1. Public ledger — no auth. Use this to mirror OpenPay activity into any external ledger.
const res = await fetch("${LEDGER_API_BASE}/public?limit=100");
const { data, next_cursor } = await res.json();

// 2. Follow the cursor to keep syncing new events
if (next_cursor) {
  const more = await fetch(\`${LEDGER_API_BASE}/public?limit=100&cursor=\${encodeURIComponent(next_cursor)}\`);
}

// 3. Filter by category (topup | withdraw | swap | nft | staking | loan | affiliate | mining | other)
await fetch("${LEDGER_API_BASE}/public?category=nft&limit=50");

// 4. Free-text search across notes / event types / usernames
await fetch("${LEDGER_API_BASE}/public?search=alice&limit=50");

// 5. Incremental sync — only events after a given ISO timestamp
await fetch(\`${LEDGER_API_BASE}/public?since=\${new Date(Date.now()-3600e3).toISOString()}\`);

// 6. User-scoped transactions (needs an API key — create one at /developers/ledger)
await fetch("${LEDGER_API_BASE}/transactions", {
  headers: { Authorization: "Bearer opk_live_your_api_key_here" },
});`,
    [],
  );

  const curlSnippet = useMemo(
    () => `# Mirror the entire OpenPay ledger into your system (public, no auth)
curl -s "${LEDGER_API_BASE}/public?limit=100"

# Aggregate stats (total events, per-category counts, total volume)
curl -s "${LEDGER_API_BASE}/stats"

# User-scoped stream (authenticated with an OpenLedger API key)
curl -s "${LEDGER_API_BASE}/transactions" \\
  -H "Authorization: Bearer opk_live_your_api_key_here"`,
    [],
  );

  const pythonSnippet = useMemo(
    () => `import requests

BASE = "${LEDGER_API_BASE}"

def sync_openpay_to_other_ledger(cursor=None):
    params = {"limit": 100}
    if cursor:
        params["cursor"] = cursor
    r = requests.get(f"{BASE}/public", params=params, timeout=30)
    r.raise_for_status()
    body = r.json()
    for event in body["data"]:
        # forward each event to your own ledger here
        my_ledger.insert(event)
    return body.get("next_cursor")`,
    [],
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-3xl w-full text-gray-900 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Globe className="h-5 w-5" />
            OpenLedger API — Integration Guide
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 text-sm">
          <div>
            <h3 className="font-bold text-base mb-1">Overview</h3>
            <p className="text-gray-600">
              A public, cursor-paginated feed of every OpenPay transaction (transfers, top-ups,
              withdrawals, NFT sales, mining rewards, staking, loans, affiliate payouts, QR pay,
              invoices, merchant payments). Use it to mirror OpenPay activity into your own ledger,
              analytics stack, or compliance system.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-base mb-2">Base URL</h3>
            <CopyBlock code={LEDGER_API_BASE} />
          </div>

          <div>
            <h3 className="font-bold text-base mb-2">Public endpoints (no auth)</h3>
            <div className="space-y-2">
              <EndpointRow method="GET" path="/public" desc="List ledger events, newest first." params="limit (max 200), cursor (ISO occurred_at), since (ISO), category, search, offset" />
              <EndpointRow method="GET" path="/stats" desc="Total event count, total volume, per-category counts." />
            </div>
          </div>

          <div>
            <h3 className="font-bold text-base mb-2">Authenticated endpoints (Bearer API key)</h3>
            <div className="space-y-2">
              <EndpointRow method="GET" path="/transactions" desc="User-scoped transactions." />
              <EndpointRow method="GET" path="/transactions/:id" desc="Fetch one transaction by id." />
              <EndpointRow method="GET" path="/events" desc="User-scoped ledger events." />
              <EndpointRow method="POST" path="/webhooks" desc="Register a URL to receive new ledger events." />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Create API keys at <code className="bg-gray-100 px-1 rounded">/developers/ledger</code>.
              Keys start with <code className="bg-gray-100 px-1 rounded">opk_live_</code>.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-base mb-2">Copy & paste — JavaScript</h3>
            <CopyBlock code={jsSnippet} language="javascript" />
          </div>

          <div>
            <h3 className="font-bold text-base mb-2">Copy & paste — cURL</h3>
            <CopyBlock code={curlSnippet} language="bash" />
          </div>

          <div>
            <h3 className="font-bold text-base mb-2">Copy & paste — Python (sync every OpenPay event into your ledger)</h3>
            <CopyBlock code={pythonSnippet} language="python" />
          </div>

          <div>
            <h3 className="font-bold text-base mb-2">Live example URLs</h3>
            <div className="space-y-2">
              <CopyBlock code={publicUrl} />
              <CopyBlock code={statsUrl} />
              <CopyBlock code={txUrl} />
              <CopyBlock code={eventsUrl} />
            </div>
          </div>

          <div>
            <h3 className="font-bold text-base mb-2">Event schema</h3>
            <CopyBlock
              code={`{
  "id": "uuid",
  "source_table": "transactions | nft_transactions | mining_rewards | ...",
  "event_type": "transaction_created | nft_primary_sale | ...",
  "category": "topup | withdraw | swap | nft | staking | loan | affiliate | mining | other",
  "amount": 12.34,
  "currency_code": "OUSD | PI | USDT | ...",
  "status": "completed | pending | failed",
  "note": "redacted string",
  "sender": { "name": "...", "username": "...", "avatar": "..." },
  "receiver": { "name": "...", "username": "...", "avatar": "..." },
  "occurred_at": "2026-07-08T00:00:00Z"
}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const EndpointRow = ({ method, path, desc, params }: { method: string; path: string; desc: string; params?: string }) => (
  <div className="bg-gray-50 p-3 rounded-lg">
    <div className="flex items-center gap-2">
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${method === "GET" ? "bg-green-600 text-white" : "bg-blue-600 text-white"}`}>
        {method}
      </span>
      <code className="font-mono text-sm font-semibold">{path}</code>
    </div>
    <p className="text-xs text-gray-600 mt-1">{desc}</p>
    {params && <p className="text-[11px] text-gray-500 mt-1">Params: {params}</p>}
  </div>
);

export default PublicLedgerPage;

