import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle, Clock, FileText, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import BrandLogo from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { type KycApplicationRecord, normalizeKycApplication } from "@/lib/kyc";

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
          color: "text-yellow-600",
          bgColor: "bg-yellow-50",
          borderColor: "border-yellow-200",
          title: "Application Submitted",
          description: "Your KYC application has been submitted and is waiting for review.",
          nextSteps: "Our compliance team will review your details and documents.",
        };
      case "under_review":
        return {
          icon: <RefreshCw className="h-8 w-8 animate-spin" />,
          color: "text-blue-600",
          bgColor: "bg-blue-50",
          borderColor: "border-blue-200",
          title: "Under Review",
          description: "Your KYC application is being reviewed by an OpenPay admin.",
          nextSteps: "We may request additional details if a document or field needs clarification.",
        };
      case "approved":
        return {
          icon: <CheckCircle className="h-8 w-8" />,
          color: "text-green-600",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
          title: "KYC Verified",
          description: "Your identity has been approved successfully.",
          nextSteps: "Your profile can now access KYC-gated OpenPay features.",
        };
      case "rejected":
        return {
          icon: <AlertCircle className="h-8 w-8" />,
          color: "text-red-600",
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
          title: "Application Rejected",
          description: "Your KYC application was not approved.",
          nextSteps: "Review the reason below and submit a fresh application when ready.",
        };
      case "additional_info_required":
        return {
          icon: <FileText className="h-8 w-8" />,
          color: "text-orange-600",
          bgColor: "bg-orange-50",
          borderColor: "border-orange-200",
          title: "More Information Needed",
          description: "Your reviewer requested more information before approval.",
          nextSteps: "Open the KYC page, update the missing details, and resubmit for review.",
        };
      default:
        return {
          icon: <FileText className="h-8 w-8" />,
          color: "text-gray-600",
          bgColor: "bg-gray-50",
          borderColor: "border-gray-200",
          title: "No Application Yet",
          description: "You haven't submitted a KYC application yet.",
          nextSteps: "Start KYC verification to unlock higher-trust account features.",
        };
    }
  };

  const statusInfo = getStatusInfo(application?.status);

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-24">
      <div className="px-4 pt-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/menu")} className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <h1 className="text-xl font-bold text-paypal-dark">KYC Status</h1>
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2 shadow-sm">
            <BrandLogo className="h-full w-full text-paypal-blue" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-paypal-blue" />
            <span className="ml-2 text-gray-600">Loading KYC status...</span>
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

              <div className={`mb-4 rounded-lg p-4 ${statusInfo.bgColor}`}>
                <p className="text-sm text-foreground">{statusInfo.nextSteps}</p>
              </div>

              {application ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Application ID</span>
                    <span className="font-mono text-foreground">{application.id.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Submitted</span>
                    <span className="text-foreground">{new Date(application.submitted_at).toLocaleString()}</span>
                  </div>
                  {application.reviewed_at ? (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Reviewed</span>
                      <span className="text-foreground">{new Date(application.reviewed_at).toLocaleString()}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {application ? (
              <div className="mt-6 paypal-surface rounded-2xl p-6 shadow-sm">
                <h3 className="mb-4 font-semibold text-foreground">Application Details</h3>
                <div className="space-y-4">
                  <div>
                    <p className="mb-1 text-sm text-muted-foreground">Full Name</p>
                    <p className="font-medium text-foreground">{application.full_name}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-sm text-muted-foreground">Email</p>
                    <p className="font-medium text-foreground">{application.email}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium text-foreground">{application.phone_number}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-sm text-muted-foreground">Document</p>
                    <p className="font-medium text-foreground">
                      {application.id_document_type.replace(/_/g, " ")} - {application.id_document_number}
                    </p>
                  </div>

                  {application.rejection_reason ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
                        <div>
                          <p className="font-medium text-red-800">Rejection Reason</p>
                          <p className="mt-1 text-sm text-red-700">{application.rejection_reason}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {application.admin_notes ? (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <div className="flex items-start gap-3">
                        <FileText className="mt-0.5 h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-medium text-blue-800">Admin Notes</p>
                          <p className="mt-1 text-sm text-blue-700">{application.admin_notes}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              {!application ? (
                <Button onClick={() => navigate("/kyc")} className="h-12 w-full bg-paypal-blue hover:bg-[#004dc5]">
                  Start KYC Verification
                </Button>
              ) : null}

              {application?.status === "rejected" || application?.status === "additional_info_required" ? (
                <Button onClick={() => navigate("/kyc")} className="h-12 w-full bg-paypal-blue hover:bg-[#004dc5]">
                  {application.status === "rejected" ? "Submit New Application" : "Update Application"}
                </Button>
              ) : null}

              <Button onClick={() => void loadApplicationStatus()} variant="outline" className="h-12 w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Status
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
