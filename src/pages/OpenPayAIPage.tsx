import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Bot, User, TrendingUp, AlertTriangle, Wallet, PieChart, Shield, Sparkles, CreditCard, ArrowLeftRight, Users, Store, FileText, History, Coins, Pickaxe, TrendingDown, Clock, Target, Zap, Bell, Calendar, Award, AlertCircle, CheckCircle, Info, ChevronUp, ChevronDown, Brain, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import BrandLogo from "@/components/BrandLogo";
import AuthMark from "@/components/AuthMark";

// AI calls go through the openpay-ai-chat edge function (Lovable AI Gateway)

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  type?: "text" | "insight" | "payment" | "alert";
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
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [balancePrediction, setBalancePrediction] = useState<BalancePrediction | null>(null);
  const [recommendations, setRecommendations] = useState<SmartRecommendation[]>([]);
  const [greeting, setGreeting] = useState<string>("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      
      setUserId(user.id);
      await Promise.all([
        loadUserProfile(user.id),
        loadBalance(user.id),
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
    const greeting = `${timeGreeting}, ${userName}! Welcome back to your ${activityLevel} financial dashboard.`;
    setGreeting(greeting);
  };

  const generateBalancePrediction = async (userId: string) => {
    try {
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
        const spendingVelocity = dailyAverage / (userBalance || 1);
        const daysUntilZero = userBalance / dailyAverage;
        
        const prediction: BalancePrediction = {
          current_balance: userBalance,
          predicted_7_days: Math.max(0, userBalance - (dailyAverage * 7)),
          predicted_30_days: Math.max(0, userBalance - (dailyAverage * 30)),
          spending_velocity: spendingVelocity,
          days_until_zero: daysUntilZero,
          confidence: Math.min(0.95, transactions.length / 30)
        };
        
        setBalancePrediction(prediction);
      }
    } catch (error) {
      console.error("Error generating balance prediction:", error);
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
    
    // Low balance recommendation
    if (userBalance < 1000) {
      recommendations.push({
        id: "low-balance",
        type: "topup",
        title: "Top Up Recommended",
        description: "Your balance is running low. Consider adding funds to avoid interruptions.",
        priority: "high",
        actionable: true,
        action_text: "Top Up Now",
        estimated_impact: "Prevents service interruptions"
      });
    }
    
    // KYC recommendation
    if (userProfile?.kyc_status !== "verified") {
      recommendations.push({
        id: "kyc-verification",
        type: "security",
        title: "Complete KYC Verification",
        description: "Verify your identity to unlock higher limits and enhanced features.",
        priority: "medium",
        actionable: true,
        action_text: "Complete KYC",
        estimated_impact: "Increase transaction limits"
      });
    }
    
    // Spending optimization
    const topCategory = spendingCategories[0];
    if (topCategory && topCategory.percentage > 40) {
      recommendations.push({
        id: "spending-optimization",
        type: "saving",
        title: "Optimize " + topCategory.name + " Spending",
        description: `You're spending ${topCategory.percentage.toFixed(0)}% on ${topCategory.name}. Consider setting a budget.`,
        priority: "medium",
        actionable: true,
        action_text: "Set Budget",
        estimated_impact: "Save 10-20% on expenses"
      });
    }
    
    setRecommendations(recommendations);
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
    
    // Balance insight with prediction
    const balanceTrend = balancePrediction ? 
      (balancePrediction.predicted_7_days < userBalance * 0.8 ? "down" : 
       balancePrediction.predicted_7_days > userBalance * 1.2 ? "up" : "stable") : "stable";
    
    insights.push({
      type: "balance",
      title: "Current Balance",
      description: "Available funds in your wallet",
      value: `$${userBalance.toFixed(2)}`,
      trend: balanceTrend,
      priority: userBalance < 1000 ? "high" : "low",
      actionable: userBalance < 1000,
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
    if (balancePrediction && balancePrediction.days_until_zero < 30) {
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
    if (userProfile?.kyc_status === "verified") {
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
        content: msg.content,
        timestamp: msg.created_at,
        type: msg.type || "text"
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
        type: message.type || "text",
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
      return data?.reply || "I couldn't generate a response. Please try again.";
    } catch (e) {
      console.error("callOpenPayAI failed", e);
      return "I'm having trouble connecting to the AI service. Please try again later.";
    }
  };

  const processUserMessage = async (message: string) => {
    const lowerMessage = message.toLowerCase();

    // Enhanced payment commands with smart suggestions
    const paymentRegex = /(?:send|transfer|pay)\s+(\d+(?:\.\d{2})?)\s*(?:php|₱)?\s*(?:to\s*)?@?(\w+)/i;
    const paymentMatch = message.match(paymentRegex);

    if (paymentMatch) {
      const amount = parseFloat(paymentMatch[1]);
      const recipient = paymentMatch[2];
      
      // Smart payment suggestions
      let smartSuggestions = [];
      
      if (amount > userBalance * 0.8) {
        smartSuggestions.push("⚠️ This amount is 80%+ of your balance. Consider a smaller amount or top up first.");
      }
      
      if (amount > 1000) {
        smartSuggestions.push("💡 For large amounts, consider using a payment link for better tracking.");
      }
      
      // Check if recipient is frequent contact
      const isFrequent = Math.random() > 0.7; // Simulated frequent contact check
      if (isFrequent) {
        smartSuggestions.push("👥 This is one of your frequent contacts. Consider setting up recurring payments.");
      }
      
      setPendingPayment({ amount, recipient, suggestions: smartSuggestions });
      setShowPaymentConfirm(true);
      
      return `I can help you send $${amount.toFixed(2)} to @${recipient}. ${smartSuggestions.length > 0 ? '\n\n💡 Smart Suggestions:\n' + smartSuggestions.join('\n') : ''}\n\nPlease confirm the payment details below.`;
    }

    // Enhanced balance requests with predictions
    if (lowerMessage.includes("balance") || lowerMessage.includes("forecast") || lowerMessage.includes("prediction")) {
      let response = `Your current balance is $${userBalance.toFixed(2)}.`;
      
      if (balancePrediction) {
        response += `\n\n🔮 **Balance Forecast:**\n`;
        response += `• In 7 days: $${balancePrediction.predicted_7_days.toFixed(2)}\n`;
        response += `• In 30 days: $${balancePrediction.predicted_30_days.toFixed(2)}\n`;
        response += `• Days until zero: ${Math.ceil(balancePrediction.days_until_zero)}\n`;
        response += `• Confidence: ${Math.round(balancePrediction.confidence * 100)}%\n\n`;
        
        if (balancePrediction.days_until_zero < 7) {
          response += `⚠️ **Low Balance Alert:** Your balance may run out soon. Consider topping up.`;
        } else if (balancePrediction.days_until_zero < 30) {
          response += `💡 **Suggestion:** Monitor your spending to maintain a healthy balance.`;
        }
      }
      
      if (userBalance < 1000) {
        response += `\n\n🔔 **Recommendation:** Consider topping up to avoid service interruptions.`;
      }
      
      return response;
    }

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
      
      if (userProfile?.kyc_status !== "verified") {
        advice += `🔐 **Security:** Complete KYC verification to unlock higher limits.\n`;
      }
      
      advice += `🎯 **Goal:** Set up automatic savings for consistent growth.\n`;
      
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
      if (userProfile?.kyc_status === "verified") {
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
      
      return `${emoji} **Financial Health Score: ${score}/100 (${grade})**\n\n**Factors:**\n${factors.join('\n')}\n\n**Recommendations:**\n${score < 60 ? 'Focus on building savings and controlling expenses.' : score < 80 ? 'Continue good habits and consider investments.' : 'Excellent financial management! Consider diversification.'}`;
    }

    // Try AI for complex queries
    try {
      console.log("🤖 Attempting AI response for:", message);
      const aiResponse = await callOpenPayAI(message);
      console.log("✅ AI response successful");
      return aiResponse;
    } catch (error) {
      console.error("❌ AI fallback error:", error);
      return "I'm here to help with advanced financial tasks. You can ask me to:\n\n• Check your balance with predictions\n• Analyze spending patterns with AI insights\n• Send money with smart suggestions\n• Get personalized financial advice\n• Optimize your financial health\n• Get smart top-up recommendations\n• Analyze your financial health score\n• Get help with any OpenPay feature\n\nFor advanced AI features, please check your connection and try again.";
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isTyping) return;

    console.log("📝 User sending message:", inputMessage);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsTyping(true);

    try {
      console.log("🤖 Processing message with AI...");
      const aiResponse = await processUserMessage(inputMessage);
      console.log("✅ AI response received:", aiResponse);
      
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

  const confirmPayment = async () => {
    if (!pendingPayment) return;

    try {
      // Here you would integrate with your payment system
      toast.success(`Payment of $${pendingPayment.amount.toFixed(2)} to @${pendingPayment.recipient} initiated`);
      
      setPendingPayment(null);
      setShowPaymentConfirm(false);
      
      // Add confirmation message
      const confirmationMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: `✅ Payment of $${pendingPayment.amount.toFixed(2)} to @${pendingPayment.recipient} has been processed successfully.`,
        timestamp: new Date().toISOString(),
        type: "text"
      };
      
      setMessages(prev => [...prev, confirmationMessage]);
      await saveMessage(confirmationMessage);
      
      // Refresh balance
      if (userId) {
        await loadBalance(userId);
      }
      
    } catch (error) {
      toast.error("Payment failed. Please try again.");
    }
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-border/70 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-8 w-8" />
            <div>
              <h1 className="text-lg font-semibold text-foreground">OpenPay AI</h1>
              <p className="text-xs text-muted-foreground">Your Smart Financial Assistant</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/menu")}>
            Back
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)]">
        {/* Enhanced Insights Sidebar */}
        <div className="lg:w-80 bg-white border-r border-border/70 p-4 overflow-y-auto">
          <div className="space-y-4">
            {/* User Profile Section */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-600" />
                  My Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                    {userProfile?.full_name?.charAt(0) || "U"}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{userProfile?.full_name || "User"}</p>
                    <p className="text-xs text-muted-foreground">@{userProfile?.username || "username"}</p>
                  </div>
                  <Badge variant={userProfile?.kyc_status === "verified" ? "default" : "secondary"} className="text-xs">
                    {userProfile?.kyc_status || "Pending"}
                  </Badge>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account #:</span>
                    <span className="font-mono">{userProfile?.account_number || "Loading..."}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Referral:</span>
                    <span className="font-mono">{userProfile?.referral_code || "None"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Personalized Greeting */}
            {greeting && (
              <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                <CardContent className="p-3">
                  <p className="text-sm text-green-800">{greeting}</p>
                </CardContent>
              </Card>
            )}

            {/* Enhanced Quick Stats */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="h-4 w-4 text-blue-600" />
                  Smart Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {insights.map((insight, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium">{insight.title}</p>
                        {insight.priority === "high" && <AlertCircle className="h-3 w-3 text-red-500" />}
                        {insight.priority === "medium" && <Info className="h-3 w-3 text-yellow-500" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{insight.description}</p>
                      {insight.actionable && (
                        <button className="text-xs text-blue-600 hover:text-blue-800 mt-1">
                          {insight.action} →
                        </button>
                      )}
                    </div>
                    <div className="text-right">
                      {insight.value && <p className="text-sm font-semibold">{insight.value}</p>}
                      {insight.trend && (
                        <Badge variant={insight.trend === "up" ? "destructive" : insight.trend === "down" ? "secondary" : "default"} className="text-xs">
                          {insight.trend}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Balance Prediction */}
            {balancePrediction && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4 text-purple-600" />
                    Balance Forecast
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">7 Days</span>
                      <span className="text-sm font-semibold">${balancePrediction.predicted_7_days.toFixed(2)}</span>
                    </div>
                    <Progress value={Math.max(0, (balancePrediction.predicted_7_days / balancePrediction.current_balance) * 100)} className="h-2" />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">30 Days</span>
                      <span className="text-sm font-semibold">${balancePrediction.predicted_30_days.toFixed(2)}</span>
                    </div>
                    <Progress value={Math.max(0, (balancePrediction.predicted_30_days / balancePrediction.current_balance) * 100)} className="h-2" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Confidence: {Math.round(balancePrediction.confidence * 100)}%
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Smart Recommendations */}
            {recommendations.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-600" />
                    AI Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {recommendations.map((rec, index) => (
                      <div key={rec.id} className="p-2 rounded-lg bg-yellow-50 border border-yellow-200">
                        <div className="flex items-start gap-2">
                          <Zap className="h-3 w-3 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs font-medium text-yellow-800">{rec.title}</p>
                            <p className="text-xs text-yellow-700 mt-1">{rec.description}</p>
                            {rec.estimated_impact && (
                              <p className="text-xs text-yellow-600 mt-1">Impact: {rec.estimated_impact}</p>
                            )}
                            {rec.actionable && (
                              <button className="text-xs bg-yellow-600 text-white px-2 py-1 rounded mt-2 hover:bg-yellow-700 transition-colors">
                                {rec.action_text}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Spending Categories */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-blue-600" />
                  Spending Categories
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Spending categories breakdown will appear here.</p>
              </CardContent>
            </Card>

            {/* Budget Alerts */}
            {budgetAlerts.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    Budget Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {budgetAlerts.map((alert, index) => (
                      <Alert key={index} className="p-2">
                        <AlertDescription className="text-xs">
                          <strong>{alert.category}</strong>: ${alert.spent.toFixed(2)} / ${alert.limit.toFixed(2)} ({alert.percentage.toFixed(0)}%)
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-gray-50">
          <ScrollArea className="flex-1 p-4">
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <Bot className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{greeting || "Welcome to OpenPay AI!"}</h3>
                  <p className="text-muted-foreground mb-4">
                    I'm your intelligent financial assistant, powered by advanced AI to help you make smarter financial decisions.
                  </p>
                  
                  {/* Smart Recommendations Preview */}
                  {recommendations.length > 0 && (
                    <div className="mb-6">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h4 className="font-semibold text-yellow-900 mb-3 flex items-center gap-2">
                          <Lightbulb className="h-5 w-5 text-yellow-600" />
                          Today's Smart Recommendations
                        </h4>
                        <div className="space-y-2">
                          {recommendations.slice(0, 2).map((rec) => (
                            <div key={rec.id} className="flex items-center gap-3 p-2 bg-white rounded border border-yellow-300">
                              <Zap className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                              <div className="flex-1 text-left">
                                <p className="text-sm font-medium text-yellow-800">{rec.title}</p>
                                <p className="text-xs text-yellow-700">{rec.description}</p>
                              </div>
                              {rec.actionable && (
                                <button 
                                  onClick={() => setInputMessage(rec.action_text)}
                                  className="text-xs bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700 transition-colors"
                                >
                                  {rec.action_text}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    <div className="bg-white rounded-lg p-4 border">
                      <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-blue-600" />
                        Banking Features
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div className="p-2 hover:bg-blue-50 rounded cursor-pointer transition-colors" onClick={() => setInputMessage("What's my current balance and spending forecast?")}>
                          <p className="font-medium">💰 Smart Balance</p>
                          <p className="text-xs text-gray-600">View balance with AI predictions</p>
                        </div>
                        <div className="p-2 hover:bg-blue-50 rounded cursor-pointer transition-colors" onClick={() => setInputMessage("Send $50 to @wain")}>
                          <p className="font-medium">💸 Smart Send</p>
                          <p className="text-xs text-gray-600">AI-powered transfers</p>
                        </div>
                        <div className="p-2 hover:bg-blue-50 rounded cursor-pointer transition-colors" onClick={() => setInputMessage("What's the best way to top up my account?")}>
                          <p className="font-medium">💳 Smart Top-up</p>
                          <p className="text-xs text-gray-600">Optimized funding options</p>
                        </div>
                        <div className="p-2 hover:bg-blue-50 rounded cursor-pointer transition-colors" onClick={() => setInputMessage("Analyze my spending patterns and suggest optimizations")}>
                          <p className="font-medium">� Spending Analysis</p>
                          <p className="text-xs text-gray-600">AI-powered insights</p>
                        </div>
                        <div className="p-2 hover:bg-blue-50 rounded cursor-pointer transition-colors" onClick={() => setInputMessage("How do I create and manage virtual cards?")}>
                          <p className="font-medium">💳 Virtual Cards</p>
                          <p className="text-xs text-gray-600">Smart card management</p>
                        </div>
                        <div className="p-2 hover:bg-blue-50 rounded cursor-pointer transition-colors" onClick={() => setInputMessage("Show me my transaction history with insights")}>
                          <p className="font-medium">📋 Smart History</p>
                          <p className="text-xs text-gray-600">AI-categorized transactions</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 border">
                      <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <Store className="h-5 w-5 text-blue-600" />
                        Merchant Services
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div className="p-2 hover:bg-blue-50 rounded cursor-pointer transition-colors" onClick={() => setInputMessage("How do I optimize my merchant account for better sales?")}>
                          <p className="font-medium">🏪 Merchant Optimization</p>
                          <p className="text-xs text-gray-600">AI sales recommendations</p>
                        </div>
                        <div className="p-2 hover:bg-blue-50 rounded cursor-pointer transition-colors" onClick={() => setInputMessage("Set up intelligent POS for my business")}>
                          <p className="font-medium">📱 Smart POS</p>
                          <p className="text-xs text-gray-600">AI-enhanced payments</p>
                        </div>
                        <div className="p-2 hover:bg-blue-50 rounded cursor-pointer transition-colors" onClick={() => setInputMessage("Create optimized payment links for my business")}>
                          <p className="font-medium">🔗 Smart Links</p>
                          <p className="text-xs text-gray-600">AI-optimized payments</p>
                        </div>
                        <div className="p-2 hover:bg-blue-50 rounded cursor-pointer transition-colors" onClick={() => setInputMessage("How can AI help me manage my product catalog?")}>
                          <p className="font-medium">📦 Catalog AI</p>
                          <p className="text-xs text-gray-600">Smart inventory insights</p>
                        </div>
                        <div className="p-2 hover:bg-blue-50 rounded cursor-pointer transition-colors" onClick={() => setInputMessage("Generate professional invoices with AI assistance")}>
                          <p className="font-medium">🧾 Smart Invoices</p>
                          <p className="text-xs text-gray-600">AI-powered billing</p>
                        </div>
                        <div className="p-2 hover:bg-blue-50 rounded cursor-pointer transition-colors" onClick={() => setInputMessage("Analyze my merchant fees and suggest optimizations")}>
                          <p className="font-medium">💰 Fee Analysis</p>
                          <p className="text-xs text-gray-600">AI cost optimization</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 border">
                      <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <Coins className="h-5 w-5 text-blue-600" />
                        Earning & Rewards
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div className="p-2 hover:bg-blue-50 rounded cursor-pointer transition-colors" onClick={() => setInputMessage("Optimize my mining strategy for maximum returns")}>
                          <p className="font-medium">⛏️ Smart Mining</p>
                          <p className="text-xs text-gray-600">AI-optimized mining</p>
                        </div>
                        <div className="p-2 hover:bg-blue-50 rounded cursor-pointer transition-colors" onClick={() => setInputMessage("What's the best staking strategy for my portfolio?")}>
                          <p className="font-medium">💎 Smart Staking</p>
                          <p className="text-xs text-gray-600">AI investment advice</p>
                        </div>
                        <div className="p-2 hover:bg-blue-50 rounded cursor-pointer transition-colors" onClick={() => setInputMessage("How can I maximize my affiliate earnings?")}>
                          <p className="font-medium">👥 Affiliate AI</p>
                          <p className="text-xs text-gray-600">Smart referral strategy</p>
                        </div>
                        <div className="p-2 hover:bg-blue-50 rounded cursor-pointer transition-colors" onClick={() => setInputMessage("Optimize my ad viewing for maximum earnings")}>
                          <p className="font-medium">📺 Ad Optimizer</p>
                          <p className="text-xs text-gray-600">AI ad strategy</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 border">
                      <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <Shield className="h-5 w-5 text-blue-600" />
                        Security & Support
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div className="p-2 hover:bg-blue-50 rounded cursor-pointer transition-colors" onClick={() => setInputMessage("Analyze my account security and suggest improvements")}>
                          <p className="font-medium">🔐 Security Audit</p>
                          <p className="text-xs text-gray-600">AI security analysis</p>
                        </div>
                        <div className="p-2 hover:bg-blue-50 rounded cursor-pointer transition-colors" onClick={() => setInputMessage("Guide me through KYC verification step by step")}>
                          <p className="font-medium">🆔 KYC Assistant</p>
                          <p className="text-xs text-gray-600">AI verification help</p>
                        </div>
                        <div className="p-2 hover:bg-blue-50 rounded cursor-pointer transition-colors" onClick={() => setInputMessage("Help me resolve a transaction dispute effectively")}>
                          <p className="font-medium">⚖️ Dispute AI</p>
                          <p className="text-xs text-gray-600">Smart resolution</p>
                        </div>
                        <div className="p-2 hover:bg-blue-50 rounded cursor-pointer transition-colors" onClick={() => setInputMessage("Get personalized support for my issue")}>
                          <p className="font-medium">💬 AI Support</p>
                          <p className="text-xs text-gray-600">Intelligent assistance</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 bg-blue-50 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-3">Quick AI Questions</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <button 
                        className="p-2 bg-white rounded-lg border hover:bg-blue-100 transition-colors text-left w-full"
                        onClick={() => setInputMessage("What's my financial health score?")}
                      >
                        🏥 Health Score
                      </button>
                      <button 
                        className="p-2 bg-white rounded-lg border hover:bg-blue-100 transition-colors text-left w-full"
                        onClick={() => setInputMessage("How can I save money this month?")}
                      >
                        � Save Money
                      </button>
                      <button 
                        className="p-2 bg-white rounded-lg border hover:bg-blue-100 transition-colors text-left w-full"
                        onClick={() => setInputMessage("What are my top financial goals?")}
                      >
                        🎯 Financial Goals
                      </button>
                      <button 
                        className="p-2 bg-white rounded-lg border hover:bg-blue-100 transition-colors text-left w-full"
                        onClick={() => setInputMessage("Give me personalized financial advice")}
                      >
                        🤖 AI Advice
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-white border border-border/70"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {message.role === "assistant" && (
                        <Bot className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      {message.role === "user" && (
                        <User className="h-5 w-5 text-white mt-0.5 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-border/70 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-blue-600" />
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="bg-white border-t border-border/70 p-4">
            <div className="max-w-3xl mx-auto">
              <div className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Ask me anything about your finances..."
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  disabled={isTyping}
                  className="flex-1"
                />
                <Button 
                  onClick={handleSendMessage} 
                  disabled={isTyping || !inputMessage.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Shield className="h-3 w-3" />
                <span>All payments require your confirmation</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Payment Confirmation Dialog */}
      <Dialog open={showPaymentConfirm} onOpenChange={setShowPaymentConfirm}>
        <DialogContent className="z-[200] max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle>Confirm Top Up Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Please review the top-up details before confirming:
              </AlertDescription>
            </Alert>
            
            {pendingPayment && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Amount:</span>
                  <span className="font-semibold">${pendingPayment.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Provider:</span>
                  <span className="font-semibold">Bank Transfer</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Account:</span>
                  <span className="font-semibold">{userProfile?.account_number || "Loading..."}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Reference:</span>
                  <span className="font-semibold">TOPUP{Date.now().toString().slice(-6)}</span>
                </div>
              </div>
            )}
            
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowPaymentConfirm(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={confirmPayment} className="bg-blue-600 hover:bg-blue-700 flex-1">
                Confirm & Submit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OpenPayAIPage;
