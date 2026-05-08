import { useEffect, useState, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Plus, 
  Smartphone, 
  DollarSign, 
  Users, 
  TrendingUp, 
  Settings, 
  Copy, 
  Eye, 
  EyeOff, 
  Calendar,
  CreditCard,
  BarChart3,
  Link,
  Trash2,
  Edit,
  Upload,
  X
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

type App = {
  id: string;
  app_name: string;
  app_description: string;
  app_url: string;
  app_logo_url: string;
  app_secret_key: string;
  app_public_key: string;
  webhook_url: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type PaymentPlan = {
  id: string;
  app_id: string;
  plan_name: string;
  plan_description: string;
  plan_type: string;
  amount: number;
  currency: string;
  trial_days: number;
  setup_fee: number;
  is_active: boolean;
  created_at: string;
};

type PaymentLink = {
  id: string;
  app_id: string;
  plan_id: string;
  link_token: string;
  link_name: string;
  link_description: string;
  redirect_url: string;
  is_active: boolean;
  usage_count: number;
  max_usage: number;
  expires_at: string;
  created_at: string;
  payment_url: string;
};

type Analytics = {
  total_revenue: number;
  total_transactions: number;
  new_subscriptions: number;
  canceled_subscriptions: number;
  active_subscriptions: number;
  refunds: number;
  refund_count: number;
};

// Helper functions
const copyToClipboard = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  } catch {
    toast.error("Failed to copy");
  }
};

