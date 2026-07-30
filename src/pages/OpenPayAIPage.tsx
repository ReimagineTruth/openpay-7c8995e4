import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, TrendingUp, AlertTriangle, Wallet, PieChart, Shield, CreditCard, ArrowLeftRight, Users, Store, FileText, History, Coins, Pickaxe, TrendingDown, Clock, Target, Zap, Bell, Calendar, Award, AlertCircle, CheckCircle, Info, ChevronUp, ChevronDown, Brain, Lightbulb, ChevronDown as ChevronIcon, Menu as MenuIcon, MessageCircle, Plus, PanelLeft, X, SquarePen, ArrowLeft, BarChart3, Sun, Moon, Volume2, Square, Settings, Plug } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getStoredAppTheme, persistAndApplyAppTheme, type AppThemeMode } from "@/lib/appTheme";
import { applyStoredSpeechVoice, getStoredAiSpeechVoiceUri, loadSpeechVoices, previewSpeechVoice, setStoredAiSpeechVoiceUri, toSpeechVoiceOptions, type AiSpeechVoiceOption } from "@/lib/aiSpeechVoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import McpConnectionsDialog from "@/components/ai/McpConnectionsDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import BrandLogo from "@/components/BrandLogo";
import AuthMark from "@/components/AuthMark";
import AiTransferReceipt, { type AiReceiptData } from "@/components/AiTransferReceipt";
import { isKycVerified, kycStatusLabel } from "@/lib/kyc";
import {
  formatPartnerRecipient,
  partnerGetBalance,
  partnerLookupAccount,
  partnerSendTransfer,
} from "@/lib/partnerTransferClient";

// AI calls go through the openpay-ai-chat edge function (Lovable AI Gateway)

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  type?: "text" | "insight" | "payment" | "alert" | "receipt";
  receipt?: AiReceiptData;
};

type SpendingCategory = {
  name: string;
  amount: number;
  percentage: number;
  color: string;
};

type BudgetAlert = {
  category: string;
  spent: number;
  limit: number;
  percentage: number;
};

type FinancialInsight = {
  type: "balance" | "spending" | "budget" | "prediction" | "alert" | "goal" | "recommendation";
  title: string;
  description: string;
  value?: string;
  trend?: "up" | "down" | "stable";
  priority?: "low" | "medium" | "high";
  actionable?: boolean;
  action?: string;
};

type UserProfile = {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url?: string | null;
  account_number: string;
  referral_code: string;
  kyc_status: "pending" | "verified" | "rejected";
  created_at: string;
  last_login: string;
};

type BalancePrediction = {
  current_balance: number;
  predicted_7_days: number;
  predicted_30_days: number;
  spending_velocity: number;
  days_until_zero: number;
  confidence: number;
};

type SmartRecommendation = {
  id: string;
  type: "topup" | "saving" | "investment" | "security" | "feature";
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  actionable: boolean;
  action_text: string;
  estimated_impact?: string;
  route?: string;
  prompt?: string;
};

/** Repair UTF-8 text that was mis-decoded as Windows-1252 (mojibake). */
const fixMojibakeText = (input: string): string => {
  if (!input || !/[âðïÃ]/.test(input)) return input;

  const replacements: Record<string, string> = {
    "â€¢": "•",
    "â€”": "—",
    "â€“": "–",
    "â€˜": "‘",
    "â€™": "’",
    "â€œ": "“",
    "â€": "”",
    "âš ï¸": "⚠️",
    "âš ": "⚠",
    "ï¸": "️",
    "âœ…": "✅",
    "âŒ": "❌",
    "ðŸš€": "🚀",
    "ðŸ’¡": "💡",
    "ðŸ“‹": "📋",
    "ðŸ’°": "💰",
    "ðŸŽ¯": "🎯",
    "ðŸ’¸": "💸",
    "ðŸ¤–": "🤖",
    "ðŸ”®": "🔮",
    "ðŸ””": "🔔",
    "ðŸ“Š": "📊",
    "ðŸ”": "🔐",
    "ðŸ’³": "💳",
    "ðŸ”´": "🔴",
    "ðŸŸ¡": "🟡",
    "ðŸŸ¢": "🟢",
    "ðŸŸ ": "🟠",
    "ðŸ’¬": "💬",
    "ðŸ“": "📝",
    "ðŸ’¾": "💾",
    "â³": "⏳",
  };

  let out = input;
  for (const [bad, good] of Object.entries(replacements)) {
    if (out.includes(bad)) out = out.split(bad).join(good);
  }
  return out;
};

