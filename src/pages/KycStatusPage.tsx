import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  ScanFace,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import BrandLogo from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { type KycApplicationRecord, isKycVerified, kycStatusLabel, normalizeKycApplication } from "@/lib/kyc";

const TIMELINE_STEPS = [
  { key: "submit", label: "Submitted" },
  { key: "review", label: "Under review" },
  { key: "verified", label: "Verified" },
] as const;

const KycStatusPage = () => {
  const navigate = useNavigate();
  const [application, setApplication] = useState<KycApplicationRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const loadApplicationStatus = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/sign-in?mode=signin", { replace: true });
        return;
      }

      const { data, error } = await (supabase as any)
        .from("kyc_applications")
        .select("*")
        .eq("user_id", user.id)
        .order("submitted_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      const latest = Array.isArray(data) && data[0] ? normalizeKycApplication(data[0]) : null;
      setApplication(latest);
    } catch (error) {
      console.error("Error loading KYC status:", error);
      toast.error("Failed to load KYC status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadApplicationStatus();
  }, []);

  const getStatusInfo = (status: string | null | undefined) => {
    switch (status) {
      case "pending":
        return {
          icon: <Clock className="h-8 w-8" />,
          color: "text-amber-600",
          bgColor: "bg-amber-50",
          borderColor: "border-amber-200",
          title: "Application submitted",
          description: "Your identity package is queued for compliance review.",
          nextSteps: "Review usually completes within 1–3 business days.",
        };
      case "under_review":
        return {
          icon: <RefreshCw className="h-8 w-8 animate-spin" />,
          color: "text-blue-600",
          bgColor: "bg-blue-50",
          borderColor: "border-blue-200",
          title: "Under review",
          description: "An OpenPay reviewer is verifying your documents and face check.",
          nextSteps: "You will be notified when a decision is made.",
        };
      case "approved":
        return {
          icon: <CheckCircle className="h-8 w-8" />,
          color: "text-green-600",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
          title: "Identity verified",
          description: "Your account is fully verified for KYC-gated features.",
          nextSteps: "You can apply for loans and higher-trust services.",
        };
      case "rejected":
        return {
          icon: <AlertCircle className="h-8 w-8" />,
          color: "text-red-600",
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
          title: "Application rejected",
          description: "We could not approve your verification with the documents provided.",
          nextSteps: "Review the reason below and submit a new application.",
        };
      case "additional_info_required":
        return {
          icon: <FileText className="h-8 w-8" />,
          color: "text-orange-600",
          bgColor: "bg-orange-50",
          borderColor: "border-orange-200",
          title: "More information needed",
          description: "Your reviewer needs updated details before approval.",
          nextSteps: "Open KYC and complete the requested updates.",
        };
      default:
        return {
          icon: <Shield className="h-8 w-8" />,
          color: "text-gray-600",
          bgColor: "bg-gray-50",
          borderColor: "border-gray-200",
          title: "Verification not started",
          description: "Complete identity verification to unlock higher limits and loans.",
          nextSteps: "The flow includes ID upload and a live face scan.",
        };
    }
  };

  const statusInfo = getStatusInfo(application?.status);
  const timelineActive =
    application?.status === "approved"
      ? 3
      : application?.status === "under_review"
        ? 2
        : application?.status === "pending"
          ? 1
          : 0;

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-24">
      <div className="px-4 pt-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/menu")}
              className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
            >
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-paypal-dark">Verification status</h1>
              <p className="text-xs text-muted-foreground">Track your identity review</p>
            </div>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white p-2 shadow-sm">
            <BrandLogo className="h-full w-full text-paypal-blue" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-paypal-blue" />
          </div>
        ) : (
          <>
            <div className={`paypal-surface rounded-2xl border p-6 shadow-sm ${statusInfo.borderColor}`}>
              <div className="mb-4 flex items-center gap-3">
                <div className={`rounded-full p-3 ${statusInfo.bgColor} ${statusInfo.color}`}>{statusInfo.icon}</div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{statusInfo.title}</h2>
                  <p className="text-sm text-muted-foreground">{statusInfo.description}</p>
                </div>
              </div>
              <div className={`rounded-xl p-4 ${statusInfo.bgColor}`}>
                <p className="text-sm text-foreground">{statusInfo.nextSteps}</p>
              </div>

              {application ? (
                <div className="mt-6">
                  <div className="flex justify-between">
                    {TIMELINE_STEPS.map((step, index) => (
                      <div key={step.key} className="flex flex-1 flex-col items-center">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                            index < timelineActive ? "bg-paypal-blue text-white" : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <span className="mt-1 text-[10px] font-medium text-muted-foreground">{step.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {application ? (
              <div className="mt-6 space-y-4">
                <div className="paypal-surface rounded-2xl p-6 shadow-sm">
                  <h3 className="mb-4 font-semibold text-foreground">Verification summary</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Status</span>
                      <span className="font-semibold">{kycStatusLabel(application.status)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Submitted</span>
                      <span>{new Date(application.submitted_at).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Face verification</span>
                      <span className={application.liveness_passed ? "font-medium text-green-700" : "text-muted-foreground"}>
                        {application.liveness_passed ? (
                          <span className="inline-flex items-center gap-1">
                            <ScanFace className="h-4 w-4" />
                            Complete
                            {application.liveness_score != null ? ` (${application.liveness_score}%)` : ""}
                          </span>
                        ) : (
                          "Not on file"
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="paypal-surface rounded-2xl p-6 shadow-sm">
                  <h3 className="mb-4 font-semibold text-foreground">Applicant details</h3>
                  <div className="space-y-3 text-sm">
                    <p>
                      <span className="text-muted-foreground">Name: </span>
                      <span className="font-medium">{application.full_name}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Document: </span>
                      <span className="font-medium">
                        {application.id_document_type.replace(/_/g, " ")} · {application.id_document_number}
                      </span>
                    </p>
                  </div>

                  {application.rejection_reason ? (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                      <p className="font-semibold">Rejection reason</p>
                      <p className="mt-1">{application.rejection_reason}</p>
                    </div>
                  ) : null}

                  {application.admin_notes ? (
                    <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                      <p className="font-semibold">Reviewer notes</p>
                      <p className="mt-1">{application.admin_notes}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              {!application ? (
                <Button onClick={() => navigate("/kyc")} className="h-12 w-full bg-paypal-blue hover:bg-[#004dc5]">
                  Start verification
                </Button>
              ) : null}

              {application && !isKycVerified(application.status) ? (
                <Button onClick={() => navigate("/kyc")} className="h-12 w-full bg-paypal-blue hover:bg-[#004dc5]">
                  {application.status === "rejected" ? "Submit new application" : "Update application"}
                </Button>
              ) : null}

              <Button onClick={() => void loadApplicationStatus()} variant="outline" className="h-12 w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh status
              </Button>
            </div>
          </>
        )}
      </div>
      <BottomNav active="menu" />
    </div>
  );
};

export default KycStatusPage;