const AppDeveloperDashboardPage = () => {
  const navigate = useNavigate();
  const [apps, setApps] = useState<App[]>([]);
  const [selectedApp, setSelectedApp] = useState<App | null>(null);
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [showCreateApp, setShowCreateApp] = useState(false);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showCreateLink, setShowCreateLink] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState(false);

  // Form states
  const [newApp, setNewApp] = useState({ name: "", description: "", url: "", logo_url: "", webhook_url: "" });
  const [newPlan, setNewPlan] = useState({ name: "", description: "", type: "one_time", amount: "", currency: "USD", trial_days: "0", setup_fee: "0" });
  const [newLink, setNewLink] = useState({ name: "", description: "", plan_id: "", redirect_url: "", max_usage: "", expires_at: "" });

  const [processing, setProcessing] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showPublicKey, setShowPublicKey] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    loadApps();
  }, []);

  useEffect(() => {
    if (selectedApp) {
      loadPlans();
      loadPaymentLinks();
      loadAnalytics();
    }
  }, [selectedApp]);

  const loadApps = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/app-payments/get-apps`, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        setApps(result.data);
      }
    } catch (error) {
      toast.error("Failed to load apps");
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    if (!selectedApp) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/app-payments/get-plans?app_id=${selectedApp.id}`, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        setPlans(result.data);
      }
    } catch (error) {
      toast.error("Failed to load plans");
    }
  };

  const loadPaymentLinks = async () => {
    // This would need to be implemented in the API
    // For now, we'll use mock data
    setPaymentLinks([]);
  };

  const loadAnalytics = async () => {
    if (!selectedApp) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/app-payments/get-analytics?app_id=${selectedApp.id}`, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        setAnalytics(result.data.totals);
      }
    } catch (error) {
      toast.error("Failed to load analytics");
    }
  };

  const createApp = async () => {
    if (!newApp.name.trim()) {
      toast.error("App name is required");
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/app-payments/create-app`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(newApp)
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success("App created successfully");
        setShowCreateApp(false);
        setNewApp({ name: "", description: "", url: "", logo_url: "", webhook_url: "" });
        loadApps();
      } else {
        toast.error(result.error || "Failed to create app");
      }
    } catch (error) {
      toast.error("Failed to create app");
    } finally {
      setProcessing(false);
    }
  };

  const createPlan = async () => {
    if (!newPlan.name.trim() || !newPlan.amount || !selectedApp) {
      toast.error("Plan name and amount are required");
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/app-payments/create-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          ...newPlan,
          app_id: selectedApp.id,
          amount: parseFloat(newPlan.amount),
          trial_days: parseInt(newPlan.trial_days),
          setup_fee: parseFloat(newPlan.setup_fee)
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success("Plan created successfully");
        setShowCreatePlan(false);
        setNewPlan({ name: "", description: "", type: "one_time", amount: "", currency: "USD", trial_days: "0", setup_fee: "0" });
        loadPlans();
      } else {
        toast.error(result.error || "Failed to create plan");
      }
    } catch (error) {
      toast.error("Failed to create plan");
    } finally {
      setProcessing(false);
    }
  };

  
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setUploadingLogo(true);
    
    try {
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `app-logo-${Date.now()}.${fileExt}`;
      
      // For now, we'll create a local URL using FileReader
      // In production, you'd upload to a storage service
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setNewApp({ ...newApp, logo_url: dataUrl });
        toast.success("Logo uploaded successfully");
      };
      reader.onerror = () => {
        toast.error("Failed to read image file");
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error("Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const getPlanIcon = (planType: string) => {
    switch (planType) {
      case 'one_time':
        return <DollarSign className="h-4 w-4" />;
      case 'recurring_monthly':
        return <Calendar className="h-4 w-4" />;
      case 'recurring_yearly':
        return <Calendar className="h-4 w-4" />;
      default:
        return <CreditCard className="h-4 w-4" />;
    }
  };

  const getPlanLabel = (planType: string) => {
    switch (planType) {
      case 'one_time':
        return 'One-time';
      case 'recurring_monthly':
        return 'Monthly';
      case 'recurring_yearly':
        return 'Yearly';
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-paypal-blue border-t-paypal-blue animate-spin" />
          <p className="mt-4 text-lg font-medium text-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-14 items-center border-b border-border bg-card px-4">
        <button onClick={() => navigate("/menu")} className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-secondary" aria-label="Back">
          <Settings className="h-5 w-5 text-foreground" />
        </button>
        <div className="mx-3 h-7 w-px bg-border" />
        <p className="flex items-center gap-2 text-xl font-medium text-foreground">
          <Smartphone className="h-5 w-5" />
          App Developer Dashboard
        </p>
        <Button
          onClick={() => setShowCreateApp(true)}
          className="ml-auto h-9 rounded-full bg-paypal-blue text-white hover:bg-[#004dc5]"
        >
          <Plus className="mr-2 h-4 w-4" />
          New App
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-6">
        {/* Apps Sidebar */}
        <div className="lg:col-span-1">
          <h3 className="mb-4 text-lg font-semibold text-foreground">My Apps</h3>
          <div className="space-y-2">
            {apps.map((app) => (
              <button
                key={app.id}
                onClick={() => setSelectedApp(app)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selectedApp?.id === app.id
                    ? "border-paypal-blue bg-paypal-blue/10"
                    : "border-border hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-3">
                  {app.app_logo_url ? (
                    <img src={app.app_logo_url} alt={app.app_name} className="h-10 w-10 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-paypal-blue/20 text-paypal-blue">
                      <Smartphone className="h-5 w-5" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{app.app_name}</p>
                    <p className="text-xs text-muted-foreground">{app.status}</p>
                  </div>
                </div>
              </button>
            ))}
            {apps.length === 0 && (
              <div className="text-center py-8">
                <Smartphone className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No apps yet</p>
                <Button
                  onClick={() => setShowCreateApp(true)}
                  variant="outline"
                  className="mt-2"
                >
                  Create your first app
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {selectedApp ? (
            <div className="space-y-6">
              {/* App Header */}
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    {selectedApp.app_logo_url ? (
                      <img src={selectedApp.app_logo_url} alt={selectedApp.app_name} className="h-16 w-16 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-paypal-blue/20 text-paypal-blue">
                        <Smartphone className="h-8 w-8" />
                      </div>
                    )}
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">{selectedApp.app_name}</h2>
                      <p className="text-sm text-muted-foreground">{selectedApp.app_description}</p>
                      {selectedApp.app_url && (
                        <a href={selectedApp.app_url} target="_blank" rel="noopener noreferrer" className="text-sm text-paypal-blue hover:underline">
                          {selectedApp.app_url}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowApiKeys(true)}
                    >
                      API Keys
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCreatePlan(true)}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Add Plan
                    </Button>
                  </div>
                </div>
              </div>

              {/* Analytics Overview */}
              {analytics && (
                <div className="rounded-xl border border-border bg-card p-6">
                  <h3 className="mb-4 text-lg font-semibold text-foreground flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Analytics Overview
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="rounded-lg bg-emerald-50 p-4">
                      <p className="text-sm text-emerald-600">Total Revenue</p>
                      <p className="text-2xl font-bold text-emerald-700">${analytics.total_revenue.toFixed(2)}</p>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-4">
                      <p className="text-sm text-blue-600">Transactions</p>
                      <p className="text-2xl font-bold text-blue-700">{analytics.total_transactions}</p>
                    </div>
                    <div className="rounded-lg bg-purple-50 p-4">
                      <p className="text-sm text-purple-600">Active Subscriptions</p>
                      <p className="text-2xl font-bold text-purple-700">{analytics.active_subscriptions}</p>
                    </div>
                    <div className="rounded-lg bg-orange-50 p-4">
                      <p className="text-sm text-orange-600">New Subscriptions</p>
                      <p className="text-2xl font-bold text-orange-700">{analytics.new_subscriptions}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Plans */}
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payment Plans
                  </h3>
                  <Button
                    onClick={() => setShowCreatePlan(true)}
                    size="sm"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add Plan
                  </Button>
                </div>
                <div className="space-y-3">
                  {plans.map((plan) => (
                    <div key={plan.id} className="rounded-lg border border-border p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {getPlanIcon(plan.plan_type)}
                          <div>
                            <p className="font-medium text-foreground">{plan.plan_name}</p>
                            <p className="text-sm text-muted-foreground">{plan.plan_description}</p>
                            <div className="mt-2 flex items-center gap-4 text-sm">
                              <span className="flex items-center gap-1">
                                {getPlanIcon(plan.plan_type)}
                                {getPlanLabel(plan.plan_type)}
                              </span>
                              <span className="font-medium text-foreground">
                                {plan.currency} {plan.amount.toFixed(2)}
                              </span>
                              {plan.trial_days > 0 && (
                                <span className="text-emerald-600">
                                  {plan.trial_days} days trial
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {plans.length === 0 && (
                    <div className="text-center py-8">
                      <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">No payment plans yet</p>
                      <Button
                        onClick={() => setShowCreatePlan(true)}
                        variant="outline"
                        className="mt-2"
                      >
                        Create your first plan
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Links */}
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Link className="h-5 w-5" />
                    Payment Links
                  </h3>
                  <Button
                    onClick={() => setShowCreateLink(true)}
                    size="sm"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Create Link
                  </Button>
                </div>
                <div className="space-y-3">
                  {paymentLinks.map((link) => (
                    <div key={link.id} className="rounded-lg border border-border p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-foreground">{link.link_name}</p>
                          <p className="text-sm text-muted-foreground">{link.link_description}</p>
                          <div className="mt-2 flex items-center gap-4 text-sm">
                            <span>Usage: {link.usage_count}/{link.max_usage || '∞'}</span>
                            {link.expires_at && (
                              <span>Expires: {new Date(link.expires_at).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(link.payment_url, 'Payment URL')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {paymentLinks.length === 0 && (
                    <div className="text-center py-8">
                      <Link className="mx-auto h-12 w-12 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">No payment links yet</p>
                      <Button
                        onClick={() => setShowCreateLink(true)}
                        variant="outline"
                        className="mt-2"
                      >
                        Create your first link
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <Smartphone className="mx-auto h-16 w-16 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-semibold text-foreground">Select an app to manage</h3>
              <p className="mt-2 text-muted-foreground">Choose an app from the sidebar or create a new one to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Create App Dialog */}
      <Dialog open={showCreateApp} onOpenChange={setShowCreateApp}>
        <DialogContent className="max-w-md">
          <DialogTitle>Create New App</DialogTitle>
          <DialogDescription>
            Register your app to start accepting payments
          </DialogDescription>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">App Name *</label>
              <Input
                value={newApp.name}
                onChange={(e) => setNewApp({ ...newApp, name: e.target.value })}
                placeholder="My Awesome App"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Description</label>
              <Input
                value={newApp.description}
                onChange={(e) => setNewApp({ ...newApp, description: e.target.value })}
                placeholder="Brief description of your app"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">App URL</label>
              <Input
                value={newApp.url}
                onChange={(e) => setNewApp({ ...newApp, url: e.target.value })}
                placeholder="https://myapp.com"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">App Logo</label>
              <div className="mt-1">
                {newApp.logo_url ? (
                  <div className="relative">
                    <img 
                      src={newApp.logo_url} 
                      alt="App logo" 
                      className="h-20 w-20 rounded-lg object-cover border border-border"
                    />
                    <button
                      type="button"
                      onClick={() => setNewApp({ ...newApp, logo_url: "" })}
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white hover:bg-red-600 flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                    <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">Click to upload app logo</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                      className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                    />
                    {uploadingLogo && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-paypal-blue border-t-paypal-blue"></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Supported formats: JPG, PNG, GIF. Max size: 5MB
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Webhook URL</label>
              <Input
                value={newApp.webhook_url}
                onChange={(e) => setNewApp({ ...newApp, webhook_url: e.target.value })}
                placeholder="https://myapp.com/webhook"
                className="mt-1"
              />
            </div>
            <Button
              onClick={createApp}
              disabled={processing}
              className="w-full"
            >
              {processing ? "Creating..." : "Create App"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Plan Dialog */}
      <Dialog open={showCreatePlan} onOpenChange={setShowCreatePlan}>
        <DialogContent className="max-w-md">
          <DialogTitle>Create Payment Plan</DialogTitle>
          <DialogDescription>
            Create a new payment plan for {selectedApp?.app_name}
          </DialogDescription>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Plan Name *</label>
              <Input
                value={newPlan.name}
                onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                placeholder="Premium Plan"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Description</label>
              <Input
                value={newPlan.description}
                onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                placeholder="Features included in this plan"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Plan Type *</label>
              <select
                value={newPlan.type}
                onChange={(e) => setNewPlan({ ...newPlan, type: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2"
              >
                <option value="one_time">One-time Payment</option>
                <option value="recurring_monthly">Monthly Subscription</option>
                <option value="recurring_yearly">Yearly Subscription</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Amount ({newPlan.currency}) *</label>
              <Input
                type="number"
                value={newPlan.amount}
                onChange={(e) => setNewPlan({ ...newPlan, amount: e.target.value })}
                placeholder="9.99"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Trial Days</label>
              <Input
                type="number"
                value={newPlan.trial_days}
                onChange={(e) => setNewPlan({ ...newPlan, trial_days: e.target.value })}
                placeholder="0"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Setup Fee ({newPlan.currency})</label>
              <Input
                type="number"
                value={newPlan.setup_fee}
                onChange={(e) => setNewPlan({ ...newPlan, setup_fee: e.target.value })}
                placeholder="0.00"
                className="mt-1"
              />
            </div>
            <Button
              onClick={createPlan}
              disabled={processing}
              className="w-full"
            >
              {processing ? "Creating..." : "Create Plan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* API Keys Dialog */}
      <Dialog open={showApiKeys} onOpenChange={setShowApiKeys}>
        <DialogContent className="max-w-md">
          <DialogTitle>API Keys for {selectedApp?.app_name}</DialogTitle>
          <DialogDescription>
            Keep these keys secure and never share them publicly
          </DialogDescription>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Secret Key</label>
              <div className="mt-1 relative">
                <Input
                  type={showSecretKey ? "text" : "password"}
                  value={selectedApp?.app_secret_key || ""}
                  readOnly
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={() => copyToClipboard(selectedApp?.app_secret_key || "", "Secret Key")}
              >
                <Copy className="mr-2 h-3 w-3" />
                Copy Secret Key
              </Button>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Public Key</label>
              <div className="mt-1 relative">
                <Input
                  type={showPublicKey ? "text" : "password"}
                  value={selectedApp?.app_public_key || ""}
                  readOnly
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPublicKey(!showPublicKey)}
                  className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showPublicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={() => copyToClipboard(selectedApp?.app_public_key || "", "Public Key")}
              >
                <Copy className="mr-2 h-3 w-3" />
                Copy Public Key
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppDeveloperDashboardPage;
