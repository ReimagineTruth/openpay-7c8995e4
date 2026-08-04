import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import BrandLogo from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { usePiUsdPrice } from "@/lib/piPrice";
import {
  ADMIN_PROFILE_USERNAMES,
  KYC_CHANNEL_LABELS,
  type AdminKycApplicationRecord,
  type KycChannel,
  isLikelyStoragePath,
  normalizeKycApplication,
} from "@/lib/kyc";

const channelBadgeClass = (channel?: KycChannel) => {
  switch (channel) {
    case "pro":
      return "bg-indigo-100 text-indigo-800";
    case "pi":
      return "bg-amber-100 text-amber-900";
    default:
      return "bg-blue-100 text-blue-800";
  }
};

type ProfileRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

const AdminKycReview = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<AdminKycApplicationRecord[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<AdminKycApplicationRecord | null>(null);
  const [selectedSignedDocs, setSelectedSignedDocs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState<"all" | KycChannel>("all");
  const piPrice = usePiUsdPrice();
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewMode, setReviewMode] = useState<"reject" | "additional_info_required" | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  const loadApplications = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sign in first to open admin KYC review");
        navigate("/sign-in?mode=signin", { replace: true });
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
      const normalizedUsername = String(profile?.username || "").trim().toLowerCase().replace(/^@+/, "");
      if (!ADMIN_PROFILE_USERNAMES.has(normalizedUsername)) {
        toast.error("Admin access is restricted to @openpay and @wainfoundation");
        navigate("/dashboard", { replace: true });
        return;
      }

      const { data, error } = await (supabase as any)
        .from("kyc_applications")
        .select("*")
        .order("submitted_at", { ascending: false });

      if (error) throw error;

      const normalized = (Array.isArray(data) ? data : []).map((row: any) => normalizeKycApplication(row));
      const userIds = [...new Set(normalized.map((row) => row.user_id).filter(Boolean))];

      let profilesMap = new Map<string, ProfileRow>();
      const piMap = new Map<string, string>();
      if (userIds.length > 0) {
        const [{ data: profiles }, { data: piAccounts }] = await Promise.all([
          supabase.from("profiles").select("id, username, avatar_url").in("id", userIds),
          (supabase as any).from("pi_accounts").select("user_id, pi_username").in("user_id", userIds),
        ]);
        profilesMap = new Map((profiles || []).map((row) => [row.id, row as ProfileRow]));
        (Array.isArray(piAccounts) ? piAccounts : []).forEach((row: any) => {
          if (row?.user_id && row?.pi_username) piMap.set(String(row.user_id), String(row.pi_username));
        });
      }

      const rawRows = Array.isArray(data) ? data : [];
      const merged = normalized.map((row, index) => {
        const profileRow = profilesMap.get(row.user_id);
        const raw = (rawRows[index] || {}) as any;
        const source = raw.source || "openpay";
        const piUsername = piMap.get(row.user_id) || null;
        const channel: KycChannel = source === "partner" ? "pro" : piUsername ? "pi" : "openpay";
        return {
          ...row,
          source,
          channel,
          pi_username: piUsername,
          partner_app_id: raw.partner_app_id || null,
          external_user_id: raw.external_user_id || null,
          external_ref: raw.external_ref || null,
          callback_url: raw.callback_url || null,
          profile_username: profileRow?.username || null,
          profile_avatar_url: profileRow?.avatar_url || null,
        };
      });



      setApplications(merged);
      setSelectedApplication((current) => {
        if (!current) return merged[0] || null;
        return merged.find((item) => item.id === current.id) || merged[0] || null;
      });
    } catch (error) {
      console.error("Error loading KYC applications:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load KYC applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadApplications();
  }, []);

  useEffect(() => {
    const loadSignedDocs = async () => {
      if (!selectedApplication) {
        setSelectedSignedDocs({});
        return;
      }

      const entries = [
        ["id_document_front_url", selectedApplication.id_document_front_url],
        ["id_document_back_url", selectedApplication.id_document_back_url],
        ["selfie_url", selectedApplication.selfie_url],
        ["proof_of_address_url", selectedApplication.proof_of_address_url],
      ] as const;

      const result: Record<string, string> = {};
      await Promise.all(
        entries.map(async ([key, value]) => {
          if (!value) return;
          if (!isLikelyStoragePath(value)) {
            result[key] = value;
            return;
          }
          const { data, error } = await supabase.storage.from("kyc-documents").createSignedUrl(value, 3600);
          if (!error && data?.signedUrl) {
            result[key] = data.signedUrl;
          }
        }),
      );
      setSelectedSignedDocs(result);
    };

    void loadSignedDocs();
  }, [selectedApplication]);

  const notifyPartner = async (applicationId: string) => {
    try {
      await supabase.functions.invoke("kyc-partner-api/internal/notify", {
        body: { application_id: applicationId },
      });
    } catch (error) {
      console.warn("Partner KYC webhook notify failed:", error);
    }
  };

  const handleApprove = async (applicationId: string) => {

    setActionLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("update_kyc_status", {
        application_id: applicationId,
        new_status: "approved",
        rejection_reason_text: null,
        admin_notes_text: adminNotes.trim() || null,
      });
      if (error) throw error;

      const resultRow = Array.isArray(data) ? data[0] : data;
      if (resultRow?.success === false) {
        throw new Error(resultRow.message || "Approval failed");
      }

      toast.success("KYC application approved successfully");
      setAdminNotes("");
      await notifyPartner(applicationId);
      await loadApplications();

    } catch (error) {
      console.error("Approve KYC failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to approve application");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecisionSubmit = async () => {
    if (!selectedApplication || !reviewMode) return;
    if (reviewMode === "reject" && !decisionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    if (reviewMode === "additional_info_required" && !adminNotes.trim() && !decisionReason.trim()) {
      toast.error("Add the requested information details for the applicant");
      return;
    }

    setActionLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("update_kyc_status", {
        application_id: selectedApplication.id,
        new_status: reviewMode === "reject" ? "rejected" : reviewMode,
        rejection_reason_text: reviewMode === "reject" ? decisionReason.trim() : null,
        admin_notes_text: [adminNotes.trim(), reviewMode === "additional_info_required" ? decisionReason.trim() : ""].filter(Boolean).join("\n\n") || null,
      });
      if (error) throw error;

      const resultRow = Array.isArray(data) ? data[0] : data;
      if (resultRow?.success === false) {
        throw new Error(resultRow.message || "Review action failed");
      }

      toast.success(reviewMode === "reject" ? "KYC application rejected" : "Additional information requested");
      setShowReviewModal(false);
      setReviewMode(null);
      setDecisionReason("");
      setAdminNotes("");
      await notifyPartner(selectedApplication.id);
      await loadApplications();

    } catch (error) {
      console.error("Review KYC failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update application");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "under_review":
        return "bg-blue-100 text-blue-800";
      case "additional_info_required":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4" />;
      case "rejected":
        return <XCircle className="h-4 w-4" />;
      case "under_review":
        return <Eye className="h-4 w-4" />;
      case "additional_info_required":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const channelStats = useMemo(() => {
    const base: Record<"all" | KycChannel, { total: number; pending: number; approved: number }> = {
      all: { total: 0, pending: 0, approved: 0 },
      openpay: { total: 0, pending: 0, approved: 0 },
      pro: { total: 0, pending: 0, approved: 0 },
      pi: { total: 0, pending: 0, approved: 0 },
    };
    applications.forEach((app) => {
      const key = app.channel || "openpay";
      const pending = app.status === "pending" || app.status === "under_review";
      const approved = app.status === "approved";
      [base.all, base[key]].forEach((bucket) => {
        bucket.total += 1;
        if (pending) bucket.pending += 1;
        if (approved) bucket.approved += 1;
      });
    });
    return base;
  }, [applications]);

  const filteredApplications = useMemo(
    () =>
      applications.filter((app) => {
        const searchValue = searchTerm.trim().toLowerCase();
        const matchesSearch =
          !searchValue ||
          app.full_name.toLowerCase().includes(searchValue) ||
          app.email.toLowerCase().includes(searchValue) ||
          app.id_document_number.toLowerCase().includes(searchValue) ||
          String(app.profile_username || "").toLowerCase().includes(searchValue) ||
          String(app.pi_username || "").toLowerCase().includes(searchValue) ||
          app.user_id.toLowerCase().includes(searchValue);
        const matchesStatus = statusFilter === "all" || app.status === statusFilter;
        const matchesChannel = channelFilter === "all" || (app.channel || "openpay") === channelFilter;
        return matchesSearch && matchesStatus && matchesChannel;
      }),
    [applications, searchTerm, statusFilter, channelFilter],
  );


  const openDecisionModal = (mode: "reject" | "additional_info_required") => {
    setReviewMode(mode);
    setDecisionReason("");
    setAdminNotes(selectedApplication?.admin_notes || "");
    setShowReviewModal(true);
  };

  const documentCards = [
    { key: "id_document_front_url", label: "ID Front" },
    { key: "id_document_back_url", label: "ID Back" },
    { key: "selfie_url", label: "Selfie" },
    { key: "proof_of_address_url", label: "Proof of Address" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white">
        <div className="px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/admin-dashboard")} className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3">
                <BrandLogo className="h-8 w-8" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">KYC Review</h1>
                  <p className="text-sm text-gray-500">Separated by OpenPay, OpenPay Pro and Pure Pi applicants</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
                π ${piPrice.price < 0.01 ? piPrice.price.toPrecision(3) : piPrice.price.toFixed(4)}
                <span className="font-normal text-amber-700">{piPrice.isFallback ? "est." : "live"}</span>
              </div>
              <Button onClick={() => void loadApplications()} disabled={loading} variant="outline" className="flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200 bg-white px-4 pb-3 pt-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["all", "openpay", "pro", "pi"] as const).map((tab) => {
            const active = channelFilter === tab;
            const label = tab === "all" ? "All channels" : KYC_CHANNEL_LABELS[tab];
            return (
              <button
                key={tab}
                onClick={() => setChannelFilter(tab)}
                className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                  active
                    ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50"
                }`}
              >
                <p className="text-[11px] font-medium uppercase tracking-wide opacity-80">{label}</p>
                <p className="text-lg font-bold leading-tight">{channelStats[tab].total}</p>
                <p className={`text-[11px] ${active ? "text-white/80" : "text-gray-500"}`}>
                  {channelStats[tab].pending} pending · {channelStats[tab].approved} approved
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, username, Pi username, user ID, or document number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="additional_info_required">Additional Info Required</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        <div className={`${selectedApplication ? "lg:w-[42%]" : "w-full"} border-r border-gray-200 bg-white`}>
          <div className="divide-y divide-gray-200">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading applications...</span>
              </div>
            ) : filteredApplications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FileText className="mb-3 h-12 w-12 text-gray-400" />
                <p className="text-gray-600">No KYC applications found</p>
              </div>
            ) : (
              filteredApplications.map((application) => (
                <div
                  key={application.id}
                  onClick={() => setSelectedApplication(application)}
                  className={`cursor-pointer border-l-4 p-4 transition-colors hover:bg-gray-50 ${
                    selectedApplication?.id === application.id ? "border-l-blue-600 bg-blue-50" : "border-l-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{application.full_name}</h3>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(application.status)}`}>
                          {getStatusIcon(application.status)}
                          {application.status.replace(/_/g, " ").toUpperCase()}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${channelBadgeClass(application.channel)}`}>
                          {KYC_CHANNEL_LABELS[application.channel || "openpay"]}
                        </span>
                      </div>
                      <p className="truncate text-sm text-gray-600">{application.email}</p>
                      <p className="truncate text-sm text-gray-600">
                        {application.channel === "pro"
                          ? `ext: ${application.external_user_id || application.external_ref || "—"}`
                          : application.channel === "pi"
                            ? `π @${application.pi_username}`
                            : application.profile_username
                              ? `@${application.profile_username}`
                              : String(application.user_id || "").slice(0, 8)}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                        <span>{application.id_document_type.replace(/_/g, " ")}</span>
                        <span>{new Date(application.submitted_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Eye className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>


        {selectedApplication ? (
          <div className="fixed inset-0 z-50 flex flex-col bg-white lg:static lg:z-auto lg:flex-1 lg:sticky lg:top-0 lg:max-h-screen">
            <div className="flex-shrink-0 border-b border-gray-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedApplication(null)}
                    aria-label="Close applicant details"
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-gray-900">{selectedApplication.full_name}</h2>
                    <p className="truncate text-sm text-gray-500">Full compliance review</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${channelBadgeClass(selectedApplication.channel)}`}>
                    {KYC_CHANNEL_LABELS[selectedApplication.channel || "openpay"]}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(selectedApplication.status)}`}>
                    {getStatusIcon(selectedApplication.status)}
                    {selectedApplication.status.replace(/_/g, " ").toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-4">

              <div>
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
                  <User className="h-4 w-4" />
                  Identity
                </h3>
                <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                  <div>
                    <p className="text-gray-600">Full Name</p>
                    <p className="font-medium">{selectedApplication.full_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">OpenPay Username</p>
                    <p className="font-medium">{selectedApplication.profile_username ? `@${selectedApplication.profile_username}` : "Not set"}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Pi Username</p>
                    <p className="font-medium">{selectedApplication.pi_username ? `@${selectedApplication.pi_username}` : "Not linked"}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Partner App</p>
                    <p className="font-medium">{selectedApplication.partner_app_id || (selectedApplication.channel === "pro" ? "OpenPay Pro" : "—")}</p>
                  </div>

                  <div>
                    <p className="text-gray-600">User ID</p>
                    <p className="font-mono text-xs font-medium break-all">{selectedApplication.user_id}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Date of Birth</p>
                    <p className="font-medium">{selectedApplication.date_of_birth}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Email</p>
                    <p className="font-medium">{selectedApplication.email}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Phone</p>
                    <p className="font-medium">{selectedApplication.phone_number}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Nationality</p>
                    <p className="font-medium">{selectedApplication.nationality}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-gray-600">Residential Address</p>
                    <p className="font-medium">{selectedApplication.residential_address}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
                  <FileText className="h-4 w-4" />
                  Financial Profile
                </h3>
                <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                  <div>
                    <p className="text-gray-600">Occupation</p>
                    <p className="font-medium">{selectedApplication.occupation}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Employer</p>
                    <p className="font-medium">{selectedApplication.employer_name || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Source of Funds</p>
                    <p className="font-medium">{selectedApplication.source_of_funds}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Annual Income</p>
                    <p className="font-medium">{selectedApplication.annual_income_range}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-gray-600">Political Exposure</p>
                    <p className="font-medium">{selectedApplication.political_exposure ? "Yes" : "No"}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm">
                <h3 className="mb-2 font-semibold text-blue-900">Face verification (client)</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-blue-700/80">Liveness</p>
                    <p className="font-medium text-blue-950">
                      {selectedApplication.liveness_passed ? "Passed" : "Not completed"}
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-700/80">Score</p>
                    <p className="font-medium text-blue-950">
                      {selectedApplication.liveness_score != null ? `${selectedApplication.liveness_score}%` : "—"}
                    </p>
                  </div>
                </div>
                {selectedApplication.selfie_captured_at ? (
                  <p className="mt-2 text-xs text-blue-800">
                    Captured {new Date(selectedApplication.selfie_captured_at).toLocaleString()}
                  </p>
                ) : null}
              </div>

              <div>
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
                  <Shield className="h-4 w-4" />
                  Documents
                </h3>
                <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                  <div>
                    <p className="text-gray-600">Document Type</p>
                    <p className="font-medium">{selectedApplication.id_document_type.replace(/_/g, " ")}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Document Number</p>
                    <p className="font-medium">{selectedApplication.id_document_number}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Issue Date</p>
                    <p className="font-medium">{selectedApplication.id_document_issue_date}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Expiry Date</p>
                    <p className="font-medium">{selectedApplication.id_document_expiry_date}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {documentCards.map((card) => {
                    const signedUrl = selectedSignedDocs[card.key];
                    if (!signedUrl) return null;
                    return (
                      <div key={card.key}>
                        <p className="mb-2 text-sm text-gray-600">{card.label}</p>
                        <a href={signedUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                          <img src={signedUrl} alt={card.label} className="h-40 w-full object-cover" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="mb-3 font-semibold text-gray-900">Review Timeline</h3>
                <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                  <div>
                    <p className="text-gray-600">Submitted</p>
                    <p className="font-medium">{new Date(selectedApplication.submitted_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Reviewed</p>
                    <p className="font-medium">{selectedApplication.reviewed_at ? new Date(selectedApplication.reviewed_at).toLocaleString() : "Not reviewed yet"}</p>
                  </div>
                </div>
              </div>

              {selectedApplication.admin_notes ? (
                <div>
                  <h3 className="mb-3 font-semibold text-gray-900">Admin Notes</h3>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedApplication.admin_notes}</p>
                  </div>
                </div>
              ) : null}

              {selectedApplication.rejection_reason ? (
                <div>
                  <h3 className="mb-3 font-semibold text-gray-900">Rejection Reason</h3>
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-sm text-red-700 whitespace-pre-wrap">{selectedApplication.rejection_reason}</p>
                  </div>
                </div>
              ) : null}

              <div>
                <h3 className="mb-2 font-semibold text-gray-900">Internal Admin Note</h3>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Optional internal note for this review"
                  className="h-24 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex-shrink-0 border-t border-gray-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="flex flex-col gap-3 sm:flex-row">
                {selectedApplication.status !== "approved" ? (
                  <Button onClick={() => void handleApprove(selectedApplication.id)} disabled={actionLoading} className="flex-1 bg-green-600 hover:bg-green-700">
                    {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                    Approve
                  </Button>
                ) : null}
                {selectedApplication.status !== "rejected" ? (
                  <Button onClick={() => openDecisionModal("reject")} disabled={actionLoading} variant="outline" className="flex-1 border-red-300 text-red-600 hover:bg-red-50">
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                ) : null}
                {selectedApplication.status !== "additional_info_required" ? (
                  <Button onClick={() => openDecisionModal("additional_info_required")} disabled={actionLoading} variant="outline" className="flex-1 border-orange-300 text-orange-600 hover:bg-orange-50">
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Request Info
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {showReviewModal && reviewMode ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              {reviewMode === "reject" ? "Reject Application" : "Request Additional Information"}
            </h3>

            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {reviewMode === "reject" ? "Rejection Reason *" : "Requested Details *"}
              </label>
              <textarea
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                className="h-24 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={
                  reviewMode === "reject"
                    ? "Explain clearly why this application is being rejected..."
                    : "Explain what additional information or clearer documents are required..."
                }
              />
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-gray-700">Admin Notes</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="h-20 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional internal note"
              />
            </div>

            <div className="flex gap-3">
              <Button onClick={() => setShowReviewModal(false)} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button onClick={() => void handleDecisionSubmit()} disabled={actionLoading} className={`flex-1 ${reviewMode === "reject" ? "bg-red-600 hover:bg-red-700" : "bg-orange-600 hover:bg-orange-700"}`}>
                {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminKycReview;