/** Plain text suitable for browser speech synthesis. */
const stripMarkdownForSpeech = (md: string): string => {
  let text = fixMojibakeText(md || "");
  text = text.replace(/```[\s\S]*?```/g, " ");
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/!\[[^\]]*]\([^)]+\)/g, " ");
  text = text.replace(/\[([^\]]+)]\([^)]+\)/g, "$1");
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2");
  text = text.replace(/(\*|_)(.*?)\1/g, "$2");
  text = text.replace(/^>\s+/gm, "");
  text = text.replace(/^[-*+]\s+/gm, "");
  text = text.replace(/^\d+\.\s+/gm, "");
  text = text.replace(/[💳💰🚀💡📋🎯💸🤖🔮🔔📊🔐🔴🟡🟢🟠💬📝💾⏳⚠️✅❌•]/gu, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text;
};

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Lightweight markdown for AI chat replies (bold, lists, headings, breaks). */
const renderChatMarkdown = (md: string) => {
  const text = fixMojibakeText(md);
  const lines = text.split("\n");
  const out: JSX.Element[] = [];
  let listBuffer: string[] = [];

  const inline = (s: string) =>
    escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(
        /`([^`]+)`/g,
        '<code class="rounded bg-black/5 px-1.5 py-0.5 font-ai-sans text-[0.86em] dark:bg-white/10">$1</code>'
      );

  const flushList = () => {
    if (!listBuffer.length) return;
    out.push(
      <ul
        key={`ul-${out.length}`}
        className="my-2.5 list-disc space-y-1.5 pl-5 font-ai-serif text-[16.5px] leading-[1.7] text-foreground"
      >
        {listBuffer.map((li, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: inline(li) }} />
        ))}
      </ul>
    );
    listBuffer = [];
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (/^#{3}\s+/.test(line)) {
      flushList();
      out.push(
        <h3
          key={i}
          className="mb-1.5 mt-4 font-ai-serif text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground"
          dangerouslySetInnerHTML={{ __html: inline(line.replace(/^#{3}\s+/, "")) }}
        />
      );
      return;
    }
    if (/^#{2}\s+/.test(line)) {
      flushList();
      out.push(
        <h2
          key={i}
          className="mb-2 mt-5 font-ai-serif text-[1.25rem] font-semibold tracking-[-0.015em] text-foreground"
          dangerouslySetInnerHTML={{ __html: inline(line.replace(/^#{2}\s+/, "")) }}
        />
      );
      return;
    }
    if (/^#\s+/.test(line)) {
      flushList();
      out.push(
        <h1
          key={i}
          className="mb-2.5 mt-5 font-ai-serif text-[1.45rem] font-semibold tracking-[-0.02em] text-foreground"
          dangerouslySetInnerHTML={{ __html: inline(line.replace(/^#\s+/, "")) }}
        />
      );
      return;
    }
    if (/^[-*•]\s+/.test(line)) {
      listBuffer.push(line.replace(/^[-*•]\s+/, ""));
      return;
    }
    if (!line.trim()) {
      flushList();
      return;
    }
    flushList();
    out.push(
      <p
        key={i}
        className="my-2 font-ai-serif text-[16.5px] leading-[1.7] text-foreground"
        dangerouslySetInnerHTML={{ __html: inline(line) }}
      />
    );
  });
  flushList();
  return out;
};

const OpenPayAIPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [userBalance, setUserBalance] = useState(0);
  const [spendingCategories, setSpendingCategories] = useState<SpendingCategory[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([]);
  const [insights, setInsights] = useState<FinancialInsight[]>([]);
  const [pendingPayment, setPendingPayment] = useState<any>(null);
  const [pendingSendRecipient, setPendingSendRecipient] = useState<string | null>(null);
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [balancePrediction, setBalancePrediction] = useState<BalancePrediction | null>(null);
  const [recommendations, setRecommendations] = useState<SmartRecommendation[]>([]);
  const [greeting, setGreeting] = useState<string>("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [pageActive, setPageActive] = useState(true);
  const [userInteracted, setUserInteracted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showInsightsPanel, setShowInsightsPanel] = useState(false);
  const [themeMode, setThemeMode] = useState<AppThemeMode>(() => getStoredAppTheme());
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [showMcpDialog, setShowMcpDialog] = useState(false);
  const [speechVoiceUri, setSpeechVoiceUri] = useState(getStoredAiSpeechVoiceUri());
  const [speechVoices, setSpeechVoices] = useState<AiSpeechVoiceOption[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const speechSupported =
    typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";

  const isDarkTheme = themeMode === "dark";

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMessageId(null);
  };

  const speakMessage = (messageId: string, content: string) => {
    if (!speechSupported) {
      toast.error("Text to speech is not supported in this browser");
      return;
    }

    if (speakingMessageId === messageId) {
      stopSpeaking();
      return;
    }

    const plain = stripMarkdownForSpeech(content);
    if (!plain) {
      toast.error("Nothing to read in this message");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(plain);
    utterance.rate = 1;
    utterance.pitch = 1;
    applyStoredSpeechVoice(utterance);
    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);
    setSpeakingMessageId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  const handleChangeSpeechVoice = (voiceUri: string) => {
    setSpeechVoiceUri(voiceUri);
    setStoredAiSpeechVoiceUri(voiceUri);
    toast.success(voiceUri ? "Listen voice updated" : "Using browser default voice");
  };

  const handlePreviewSpeechVoice = () => {
    if (!speechSupported) {
      toast.error("Text to speech is not supported in this browser");
      return;
    }
    if (!previewSpeechVoice(speechVoiceUri)) {
      toast.error("Could not play voice preview");
    }
  };

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!speechSupported) return;

    const refreshVoices = () => {
      setSpeechVoices(toSpeechVoiceOptions(loadSpeechVoices()));
    };

    refreshVoices();
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
    const timer = window.setTimeout(refreshVoices, 250);
    return () => {
      window.clearTimeout(timer);
      window.speechSynthesis.removeEventListener("voiceschanged", refreshVoices);
    };
  }, [speechSupported]);

  const toggleTheme = () => {
    const next: AppThemeMode = isDarkTheme ? "light" : "dark";
    setThemeMode(next);
    persistAndApplyAppTheme(next);
  };

  const suggestionPrompts = [
    { label: "Check my balance", prompt: "What's my current balance and spending forecast?", icon: Wallet },
    { label: "Send money", prompt: "How do I send money to another OpenPay user?", icon: Send },
    { label: "Top up wallet", prompt: "What are the best ways to top up my OpenPay wallet?", icon: CreditCard },
    { label: "Complete KYC", prompt: "Help me complete KYC verification step by step", icon: Shield },
    { label: "Start mining", prompt: "How does OpenPay mining work and how do I claim rewards?", icon: Pickaxe },
    { label: "Merchant setup", prompt: "How do I set up a merchant store and payment links?", icon: Store },
    { label: "Stake OUSD", prompt: "Explain OpenPay staking options and how to earn yield", icon: Coins },
    { label: "Invite & earn", prompt: "How does the affiliate referral program work?", icon: Users },
  ];

  const handleNewChat = () => {
    stopSpeaking();
    setMessages([]);
    setInputMessage("");
    setPendingPayment(null);
    setPendingSendRecipient(null);
    setShowPaymentConfirm(false);
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSuggestionClick = (prompt: string) => {
    setInputMessage(prompt);
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const recentUserPrompts = messages
    .filter((m) => m.role === "user")
    .slice(-12)
    .reverse();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadUserData();
  }, []);
  
  // Keyboard shortcut for quick menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowQuickMenu(prev => !prev);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Tab visibility and page persistence
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden, but don't refresh
        setPageActive(false);
      } else {
        // Tab is visible again
        setPageActive(true);
        // Only refresh data if user has interacted before
        if (userInteracted && userId) {
          // Soft refresh without full page reload
          Promise.all([
            loadBalance(userId),
            generateBalancePrediction(userId),
            loadInsights(userId),
            generateSmartRecommendations(userId)
          ]).catch(console.error);
        }
      }
    };
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (userInteracted) {
        // Ask for confirmation before leaving
        const message = "Are you sure you want to leave? Your unsaved changes may be lost.";
        e.returnValue = message;
        return message;
      }
    };
    
    const handleUserInteraction = () => {
      if (!userInteracted) {
        setUserInteracted(true);
      }
    };
    
    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Track user interaction
    const interactionEvents = ['click', 'keydown', 'scroll', 'touchstart'];
    interactionEvents.forEach(event => {
      document.addEventListener(event, handleUserInteraction, { once: true });
    });
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      interactionEvents.forEach(event => {
        document.removeEventListener(event, handleUserInteraction);
      });
    };
  }, [userInteracted, userId]);
  
  // Prevent automatic refresh on focus
  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      // Prevent automatic refresh on window focus
      e.stopImmediatePropagation();
    };
    
    const handleMouseOver = (e: MouseEvent) => {
      // Prevent unwanted refresh triggers
      if (e.target === window) {
        e.preventDefault();
      }
    };
    
    window.addEventListener('focus', handleFocus, true);
    window.addEventListener('mouseover', handleMouseOver, true);
    
    return () => {
      window.removeEventListener('focus', handleFocus, true);
      window.removeEventListener('mouseover', handleMouseOver, true);
    };
  }, []);

  const loadUserData = async () => {
    try {
      // Only load if page is active and not already loaded
      if (!pageActive && userInteracted) return;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      
      setUserId(user.id);
      
      // Load balance first to ensure it's available for other functions
      await loadBalance(user.id);
      
      await Promise.all([
        loadUserProfile(user.id),
        loadSpendingAnalysis(user.id),
        loadInsights(user.id),
        loadChatHistory(user.id),
        generateBalancePrediction(user.id),
        generateSmartRecommendations(user.id)
      ]);
      generatePersonalizedGreeting();
    } catch (error) {
      console.error("Error loading user data:", error);
      toast.error("Failed to load AI assistant");
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      
      if (profile) {
        const userProfile: UserProfile = {
          id: profile.id,
          full_name: profile.full_name || "User",
          username: profile.username,
          avatar_url: profile.avatar_url,
          account_number: `OP${profile.id.slice(0, 8).toUpperCase()}...${profile.id.slice(-4).toUpperCase()}`,
          referral_code: profile.referral_code || profile.username || "",
          kyc_status: (profile as any).kyc_status || "pending",
          created_at: profile.created_at,
          last_login: (profile as any).last_login || new Date().toISOString()
        };
        setUserProfile(userProfile);
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  };

  const generatePersonalizedGreeting = () => {
    const hour = new Date().getHours();
    const userName = userProfile?.full_name || "there";
    let timeGreeting = "Good morning";
    
    if (hour >= 12 && hour < 18) timeGreeting = "Good afternoon";
    else if (hour >= 18 || hour < 5) timeGreeting = "Good evening";
    
    const activityLevel = spendingCategories.length > 0 ? "active" : "new";
    const greeting = `${timeGreeting}, ${userName}! Welcome back to your ${activityLevel} financial dashboard. What should we tackle first — balance, sending money, spending, or something else?`;
    setGreeting(greeting);
  };

  const generateBalancePrediction = async (userId: string) => {
    try {
      // Get current balance fresh to avoid stale state issues
      const { data: walletData } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", userId)
        .single();
      
      const currentBalance = walletData?.balance || 0;
      
      // If balance is zero or very low, set reasonable defaults
      if (currentBalance <= 0) {
        const prediction: BalancePrediction = {
          current_balance: currentBalance,
          predicted_7_days: 0,
          predicted_30_days: 0,
          spending_velocity: 0,
          days_until_zero: 0,
          confidence: 0
        };
        setBalancePrediction(prediction);
        return;
      }
      
      // Get last 30 days of transactions for prediction
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: transactions } = await supabase
        .from("transactions")
        .select("amount, created_at, status")
        .eq("sender_id", userId)
        .eq("status", "completed")
        .gte("created_at", thirtyDaysAgo);
      
      if (transactions && transactions.length > 0) {
        const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount, 0);
        const dailyAverage = totalSpent / 30;
        const spendingVelocity = dailyAverage / currentBalance;
        const daysUntilZero = dailyAverage > 0 ? currentBalance / dailyAverage : 999;
        
        const prediction: BalancePrediction = {
          current_balance: currentBalance,
          predicted_7_days: Math.max(0, currentBalance - (dailyAverage * 7)),
          predicted_30_days: Math.max(0, currentBalance - (dailyAverage * 30)),
          spending_velocity: spendingVelocity,
          days_until_zero: Math.min(999, daysUntilZero),
          confidence: Math.min(0.95, transactions.length / 30)
        };
        
        setBalancePrediction(prediction);
      } else {
        // No transaction history - provide neutral prediction
        const prediction: BalancePrediction = {
          current_balance: currentBalance,
          predicted_7_days: currentBalance,
          predicted_30_days: currentBalance,
          spending_velocity: 0,
          days_until_zero: 999,
          confidence: 0.5
        };
        setBalancePrediction(prediction);
      }
    } catch (error) {
      console.error("Error generating balance prediction:", error);
      // Set safe fallback prediction
      const fallbackPrediction: BalancePrediction = {
        current_balance: userBalance,
        predicted_7_days: userBalance,
        predicted_30_days: userBalance,
        spending_velocity: 0,
        days_until_zero: 999,
        confidence: 0
      };
      setBalancePrediction(fallbackPrediction);
    }
  };

  const loadBalance = async (userId: string) => {
    const { data } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single();
    
    if (data) {
      setUserBalance(data.balance || 0);
    }
  };

  const generateSmartRecommendations = async (userId: string) => {
    const recommendations: SmartRecommendation[] = [];

    const [{ data: walletData }, { data: profileData }] = await Promise.all([
      supabase.from("wallets").select("balance").eq("user_id", userId).single(),
      supabase.from("profiles").select("kyc_status, username").eq("id", userId).maybeSingle(),
    ]);

    const currentBalance = Number(walletData?.balance || 0);
    const kycDone = isKycVerified(profileData?.kyc_status || userProfile?.kyc_status);

    // Low balance
    if (currentBalance < 100) {
      recommendations.push({
        id: "low-balance",
        type: "topup",
        title: "Top up your wallet",
        description: "Your balance is low. Add funds so sends and payments don’t get interrupted.",
        priority: "high",
        actionable: true,
        action_text: "Go to Top Up",
        estimated_impact: "Keep payments flowing",
        route: "/topup",
        prompt: "What are the best ways to top up my OpenPay wallet right now?",
      });
    }

    // KYC
    if (!kycDone) {
      recommendations.push({
        id: "kyc-verification",
        type: "security",
        title: "Complete KYC verification",
        description: "Verify your identity to unlock higher limits, merchant tools, remittance, and loans.",
        priority: "high",
        actionable: true,
        action_text: "Start KYC",
        estimated_impact: "Higher limits & more features",
        route: "/kyc",
        prompt: "Help me complete KYC verification step by step",
      });
    }

    // Security / 2FA nudge (always useful if KYC done or alongside)
    recommendations.push({
      id: "enable-2fa",
      type: "security",
      title: "Turn on two-factor auth",
      description: "Protect sends and withdrawals with authenticator 2FA on your OpenPay account.",
      priority: "medium",
      actionable: true,
      action_text: "Open 2FA",
      estimated_impact: "Stronger account security",
      route: "/two-factor",
      prompt: "How do I enable two-factor authentication on OpenPay?",
    });

    // Earn — mining
    recommendations.push({
      id: "start-mining",
      type: "feature",
      title: "Earn with daily mining",
      description: "Start a mining cycle to earn rewards. Watch an ad when required, then claim after 24 hours.",
      priority: "medium",
      actionable: true,
      action_text: "Open Mining",
      estimated_impact: "Passive daily rewards",
      route: "/mining",
      prompt: "How does OpenPay mining work and how do I claim rewards?",
    });

    // Staking if they have balance
    if (currentBalance >= 50) {
      recommendations.push({
        id: "stake-ousd",
        type: "investment",
        title: "Stake OUSD for yield",
        description: "Lock part of your balance for 7–365 days to earn staking rewards.",
        priority: "low",
        actionable: true,
        action_text: "View Staking",
        estimated_impact: "Earn yield on idle funds",
        route: "/staking",
        prompt: "Explain OpenPay staking options and how to earn yield",
      });
    }

    // Merchant / business
    recommendations.push({
      id: "merchant-setup",
      type: "feature",
      title: "Accept payments as a merchant",
      description: "Set up POS, payment links, or QR Pay to get paid for products and services.",
      priority: kycDone ? "medium" : "low",
      actionable: true,
      action_text: "Merchant Portal",
      estimated_impact: "Get paid online & in person",
      route: kycDone ? "/merchant-onboarding" : "/kyc",
      prompt: kycDone
        ? "How do I set up a merchant store and payment links?"
        : "Do I need KYC before I can accept merchant payments?",
    });

    // Affiliate
    recommendations.push({
      id: "affiliate-invite",
      type: "feature",
      title: "Invite friends & earn",
      description: "Share your referral link and earn bonuses when people join and mine.",
      priority: "low",
      actionable: true,
      action_text: "Open Affiliate",
      estimated_impact: "Extra referral rewards",
      route: "/affiliate",
      prompt: "How does the affiliate referral program work?",
    });

    // Spending optimization
    const topCategory = spendingCategories[0];
    if (topCategory && topCategory.percentage > 40) {
      recommendations.push({
        id: "spending-optimization",
        type: "saving",
        title: `Review ${topCategory.name} spending`,
        description: `${topCategory.percentage.toFixed(0)}% of recent spending is in ${topCategory.name}. Ask AI for a budget plan.`,
        priority: "medium",
        actionable: true,
        action_text: "Get advice",
        estimated_impact: "Cut unnecessary spend",
        prompt: `Analyze my spending on ${topCategory.name} and suggest how to save money this month`,
      });
    }

    // Virtual card
    recommendations.push({
      id: "virtual-card",
      type: "feature",
      title: "Activate a virtual card",
      description: "Use a wallet-backed virtual card for OpenPay checkouts and lock it anytime.",
      priority: "low",
      actionable: true,
      action_text: "Virtual Card",
      estimated_impact: "Faster checkouts",
      route: "/virtual-card",
      prompt: "How do OpenPay virtual cards work?",
    });

    // Priority sort, keep top 5
    const rank = { high: 0, medium: 1, low: 2 } as const;
    recommendations.sort((a, b) => rank[a.priority] - rank[b.priority]);
    setRecommendations(recommendations.slice(0, 5));
  };

  const handleRecommendationAction = (rec: SmartRecommendation) => {
    setShowInsightsPanel(false);
    if (rec.route) {
      navigate(rec.route);
      return;
    }
    if (rec.prompt) {
      handleSuggestionClick(rec.prompt);
      return;
    }
    handleSuggestionClick(rec.action_text);
  };

  const loadSpendingAnalysis = async (userId: string) => {
    // Get transactions from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: transactions } = await supabase
      .from("transactions")
      .select("amount, note, created_at, status")
      .eq("sender_id", userId)
      .eq("status", "completed")
      .gte("created_at", thirtyDaysAgo);

    if (transactions) {
      analyzeSpending(transactions);
    }
  };

  const analyzeSpending = (transactions: any[]) => {
    const categories = [
      { name: "Food & Dining", keywords: ["food", "restaurant", "dining", "coffee", "meal"], color: "#ef4444" },
      { name: "Transport", keywords: ["transport", "uber", "grab", "taxi", "gas", "fuel"], color: "#3b82f6" },
      { name: "Shopping", keywords: ["shop", "store", "mall", "purchase", "buy"], color: "#8b5cf6" },
      { name: "Bills & Utilities", keywords: ["bill", "utility", "electric", "water", "internet"], color: "#f59e0b" },
      { name: "Entertainment", keywords: ["movie", "game", "entertainment", "subscription"], color: "#10b981" },
      { name: "Others", keywords: [], color: "#6b7280" }
    ];

    const categorizedSpending: { [key: string]: number } = {};
    let totalSpent = 0;

    transactions.forEach(tx => {
      const note = (tx.note || "").toLowerCase();
      let categorized = false;
      
      for (const category of categories) {
        if (category.keywords.some(keyword => note.includes(keyword))) {
          categorizedSpending[category.name] = (categorizedSpending[category.name] || 0) + tx.amount;
          categorized = true;
          break;
        }
      }
      
      if (!categorized) {
        categorizedSpending["Others"] = (categorizedSpending["Others"] || 0) + tx.amount;
      }
      
      totalSpent += tx.amount;
    });

    const categoryData = Object.entries(categorizedSpending).map(([name, amount]) => ({
      name,
      amount,
      percentage: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
      color: categories.find(c => c.name === name)?.color || "#6b7280"
    }));

    setSpendingCategories(categoryData.sort((a, b) => b.amount - a.amount));
  };

  const loadInsights = async (userId: string) => {
    const insights: FinancialInsight[] = [];
    
    // Get fresh balance for insights
    const { data: walletData } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single();
    
    const currentBalance = walletData?.balance || 0;
    
    // Balance insight with prediction
    const balanceTrend = balancePrediction ? 
      (balancePrediction.predicted_7_days < currentBalance * 0.8 ? "down" : 
       balancePrediction.predicted_7_days > currentBalance * 1.2 ? "up" : "stable") : "stable";
    
    insights.push({
      type: "balance",
      title: "Current Balance",
      description: "Available funds in your wallet",
      value: `$${currentBalance.toFixed(2)}`,
      trend: balanceTrend,
      priority: currentBalance < 1000 ? "high" : "low",
      actionable: currentBalance < 1000,
      action: "Top Up"
    });

    // Spending insight
    const totalSpent = spendingCategories.reduce((sum, cat) => sum + cat.amount, 0);
    insights.push({
      type: "spending",
      title: "Monthly Spending",
      description: "Total spent this month",
      value: `$${totalSpent.toFixed(2)}`,
      trend: totalSpent > 10000 ? "up" : "stable",
      priority: totalSpent > 10000 ? "medium" : "low",
      actionable: totalSpent > 0,
      action: "View Analysis"
    });

    // Prediction insight
    if (balancePrediction && balancePrediction.days_until_zero < 30 && balancePrediction.days_until_zero < 999) {
      insights.push({
        type: "prediction",
        title: "Balance Forecast",
        description: `Expected balance in 7 days: $${balancePrediction.predicted_7_days.toFixed(2)}`,
        value: `${Math.ceil(balancePrediction.days_until_zero)} days left`,
        trend: "down",
        priority: balancePrediction.days_until_zero < 7 ? "high" : "medium",
        actionable: true,
        action: "Top Up Now"
      });
    }

    // Budget alerts
    const alerts = spendingCategories
      .filter(cat => cat.percentage > 30)
      .map(cat => ({
        category: cat.name,
        spent: cat.amount,
        limit: cat.amount * 3, // Estimate 3x as monthly limit
        percentage: cat.percentage
      }));

    setBudgetAlerts(alerts);

    if (alerts.length > 0) {
      insights.push({
        type: "alert",
        title: "Budget Alert",
        description: `${alerts.length} category(ies) exceeding recommended limits`,
        trend: "up",
        priority: "medium",
        actionable: true,
        action: "Set Budgets"
      });
    }

    // Goal progress (placeholder for future implementation)
    if (isKycVerified(userProfile?.kyc_status)) {
      insights.push({
        type: "goal",
        title: "Account Status",
        description: "Your account is fully verified",
        value: "Verified",
        trend: "stable",
        priority: "low",
        actionable: false
      });
    }

    setInsights(insights);
  };

  const loadChatHistory = async (userId: string) => {
    const { data } = await (supabase as any)
      .from("ai_chat_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      const history = data.map((msg: any) => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        content: fixMojibakeText(msg.content || ""),
        timestamp: msg.created_at,
        type: (msg.type || "text") as Message["type"],
        receipt: msg.metadata?.receipt || undefined,
      }));
      setMessages(history.reverse());
    }
  };

  const saveMessage = async (message: Message) => {
    if (!userId) return;
    
    await (supabase as any)
      .from("ai_chat_history")
      .insert({
        user_id: userId,
        role: message.role,
        content: message.content,
        type: message.type === "receipt" ? "payment" : message.type || "text",
        metadata: message.receipt ? { receipt: message.receipt } : {},
        created_at: message.timestamp
      });
  };

  const callOpenPayAI = async (prompt: string): Promise<string> => {
    try {
      // Build short conversation history for context
      const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke("openpay-ai-chat", {
        body: { message: prompt, messages: history, model: "google/gemini-2.5-flash" },
      });

      if (error) {
        console.error("AI invoke error:", error);
        return "I'm having trouble reaching the AI service right now. Please try again in a moment.";
      }
      if (data?.error) {
        if (String(data.error).toLowerCase().includes("rate")) {
          return "⏳ The AI is busy. Please try again in a few seconds.";
        }
        if (String(data.error).toLowerCase().includes("credit")) {
          return "⚠️ AI credits are exhausted. Please top up your Lovable AI workspace credits.";
        }
        return `AI error: ${data.error}`;
      }
      return fixMojibakeText(data?.reply || "I couldn't generate a response. Please try again.");
    } catch (e) {
      console.error("callOpenPayAI failed", e);
      return "I'm having trouble connecting to the AI service. Please try again later.";
    }
  };
  
  const parseSendIntent = (message: string): { recipient: string; amount: number | null } | null => {
    const text = message.trim();

    // send/transfer/pay [to] @user amount
    let match = text.match(
      /(?:send|transfer|pay)\s+(?:to\s+)?@?([a-zA-Z0-9_]+)\s+\$?(\d+(?:\.\d{1,2})?)\s*(?:php|₱|\$|dollars?|usd)?$/i
    );
    if (match) {
      return { recipient: match[1], amount: parseFloat(match[2]) };
    }

    // send/transfer/pay amount to @user
    match = text.match(
      /(?:send|transfer|pay)\s+\$?(\d+(?:\.\d{1,2})?)\s*(?:php|₱|\$|dollars?|usd)?\s+(?:to\s+)?@?([a-zA-Z0-9_]+)\s*$/i
    );
    if (match) {
      return { recipient: match[2], amount: parseFloat(match[1]) };
    }

    // send/transfer/pay to @user  (amount missing)
    match = text.match(
      /(?:send|transfer|pay)\s+(?:to\s+)?@([a-zA-Z0-9_]+)\s*$/i
    );
    if (match) {
      return { recipient: match[1], amount: null };
    }

    match = text.match(
      /(?:send|transfer|pay)\s+to\s+([a-zA-Z0-9_]+)\s*$/i
    );
    if (match) {
      return { recipient: match[1], amount: null };
    }

    return null;
  };

  const buildBalanceResponse = async (): Promise<string> => {
    let freshBalance = 0;
    try {
      const bal = await partnerGetBalance();
      freshBalance = bal.balance;
    } catch {
      const { data: freshBalanceData } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", userId)
        .single();
      freshBalance = Number(freshBalanceData?.balance || 0);
    }
    let response = `💰 **Your current balance is $${freshBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.**`;

    if (balancePrediction) {
      response += `\n\n📊 **Balance Forecast:**\n`;
      response += `• In 7 days: $${balancePrediction.predicted_7_days.toFixed(2)}\n`;
      response += `• In 30 days: $${balancePrediction.predicted_30_days.toFixed(2)}\n`;
      response += `• Days until zero: ${balancePrediction.days_until_zero < 999 ? Math.ceil(balancePrediction.days_until_zero) : "N/A"}\n`;
      response += `• Confidence: ${Math.round(balancePrediction.confidence * 100)}%\n`;

      if (balancePrediction.days_until_zero < 7 && balancePrediction.days_until_zero < 999) {
        response += `\n⚠️ **Low Balance Alert:** Your balance may run out soon. Consider topping up.`;
      } else if (balancePrediction.days_until_zero < 30 && balancePrediction.days_until_zero < 999) {
        response += `\n💡 **Suggestion:** Monitor your spending to maintain a healthy balance.`;
      }
    }

    if (freshBalance < 1000) {
      response += `\n\n🔔 **Recommendation:** Consider topping up to avoid service interruptions.`;
    }

    response += `\n\n💡 **Tip:** Send money with \`send to @username amount\` (example: \`send to @openpay 50\`).`;
    response += `\n\nWant me to help you **send money**, look at **spending**, or check **financial health** next?`;
    return response;
  };
  
  // Feature command executor
  const executeFeatureCommand = async (route: string): Promise<string> => {
    try {
      // Show loading message
      const loadingMessage = `🚀 Opening ${route.replace('/', '')}...`;
      
      // Navigate to the feature
      navigate(route);
      
      return `${loadingMessage}\n\n✅ Successfully opened ${route.replace('/', '')} page.\n\n💡 You can also use these commands:\n• "help" - Show all available commands\n• "dashboard" - Go to main dashboard\n• "menu" - Show main menu\n• "back" - Return to previous page`;
    } catch (error) {
      console.error('Navigation error:', error);
      return `❌ Failed to open ${route.replace('/', '')}. Please try again or use the menu above.`;
    }
  };
  
  // Real transfer via Partner Transfer API POST /transfers — deducts connected wallet
  const confirmPayment = async () => {
    if (!pendingPayment || !userId) return;

    const recipientRaw = String(pendingPayment.recipient || "").trim();
    const to = formatPartnerRecipient(recipientRaw);
    const amount = Number(pendingPayment.amount);

    try {
      if (!(amount > 0)) {
        toast.error("Invalid amount.");
        setPendingPayment(null);
        setShowPaymentConfirm(false);
        return;
      }

      const { balance: currentBalance } = await partnerGetBalance();
      if (amount > currentBalance) {
        toast.error("Insufficient balance. Transaction cancelled.");
        setPendingPayment(null);
        setShowPaymentConfirm(false);
        return;
      }

      // Resolve via Partner API GET /accounts/:identifier
      let displayName = recipientRaw.replace(/^@/, "");
      try {
        const account = await partnerLookupAccount(to);
        if (account.user_id === userId) {
          toast.error("You can't send money to yourself.");
          setPendingPayment(null);
          setShowPaymentConfirm(false);
          return;
        }
        displayName = account.username || displayName;
      } catch (lookupErr) {
        toast.error(
          lookupErr instanceof Error
            ? lookupErr.message
            : `User ${to} not found on OpenPay.`
        );
        setPendingPayment(null);
        setShowPaymentConfirm(false);
        return;
      }

      const note = `OpenPay AI transfer to ${to}`;
      const result = await partnerSendTransfer({ to, amount, note });

      await loadBalance(userId);
      const balanceAfter = Number(result.sender_balance);

      const receipt: AiReceiptData = {
        transactionId: result.transaction_id,
        recipient: result.recipient_username || displayName,
        amount,
        balanceAfter,
        status: result.status === "completed" ? "Completed" : result.status,
        timestamp: new Date().toISOString(),
        note,
      };

      toast.success(`Sent $${amount.toFixed(2)} to @${receipt.recipient}`);

      const confirmationMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: `Payment of $${amount.toFixed(2)} to @${receipt.recipient} completed. View it on OpenLedger.\n\nWant to **send another payment**, check your **balance**, or open **Activity** next?`,
        timestamp: new Date().toISOString(),
        type: "receipt",
        receipt,
      };

      setMessages((prev) => [...prev, confirmationMessage]);
      await saveMessage(confirmationMessage);

      setPendingPayment(null);
      setShowPaymentConfirm(false);

      await Promise.all([
        generateBalancePrediction(userId),
        loadInsights(userId),
        generateSmartRecommendations(userId),
      ]);
      setUserInteracted(true);
    } catch (error) {
      console.error("Transaction error:", error);
      toast.error(
        error instanceof Error ? error.message : "Payment failed. Please try again."
      );
      setPendingPayment(null);
      setShowPaymentConfirm(false);
    }
  };
  
  // Direct transaction executor
  const executeDirectTransaction = async (recipient: string, amount: number): Promise<string> => {
    try {
      let currentBalance = 0;
      try {
        currentBalance = (await partnerGetBalance()).balance;
      } catch {
        const { data: walletData } = await supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", userId)
          .single();
        currentBalance = Number(walletData?.balance || 0);
      }

      if (amount <= 0) {
        return `❌ Invalid amount. Please enter a positive amount.`;
      }

      if (amount > currentBalance) {
        return `❌ Insufficient balance. Your current balance is $${currentBalance.toFixed(2)}.\n\n💡 Consider topping up your account first.`;
      }

      if (recipient.length < 2) {
        return `❌ Invalid recipient. Please enter a valid username.`;
      }

      const to = formatPartnerRecipient(recipient);
      try {
        await partnerLookupAccount(to);
      } catch (e) {
        return `❌ ${e instanceof Error ? e.message : `User ${to} not found on OpenPay.`}`;
      }

      setPendingPayment({ amount, recipient: recipient.replace(/^@/, "") });
      setShowPaymentConfirm(true);

      return `💸 **Ready to Send Money**\n\n📋 **Transaction Details:**\n• Recipient: ${to}\n• Amount: $${amount.toFixed(2)}\n• Your Balance: $${currentBalance.toFixed(2)}\n• Remaining: $${(currentBalance - amount).toFixed(2)}\n\nShould I go ahead? Reply \`confirm\` to send, or \`cancel\` to stop.`;
    } catch (error) {
      console.error("Transaction execution error:", error);
      return `❌ Failed to process transaction. Please try again or contact support.`;
    }
  };
  
  // Help response generator
  const generateHelpResponse = (): string => {
    return `## OpenPay AI can help with everything in the app

### Quick actions
• **balance** — check balance & forecast
• **send to @username amount** — start a transfer (then confirm)
• **help** — this menu

### Go to a feature (type the name)
**Wallet:** dashboard · activity · receive · contacts · currency converter  
**Pay:** send · transfer pro · request · invoice · scan qr · disputes  
**Fund:** top up · topup history · swap · withdraw  
**Cards & ID:** virtual card · kyc · 2fa · settings · profile  
**Earn:** mining · staking · affiliate · ads  
**Business:** merchant · products · pos · payment links · qr pay · buttons  
**Web3:** nft · mint · nft store  
**Dev:** api docs · partner api · developer  
**Help:** help center · wiki · support · feature quest · ledger

### Examples
• "How do I top up with PayPal?"
• "Help me complete KYC"
• "How does staking work?"
• "Create a payment link for my store"
• "Take me to mining"
• "send to @openpay 25"

Ask in plain language — I'll match your need to the right OpenPay feature.

What do you want to do first?`;
  };

  const processUserMessage = async (message: string) => {
    const lowerMessage = message.toLowerCase().trim();

    // Confirm / cancel pending send
    if (pendingPayment && /^(confirm|yes|approve|proceed|ok|okay)$/i.test(lowerMessage)) {
      await confirmPayment();
      return ""; // confirmPayment already posts the result message
    }
    if ((pendingPayment || pendingSendRecipient) && /^(cancel|no|stop|nevermind|never mind)$/i.test(lowerMessage)) {
      setPendingPayment(null);
      setPendingSendRecipient(null);
      setShowPaymentConfirm(false);
      return `❌ Transfer cancelled. Want to try a different amount, pick another recipient, or check your balance instead?`;
    }

    // If we asked for an amount, accept a bare number next
    if (pendingSendRecipient) {
      const amountOnly = lowerMessage.match(/^\$?(\d+(?:\.\d{1,2})?)\s*(?:php|₱|\$|dollars?|usd)?$/);
      if (amountOnly) {
        const amount = parseFloat(amountOnly[1]);
        const recipient = pendingSendRecipient;
        setPendingSendRecipient(null);
        return await executeDirectTransaction(recipient, amount);
      }
    }

    // Payment intents — must run before feature navigation
    const sendIntent = parseSendIntent(message);
    if (sendIntent) {
      if (sendIntent.amount == null || Number.isNaN(sendIntent.amount)) {
        setPendingSendRecipient(sendIntent.recipient);
        return `💸 **Send to @${sendIntent.recipient}**\n\nHow much would you like to send?\n\nReply with an amount, for example:\n• \`50\`\n• \`25.50\`\n• \`send to @${sendIntent.recipient} 100\`\n\nOr type \`cancel\` to stop.`;
      }
      setPendingSendRecipient(null);
      return await executeDirectTransaction(sendIntent.recipient, sendIntent.amount);
    }

    // Balance / forecast — before other routing so "balance" is never hijacked
    if (
      /\bbalance\b/.test(lowerMessage) ||
      /\bforecast\b/.test(lowerMessage) ||
      /\bprediction\b/.test(lowerMessage) ||
      /^(?:check|show|my)\s+balance$/.test(lowerMessage) ||
      lowerMessage === "balance"
    ) {
      return await buildBalanceResponse();
    }

    // Help command
    if (lowerMessage.includes('help') || lowerMessage.includes('commands') || lowerMessage.includes('features')) {
      return generateHelpResponse();
    }

    // (balance handled above)

    // Enhanced spending analysis with AI insights
    if (lowerMessage.includes("spending") || lowerMessage.includes("analyze") || lowerMessage.includes("patterns")) {
      const totalSpent = spendingCategories.reduce((sum, cat) => sum + cat.amount, 0);
      const topCategory = spendingCategories[0];
      
      let response = `📊 **Spending Analysis for this month:**\n`;
      response += `• Total spent: $${totalSpent.toFixed(2)}\n`;
      response += `• Daily average: $${(totalSpent / 30).toFixed(2)}\n`;
      
      if (topCategory) {
        response += `• Top category: ${topCategory.name} ($${topCategory.amount.toFixed(2)}, ${topCategory.percentage.toFixed(1)}%)\n`;
      }
      
      // AI recommendations
      response += `\n🤖 **AI Insights:**\n`;
      
      if (topCategory && topCategory.percentage > 40) {
        response += `• ${topCategory.name} spending is high (${topCategory.percentage.toFixed(1)}%). Consider setting a budget.\n`;
      }
      
      if (totalSpent > userBalance * 0.5) {
        response += `• You've spent over 50% of your current balance this month. Monitor remaining funds.\n`;
      }
      
      if (spendingCategories.length > 3) {
        response += `• Good diversification across ${spendingCategories.length} spending categories.\n`;
      }
      
      if (budgetAlerts.length > 0) {
        response += `\n⚠️ **Budget Alerts:** ${budgetAlerts.length} category(ies) need attention.\n`;
      }

      response += `\nWant a **budget tip** for your top category, or should we look at **how to top up**?`;
      return response;
    }

    // Smart financial advice
    if (lowerMessage.includes("advice") || lowerMessage.includes("recommend") || lowerMessage.includes("optimize")) {
      let advice = `🤖 **Personalized Financial Advice:**\n\n`;
      
      if (userBalance < 500) {
        advice += `💡 **Priority:** Build an emergency fund. Aim for $1,000 in savings.\n`;
      } else if (userBalance < 2000) {
        advice += `💡 **Priority:** Continue building savings while managing expenses.\n`;
      } else {
        advice += `💡 **Priority:** Consider investment options to grow your wealth.\n`;
      }
      
      if (spendingCategories.length > 0) {
        const topCategory = spendingCategories[0];
        if (topCategory.percentage > 30) {
          advice += `📊 **Spending:** Review ${topCategory.name} expenses - they represent ${topCategory.percentage.toFixed(0)}% of spending.\n`;
        }
      }
      
      if (!isKycVerified(userProfile?.kyc_status)) {
        advice += `🔐 **Security:** Complete KYC verification to unlock higher limits.\n`;
      }
      
      advice += `🎯 **Goal:** Set up automatic savings for consistent growth.\n`;
      advice += `\nWhat matters most right now — **saving more**, **spending less**, or **earning** (mining/staking)?`;
      
      return advice;
    }

    // Smart top-up recommendations
    if (lowerMessage.includes("top up") || lowerMessage.includes("topup") || lowerMessage.includes("add funds")) {
      let response = `💳 **Smart Top-Up Recommendations:**\n\n`;
      
      if (userBalance < 1000) {
        response += `🔴 **Low Balance:** Recommend adding at least $500 to maintain healthy buffer.\n`;
      } else if (userBalance < 2000) {
        response += `🟡 **Moderate Balance:** Consider adding $300-500 for better flexibility.\n`;
      } else {
        response += `🟢 **Good Balance:** Top up as needed or consider investments.\n`;
      }
      
      response += `\n💡 **Best Methods:**\n`;
      response += `• Bank transfer (lowest fees)\n`;
      response += `• Digital wallet (fastest)\n`;
      response += `• Cryptocurrency (good for larger amounts)\n\n`;
      
      if (balancePrediction && balancePrediction.days_until_zero < 30) {
        response += `⚠️ **Based on your spending pattern, consider adding $${Math.ceil(balancePrediction.spending_velocity * 30)} to last 30 days.`;
      }

      response += `\n\nWant me to open **Top-up** for you, or tell me how much you'd like to add?`;
      return response;
    }

    // Enhanced financial health score
    if (lowerMessage.includes("health") || lowerMessage.includes("score") || lowerMessage.includes("financial status")) {
      let score = 75; // Base score
      let factors = [];
      
      // Balance factor
      if (userBalance > 2000) {
        score += 10;
        factors.push("✅ Strong balance");
      } else if (userBalance < 500) {
        score -= 15;
        factors.push("⚠️ Low balance");
      }
      
      // Spending factor
      const totalSpent = spendingCategories.reduce((sum, cat) => sum + cat.amount, 0);
      if (totalSpent < userBalance * 0.3) {
        score += 10;
        factors.push("✅ Controlled spending");
      } else if (totalSpent > userBalance * 0.8) {
        score -= 10;
        factors.push("⚠️ High spending rate");
      }
      
      // KYC factor
      if (isKycVerified(userProfile?.kyc_status)) {
        score += 5;
        factors.push("✅ Account verified");
      }
      
      // Budget alerts factor
      if (budgetAlerts.length === 0) {
        score += 5;
        factors.push("✅ No budget alerts");
      } else {
        score -= budgetAlerts.length * 3;
        factors.push(`⚠️ ${budgetAlerts.length} budget alert(s)`);
      }
      
      score = Math.max(0, Math.min(100, score));
      
      let grade = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Needs Improvement";
      let emoji = score >= 80 ? "🟢" : score >= 60 ? "🟡" : score >= 40 ? "🟠" : "🔴";
      
      return `${emoji} **Financial Health Score: ${score}/100 (${grade})**\n\n**Factors:**\n${factors.join('\n')}\n\n**Recommendations:**\n${score < 60 ? 'Focus on building savings and controlling expenses.' : score < 80 ? 'Continue good habits and consider investments.' : 'Excellent financial management! Consider diversification.'}\n\nWant to dig into **spending**, **top-up**, or **earn options** (mining/staking) next?`;
    }

    // Try AI for complex queries
    try {
      console.log("🤖 Attempting AI response for:", message);
      const aiResponse = await callOpenPayAI(message);
      console.log("✅ AI response successful");
      return aiResponse;
    } catch (error) {
      console.error("❌ AI fallback error:", error);
      return "I'm here to help. Want to check your **balance**, **send money**, review **spending**, or ask how a feature works?";
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isTyping) return;

    console.log("📝 User sending message:", inputMessage);
    
    // Mark user as interacted to enable persistence
    setUserInteracted(true);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
    setIsTyping(true);

    try {
      console.log("🤖 Processing message with AI...");
      const aiResponse = await processUserMessage(inputMessage);
      console.log("✅ AI response received:", aiResponse);

      if (!aiResponse?.trim()) {
        return;
      }
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: aiResponse,
        timestamp: new Date().toISOString(),
        type: pendingPayment ? "payment" : "text"
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Save both messages
      await Promise.all([
        saveMessage(userMessage),
        saveMessage(assistantMessage)
      ]);
      
      console.log("💾 Messages saved to database");
    } catch (error) {
      console.error("❌ Error processing message:", error);
      toast.error("Failed to process your message");
    } finally {
      setIsTyping(false);
    }
  };

  // Enhanced confirm payment to handle direct transactions
  const handleConfirmPayment = async () => {
    await confirmPayment();
  };

  if (loading) {
        return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gradient-to-b from-paypal-blue to-[#072a7a]">
        <div className="text-center">
          <AuthMark className="mx-auto mb-6 h-16 w-16" />
          <p className="text-3xl font-bold tracking-tight text-white">OpenPay</p>
          <p className="mt-1 text-sm text-white/80">Loading OpenPay AI...</p>
          <p className="mt-1 text-xs font-medium tracking-normal text-white/65">Powered by Pi Network</p>
          <div className="mx-auto mt-6 h-8 w-8 rounded-full border-2 border-white/35 border-t-white animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background font-ai-sans text-foreground">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Theme-aware sidebar (matches dashboard light/dark) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col overflow-hidden border-r border-border bg-card text-foreground transition-all duration-300 ease-out dark:border-white/10 dark:bg-black dark:text-white lg:static ${
          sidebarOpen
            ? "translate-x-0 lg:w-[280px] lg:opacity-100"
            : "-translate-x-full lg:w-0 lg:translate-x-0 lg:border-r-0 lg:opacity-0"
        }`}
      >
        <div className="flex min-w-[280px] items-center gap-2 p-3">
          <button
            type="button"
            onClick={handleNewChat}
            className="flex flex-1 items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-medium transition hover:bg-muted dark:border-white/15 dark:hover:bg-white/10"
          >
            <SquarePen className="h-4 w-4" />
            New chat
          </button>
          <button
            type="button"
            className="rounded-lg p-2.5 text-muted-foreground transition hover:bg-muted dark:text-white/70 dark:hover:bg-white/10"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>


        <div className="flex-1 overflow-y-auto px-2 pb-3">
          <p className="px-2 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground dark:text-white/40">
            Recent
          </p>
          {recentUserPrompts.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground dark:text-white/40">Your conversations will appear here</p>
          ) : (
            <div className="space-y-0.5">
              {recentUserPrompts.map((msg) => (
                <button
                  key={msg.id}
                  type="button"
                  onClick={() => {
                    setSidebarOpen(false);
                    scrollToBottom();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-foreground/80 transition hover:bg-muted dark:text-white/80 dark:hover:bg-white/10"
                >
                  <MessageCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground dark:text-white/40" />
                  <span className="truncate">{msg.content}</span>
                </button>
              ))}
            </div>
          )}

          <p className="mt-4 px-2 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground dark:text-white/40">
            Quick asks
          </p>
          <div className="space-y-0.5">
            {suggestionPrompts.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleSuggestionClick(item.prompt)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-foreground/80 transition hover:bg-muted dark:text-white/80 dark:hover:bg-white/10"
              >
                <item.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground dark:text-white/40" />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1 border-t border-border p-3 dark:border-white/10">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-foreground/80 transition hover:bg-muted dark:text-white/80 dark:hover:bg-white/10"
            aria-label={isDarkTheme ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkTheme ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {isDarkTheme ? "Light mode" : "Dark mode"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowInsightsPanel(true);
              setSidebarOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-foreground/80 transition hover:bg-muted dark:text-white/80 dark:hover:bg-white/10"
          >
            <BarChart3 className="h-4 w-4" />
            Financial insights
            {insights.length > 0 && (
              <span className="ml-auto rounded-md bg-muted px-1.5 py-0.5 text-[10px] dark:bg-white/15">
                {insights.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowMcpDialog(true)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-foreground/80 transition hover:bg-muted dark:text-white/80 dark:hover:bg-white/10"
          >
            <Plug className="h-4 w-4" />
            MCP Actions
          </button>

          <div className="rounded-lg">
            <button
              type="button"
              onClick={() => setShowAiSettings((open) => !open)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-foreground/80 transition hover:bg-muted dark:text-white/80 dark:hover:bg-white/10"
              aria-expanded={showAiSettings}
            >
              <Settings className="h-4 w-4" />
              Settings
              <ChevronDown className={`ml-auto h-4 w-4 transition ${showAiSettings ? "rotate-180" : ""}`} />
            </button>
            {showAiSettings && (
              <div className="mx-1 mb-1 space-y-2 rounded-xl border border-border/70 bg-muted/40 p-2.5 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-1.5 px-1">
                  <Volume2 className="h-3.5 w-3.5 text-paypal-blue" />
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-white/55">
                    AI Listen voice
                  </p>
                </div>
                {speechSupported ? (
                  <>
                    <select
                      value={speechVoiceUri}
                      onChange={(e) => handleChangeSpeechVoice(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-background px-2.5 text-xs text-foreground dark:border-white/15 dark:bg-black"
                    >
                      <option value="">Browser default</option>
                      {speechVoices.map((voice) => (
                        <option key={voice.uri} value={voice.uri}>
                          {voice.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={handlePreviewSpeechVoice}
                        className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border text-xs font-medium transition hover:bg-background dark:border-white/15 dark:hover:bg-white/10"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                        Preview
                      </button>
                      {speechVoiceUri ? (
                        <button
                          type="button"
                          onClick={() => handleChangeSpeechVoice("")}
                          className="h-9 rounded-lg border border-border px-3 text-xs font-medium transition hover:bg-background dark:border-white/15 dark:hover:bg-white/10"
                        >
                          Reset
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="px-1 text-xs text-muted-foreground">
                    Text to speech is not supported in this browser.
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate("/menu")}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-foreground/80 transition hover:bg-muted dark:text-white/80 dark:hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to menu
          </button>
          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-muted dark:hover:bg-white/10"
          >
            {userProfile?.avatar_url ? (
              <img
                src={userProfile.avatar_url}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-black/10 dark:ring-white/15"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paypal-blue text-xs font-semibold text-white">
                {(userProfile?.full_name || userProfile?.username || "U").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{userProfile?.full_name || "User"}</p>
              <p className="truncate text-xs text-muted-foreground dark:text-white/45">
                {userProfile?.username ? `@${userProfile.username}` : null}
                {userProfile?.username ? " · " : null}
                ${userBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </button>
        </div>
      </aside>

      {/* Main chat column */}
      <div className="relative flex min-w-0 flex-1 flex-col bg-[#F4F1EA] dark:bg-black">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#E5E0D6]/80 bg-[#F4F1EA]/90 px-3 backdrop-blur dark:border-white/10 dark:bg-black/90 sm:px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-foreground/70 transition hover:bg-muted lg:hidden"
              aria-label="Open sidebar"
            >
              <PanelLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <BrandLogo className="h-7 w-7" />
              <div>
                <h1 className="text-sm font-semibold leading-none sm:text-base">OpenPay AI</h1>
                <p className="mt-0.5 hidden text-[11px] text-muted-foreground sm:block">Financial assistant</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground/70 transition hover:bg-muted"
              aria-label={isDarkTheme ? "Switch to light mode" : "Switch to dark mode"}
              title={isDarkTheme ? "Light mode" : "Dark mode"}
            >
              {isDarkTheme ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="hidden sm:inline">{isDarkTheme ? "Light" : "Dark"}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowInsightsPanel(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground/70 transition hover:bg-muted"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Insights</span>
            </button>
            <button
              type="button"
              onClick={handleNewChat}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground/70 transition hover:bg-muted"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
            </button>
          </div>
        </header>

        {/* Messages — Claude-style layout */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-[48rem] flex-col items-center justify-center px-4 pb-32 pt-12">
              <BrandLogo className="mb-5 h-12 w-12" animate={false} />
              <h2 className="max-w-xl text-center font-ai-serif text-[1.75rem] font-medium leading-snug tracking-[-0.02em] text-foreground sm:text-[2rem]">
                {greeting
                  ? greeting.replace(/^Good (morning|afternoon|evening),?\s*/i, "Hi, ").split(/[.!]/)[0]
                  : "How can I help with your finances today?"}
              </h2>
              <p className="mt-3 max-w-md text-center font-ai-sans text-sm text-muted-foreground">
                Ask me anything — I&apos;ll answer and ask what you want to do next.
              </p>
              <div className="mt-10 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2">
                {suggestionPrompts.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleSuggestionClick(item.prompt)}
                    className="rounded-2xl border border-border/80 bg-transparent px-4 py-3.5 text-left transition hover:bg-muted/60"
                  >
                    <p className="font-ai-sans text-sm font-medium text-foreground">{item.label}</p>
                    <p className="mt-1 line-clamp-2 font-ai-sans text-xs leading-relaxed text-muted-foreground">
                      {item.prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[48rem] px-4 py-8 sm:px-6">
              <div className="flex flex-col gap-7">
                {messages.map((message) =>
                  message.role === "user" ? (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[min(85%,36rem)] rounded-2xl bg-[#E8E4DA] px-4 py-2.5 dark:bg-white/10">
                        <p className="whitespace-pre-wrap font-ai-sans text-[15px] font-medium leading-[1.55] text-foreground">
                          {fixMojibakeText(message.content)}
                        </p>
                      </div>
                    </div>
                  ) : message.type === "receipt" && message.receipt ? (
                    <div key={message.id} className="w-full space-y-3">
                      <p className="font-ai-serif text-[16.5px] leading-[1.7] text-foreground">
                        {fixMojibakeText(message.content)}
                      </p>
                      <AiTransferReceipt receipt={message.receipt} />
                      {speechSupported && (
                        <div className="flex items-center gap-1 pt-1">
                          <button
                            type="button"
                            onClick={() => speakMessage(message.id, message.content)}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                              speakingMessageId === message.id
                                ? "bg-paypal-blue/15 text-paypal-blue"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                            aria-label={speakingMessageId === message.id ? "Stop listening" : "Listen to response"}
                            title={speakingMessageId === message.id ? "Stop" : "Listen"}
                          >
                            {speakingMessageId === message.id ? (
                              <Square className="h-3.5 w-3.5 fill-current" />
                            ) : (
                              <Volume2 className="h-3.5 w-3.5" />
                            )}
                            <span>{speakingMessageId === message.id ? "Stop" : "Listen"}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div key={message.id} className="w-full space-y-2">
                      <div className="chat-md font-ai-serif">{renderChatMarkdown(message.content)}</div>
                      {speechSupported && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => speakMessage(message.id, message.content)}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                              speakingMessageId === message.id
                                ? "bg-paypal-blue/15 text-paypal-blue"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                            aria-label={speakingMessageId === message.id ? "Stop listening" : "Listen to response"}
                            title={speakingMessageId === message.id ? "Stop" : "Listen"}
                          >
                            {speakingMessageId === message.id ? (
                              <Square className="h-3.5 w-3.5 fill-current" />
                            ) : (
                              <Volume2 className="h-3.5 w-3.5" />
                            )}
                            <span>{speakingMessageId === message.id ? "Stop" : "Listen"}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )
                )}

                {isTyping && (
                  <div className="flex items-center gap-2 py-1 font-ai-sans text-sm text-muted-foreground">
                    <BrandLogo className="h-5 w-5" animate={false} />
                    <span>OpenPay AI is thinking</span>
                    <span className="inline-flex gap-1">
                      <span className="h-1 w-1 animate-bounce rounded-full bg-foreground/35 [animation-delay:0ms]" />
                      <span className="h-1 w-1 animate-bounce rounded-full bg-foreground/35 [animation-delay:150ms]" />
                      <span className="h-1 w-1 animate-bounce rounded-full bg-foreground/35 [animation-delay:300ms]" />
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* Composer — Claude flat border style */}
        <div className="shrink-0 bg-gradient-to-t from-[#F4F1EA] via-[#F4F1EA] to-transparent px-4 pb-4 pt-1 dark:from-black dark:via-black sm:px-6">
          <div className="mx-auto max-w-[48rem]">
            <div className="rounded-2xl border border-[#E5E0D6] bg-card dark:border-white/10 dark:bg-[#0a0a0a]">
              <div className="flex items-end gap-1 p-2 sm:p-2.5">
                <button
                  type="button"
                  onClick={() => setShowQuickMenu(true)}
                  className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground/55 transition hover:bg-muted"
                  aria-label="Quick actions"
                  title="Quick actions (Ctrl+K)"
                >
                  <MenuIcon className="h-5 w-5" />
                </button>
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => {
                    setInputMessage(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Message OpenPay AI..."
                  disabled={isTyping}
                  rows={1}
                  className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-1 py-2.5 font-ai-sans text-[15px] text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={isTyping || !inputMessage.trim()}
                  size="icon"
                  className="mb-0.5 h-10 w-10 shrink-0 rounded-full bg-paypal-blue text-white hover:bg-[#004dc5] disabled:bg-muted disabled:text-muted-foreground"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="mt-2.5 text-center font-ai-sans text-[11px] text-muted-foreground">
              OpenPay AI can make mistakes. Please double-check responses. Payments always need confirmation.
            </p>
          </div>
        </div>
      </div>

      {/* Insights panel */}
      <Dialog open={showInsightsPanel} onOpenChange={setShowInsightsPanel}>
        <DialogContent className="z-[200] max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-paypal-blue" />
              Financial insights
            </DialogTitle>
            <DialogDescription>
              Live snapshot of your balance, forecast, and recommendations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {greeting && (
              <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                {greeting}
              </div>
            )}

            <div className="rounded-xl border border-border/70 bg-white p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Brain className="h-4 w-4 text-paypal-blue" />
                Smart insights
              </div>
              <div className="space-y-2">
                {insights.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No insights yet.</p>
                ) : (
                  insights.map((insight, index) => (
                    <div key={index} className="rounded-lg bg-muted/50 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium">{insight.title}</p>
                          <p className="text-xs text-muted-foreground">{insight.description}</p>
                        </div>
                        {insight.value && (
                          <p className="shrink-0 text-sm font-semibold">{insight.value}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {balancePrediction && (
              <div className="rounded-xl border border-border/70 bg-white p-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Target className="h-4 w-4 text-paypal-blue" />
                  Balance forecast
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted-foreground">7 days</span>
                      <span className="font-semibold">${balancePrediction.predicted_7_days.toFixed(2)}</span>
                    </div>
                    <Progress
                      value={Math.max(
                        0,
                        (balancePrediction.predicted_7_days / Math.max(balancePrediction.current_balance, 1)) * 100
                      )}
                      className="h-2"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted-foreground">30 days</span>
                      <span className="font-semibold">${balancePrediction.predicted_30_days.toFixed(2)}</span>
                    </div>
                    <Progress
                      value={Math.max(
                        0,
                        (balancePrediction.predicted_30_days / Math.max(balancePrediction.current_balance, 1)) * 100
                      )}
                      className="h-2"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Confidence: {Math.round(balancePrediction.confidence * 100)}%
                  </p>
                </div>
              </div>
            )}

            {recommendations.length > 0 && (
              <div className="rounded-xl border border-border/70 bg-white p-3 dark:bg-card">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  Recommendations
                </div>
                <div className="space-y-2">
                  {recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="rounded-lg border border-amber-200/80 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-amber-950 dark:text-amber-100">{rec.title}</p>
                        {rec.priority === "high" && (
                          <span className="shrink-0 rounded bg-amber-600/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
                            Priority
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-amber-900/90 dark:text-amber-100/80">
                        {rec.description}
                      </p>
                      {rec.estimated_impact && (
                        <p className="mt-1 text-[11px] text-amber-800/70 dark:text-amber-200/70">
                          Impact: {rec.estimated_impact}
                        </p>
                      )}
                      {rec.actionable && (
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-md bg-amber-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                            onClick={() => handleRecommendationAction(rec)}
                          >
                            {rec.action_text}
                          </button>
                          {rec.prompt && rec.route && (
                            <button
                              type="button"
                              className="rounded-md border border-amber-300 bg-white/70 px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-white dark:border-amber-500/40 dark:bg-transparent dark:text-amber-100"
                              onClick={() => {
                                setShowInsightsPanel(false);
                                handleSuggestionClick(rec.prompt!);
                              }}
                            >
                              Ask AI
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {budgetAlerts.length > 0 && (
              <div className="rounded-xl border border-border/70 bg-white p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Budget alerts
                </div>
                <div className="space-y-2">
                  {budgetAlerts.map((alert, index) => (
                    <Alert key={index} className="p-2">
                      <AlertDescription className="text-xs">
                        <strong>{alert.category}</strong>: ${alert.spent.toFixed(2)} / ${alert.limit.toFixed(2)} (
                        {alert.percentage.toFixed(0)}%)
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <McpConnectionsDialog open={showMcpDialog} onOpenChange={setShowMcpDialog} />

      {/* Quick Actions Dialog */}
      <Dialog open={showQuickMenu} onOpenChange={setShowQuickMenu}>
        <DialogContent className="z-[200] mx-auto max-h-[80vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MenuIcon className="h-5 w-5" />
              Quick actions
            </DialogTitle>
            <DialogDescription>Pick a prompt to fill the composer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="mb-3 text-sm font-semibold text-paypal-blue">Quick AI questions</h4>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { label: "Smart Balance", desc: "View balance with AI predictions", prompt: "What's my current balance and spending forecast?", icon: Wallet },
                  { label: "Spending Analysis", desc: "AI-powered insights", prompt: "Analyze my spending patterns and suggest optimizations", icon: PieChart },
                  { label: "Health Score", desc: "Financial wellness check", prompt: "What's my financial health score?", icon: Target },
                  { label: "AI Advice", desc: "Personalized recommendations", prompt: "Give me personalized financial advice", icon: Brain },
                ].map((item) => (
                  <Button
                    key={item.label}
                    variant="outline"
                    className="h-auto justify-start p-3"
                    onClick={() => {
                      handleSuggestionClick(item.prompt);
                      setShowQuickMenu(false);
                    }}
                  >
                    <item.icon className="mr-3 h-4 w-4" />
                    <div className="text-left">
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-semibold text-paypal-blue">Banking</h4>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { label: "Smart Send", desc: "AI-powered transfers", prompt: "Send $50 to @wain", icon: Send },
                  { label: "Smart Top-up", desc: "Optimized funding options", prompt: "What's best way to top up my account?", icon: CreditCard },
                  { label: "Smart History", desc: "AI-categorized transactions", prompt: "Show me my transaction history with insights", icon: History },
                ].map((item) => (
                  <Button
                    key={item.label}
                    variant="outline"
                    className="h-auto justify-start p-3"
                    onClick={() => {
                      handleSuggestionClick(item.prompt);
                      setShowQuickMenu(false);
                    }}
                  >
                    <item.icon className="mr-3 h-4 w-4" />
                    <div className="text-left">
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-semibold text-paypal-blue">Business & security</h4>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { label: "Merchant Optimization", desc: "AI sales recommendations", prompt: "How do I optimize my merchant account for better sales?", icon: Store },
                  { label: "Smart Links", desc: "AI-optimized payments", prompt: "Create optimized payment links for my business", icon: ArrowLeftRight },
                  { label: "Security Audit", desc: "AI security analysis", prompt: "Analyze my account security and suggest improvements", icon: Shield },
                  { label: "KYC Assistant", desc: "AI verification help", prompt: "Guide me through KYC verification step by step", icon: CheckCircle },
                ].map((item) => (
                  <Button
                    key={item.label}
                    variant="outline"
                    className="h-auto justify-start p-3"
                    onClick={() => {
                      handleSuggestionClick(item.prompt);
                      setShowQuickMenu(false);
                    }}
                  >
                    <item.icon className="mr-3 h-4 w-4" />
                    <div className="text-left">
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enhanced Payment Confirmation Dialog */}
      <Dialog open={showPaymentConfirm} onOpenChange={setShowPaymentConfirm}>
        <DialogContent className="z-[200] mx-auto max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm transfer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                This sends from your signed-in OpenPay wallet (same secure path as Express Send). The transfer posts to OpenLedger.
              </AlertDescription>
            </Alert>

            {pendingPayment && (
              <div className="space-y-3 rounded-lg bg-gray-50 p-4">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Recipient:</span>
                  <span className="font-semibold">@{pendingPayment.recipient}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Amount:</span>
                  <span className="font-semibold">${pendingPayment.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">From:</span>
                  <span className="font-semibold">{userProfile?.account_number || "Your wallet"}</span>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPaymentConfirm(false);
                  setPendingPayment(null);
                  setPendingSendRecipient(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={handleConfirmPayment} className="flex-1 bg-paypal-blue hover:bg-[#004dc5]">
                Confirm & Send
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OpenPayAIPage;
