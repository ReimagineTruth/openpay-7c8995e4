import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, CheckCircle, FileText, Loader2, Shield, Upload, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import BrandLogo from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import {
  KYC_DOCUMENT_TYPE_OPTIONS,
  KYC_INCOME_RANGE_OPTIONS,
  KYC_SOURCE_OF_FUNDS_OPTIONS,
  type KycApplicationRecord,
  isLikelyStoragePath,
  normalizeKycApplication,
} from "@/lib/kyc";

type UploadField = "id_document_front" | "id_document_back" | "selfie" | "proof_of_address";

type UploadState = Record<`${UploadField}_url`, string>;

const emptyUploadState: UploadState = {
  id_document_front_url: "",
  id_document_back_url: "",
  selfie_url: "",
  proof_of_address_url: "",
};

const KycPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [uploadingField, setUploadingField] = useState<UploadField | null>(null);
  const [currentApplication, setCurrentApplication] = useState<KycApplicationRecord | null>(null);
  const [storedDocumentPaths, setStoredDocumentPaths] = useState<UploadState>(emptyUploadState);
  const [uploadedUrls, setUploadedUrls] = useState<UploadState>(emptyUploadState);

  const [formData, setFormData] = useState({
    full_name: "",
    date_of_birth: "",
    nationality: "",
    residential_address: "",
    phone_number: "",
    email: "",
    occupation: "",
    employer_name: "",
    source_of_funds: "",
    annual_income_range: "",
    political_exposure: false,
    id_document_type: "",
    id_document_number: "",
    id_document_issue_date: "",
    id_document_expiry_date: "",
  });

  const canEditExisting = currentApplication?.status === "additional_info_required";
  const showReadOnlyState =
    currentApplication && currentApplication.status !== "rejected" && currentApplication.status !== "additional_info_required";

  const prefilledName = useMemo(() => formData.full_name.trim(), [formData.full_name]);

  const handleInputChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const buildSignedUrl = async (pathOrUrl: string | null | undefined) => {
    if (!pathOrUrl) return "";
    if (!isLikelyStoragePath(pathOrUrl)) return String(pathOrUrl);
    const { data, error } = await supabase.storage.from("kyc-documents").createSignedUrl(String(pathOrUrl), 3600);
    if (error) {
      console.warn("Failed to sign KYC document URL", error);
      return "";
    }
    return data.signedUrl;
  };

  const populateFromApplication = async (application: KycApplicationRecord | null) => {
    if (!application) return;

    setFormData({
      full_name: application.full_name || "",
      date_of_birth: application.date_of_birth || "",
      nationality: application.nationality || "",
      residential_address: application.residential_address || "",
      phone_number: application.phone_number || "",
      email: application.email || "",
      occupation: application.occupation || "",
      employer_name: application.employer_name || "",
      source_of_funds: application.source_of_funds || "",
      annual_income_range: application.annual_income_range || "",
      political_exposure: Boolean(application.political_exposure),
      id_document_type: application.id_document_type || "",
      id_document_number: application.id_document_number || "",
      id_document_issue_date: application.id_document_issue_date || "",
      id_document_expiry_date: application.id_document_expiry_date || "",
    });

    const paths: UploadState = {
      id_document_front_url: application.id_document_front_url || "",
      id_document_back_url: application.id_document_back_url || "",
      selfie_url: application.selfie_url || "",
      proof_of_address_url: application.proof_of_address_url || "",
    };
    setStoredDocumentPaths(paths);

    const [front, back, selfie, address] = await Promise.all([
      buildSignedUrl(paths.id_document_front_url),
      buildSignedUrl(paths.id_document_back_url),
      buildSignedUrl(paths.selfie_url),
      buildSignedUrl(paths.proof_of_address_url),
    ]);
    setUploadedUrls({
      id_document_front_url: front,
      id_document_back_url: back,
      selfie_url: selfie,
      proof_of_address_url: address,
    });
  };

  useEffect(() => {
    const load = async () => {
      setInitialLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          navigate("/sign-in?mode=signin", { replace: true });
          return;
        }

        const [{ data: profile }, { data: appRows, error: appError }] = await Promise.all([
          supabase.from("profiles").select("full_name, username").eq("id", user.id).maybeSingle(),
          (supabase as any)
            .from("kyc_applications")
            .select("*")
            .eq("user_id", user.id)
            .order("submitted_at", { ascending: false })
            .limit(1),
        ]);

        if (appError) {
          throw appError;
        }

        setFormData((prev) => ({
          ...prev,
          full_name: prev.full_name || String(profile?.full_name || ""),
          email: prev.email || String(user.email || ""),
        }));

        const latest = Array.isArray(appRows) && appRows[0] ? normalizeKycApplication(appRows[0]) : null;
        setCurrentApplication(latest);
        await populateFromApplication(latest);
      } catch (error) {
        console.error("Error loading KYC application:", error);
        toast.error("Failed to load your KYC application");
      } finally {
        setInitialLoading(false);
      }
    };

    void load();
  }, [navigate]);

  const handleFileUpload = async (field: UploadField, file: File) => {
    setUploadingField(field);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `${user.id}/${field}_${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from("kyc-documents").upload(fileName, file, {
        cacheControl: "3600",
        upsert: true,
      });
      if (error) throw error;

      const { data: signedData, error: signedError } = await supabase.storage
        .from("kyc-documents")
        .createSignedUrl(fileName, 3600);
      if (signedError) throw signedError;

      setStoredDocumentPaths((prev) => ({
        ...prev,
        [`${field}_url`]: fileName,
      }));
      setUploadedUrls((prev) => ({
        ...prev,
        [`${field}_url`]: signedData.signedUrl,
      }));

      toast.success(`${field.replace(/_/g, " ")} uploaded`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(`Failed to upload ${field.replace(/_/g, " ")}`);
    } finally {
      setUploadingField(null);
    }
  };

  const validateForm = () => {
    if (
      !formData.full_name ||
      !formData.date_of_birth ||
      !formData.nationality ||
      !formData.residential_address ||
      !formData.phone_number ||
      !formData.email ||
      !formData.occupation ||
      !formData.source_of_funds ||
      !formData.annual_income_range ||
      !formData.id_document_type ||
      !formData.id_document_number ||
      !formData.id_document_issue_date ||
      !formData.id_document_expiry_date
    ) {
      toast.error("Please fill in all required fields");
      return false;
    }
    if (!storedDocumentPaths.id_document_front_url || !storedDocumentPaths.selfie_url) {
      toast.error("Upload ID document front and selfie before submitting");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const payload = {
        user_id: user.id,
        ...formData,
        employer_name: formData.employer_name || null,
        ...storedDocumentPaths,
        status: "pending",
        rejection_reason: null,
        admin_notes: null,
        reviewed_at: null,
        reviewed_by: null,
      };

      if (currentApplication?.id && canEditExisting) {
        const { error } = await (supabase as any)
          .from("kyc_applications")
          .update(payload)
          .eq("id", currentApplication.id)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("kyc_applications").insert(payload);
        if (error) throw error;
      }

      toast.success("KYC application submitted successfully");
      navigate("/kyc-status");
    } catch (error) {
      console.error("Submit error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to submit KYC application");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "text-green-700 bg-green-50";
      case "rejected":
        return "text-red-700 bg-red-50";
      case "under_review":
        return "text-blue-700 bg-blue-50";
      case "additional_info_required":
        return "text-orange-700 bg-orange-50";
      default:
        return "text-gray-700 bg-gray-50";
    }
  };

  const renderUploadCard = (field: UploadField, label: string, required = false, accept = "image/*,.pdf", icon = Upload) => {
    const preview = uploadedUrls[`${field}_url`];
    const Icon = icon;
    return (
      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">
          {label} {required ? "*" : ""}
        </label>
        <div className="rounded-lg border-2 border-dashed border-border p-4">
          <input
            type="file"
            accept={accept}
            onChange={(e) => e.target.files?.[0] && void handleFileUpload(field, e.target.files[0])}
            className="hidden"
            id={field}
          />
          <label htmlFor={field} className="cursor-pointer">
            <div className="flex flex-col items-center">
              {preview ? (
                <div className="relative">
                  <img src={preview} alt={label} className="h-24 w-24 rounded object-cover" />
                  <CheckCircle className="absolute -right-2 -top-2 h-6 w-6 text-green-600" />
                </div>
              ) : (
                <>
                  {uploadingField === field ? <Loader2 className="mb-2 h-8 w-8 animate-spin text-muted-foreground" /> : <Icon className="mb-2 h-8 w-8 text-muted-foreground" />}
                  <p className="text-sm text-muted-foreground">Click to upload {label.toLowerCase()}</p>
                </>
              )}
            </div>
          </label>
        </div>
      </div>
    );
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-[#f8fbff] pb-24">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-paypal-blue" />
        </div>
      </div>
    );
  }

  if (showReadOnlyState && currentApplication) {
    return (
      <div className="min-h-screen bg-[#f8fbff] pb-24">
        <div className="px-4 pt-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/menu")} className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                <ArrowLeft className="h-5 w-5 text-foreground" />
              </button>
              <h1 className="text-xl font-bold text-paypal-dark">KYC Verification</h1>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white p-2 shadow-sm">
              <BrandLogo className="h-full w-full text-paypal-blue" />
            </div>
          </div>

          <div className="paypal-surface rounded-2xl p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current application</p>
                <h2 className="text-lg font-semibold text-foreground">{prefilledName || "KYC application"}</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(currentApplication.status)}`}>
                {currentApplication.status.replace(/_/g, " ")}
              </span>
            </div>

            <p className="text-sm text-muted-foreground">
              Your identity verification is already in progress or completed. Open the status page for the latest review details.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">Submitted</p>
                <p className="font-medium text-foreground">{new Date(currentApplication.submitted_at).toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium text-foreground">{currentApplication.email}</p>
              </div>
            </div>

            <Button onClick={() => navigate("/kyc-status")} className="mt-6 w-full bg-paypal-blue hover:bg-[#004dc5]">
              View KYC Status
            </Button>
          </div>
        </div>
        <BottomNav active="menu" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-24">
      <div className="px-4 pt-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/menu")} className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <h1 className="text-xl font-bold text-paypal-dark">KYC Verification</h1>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white p-2 shadow-sm">
            <BrandLogo className="h-full w-full text-paypal-blue" />
          </div>
        </div>

        <div className="mb-6 paypal-surface rounded-2xl p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 text-paypal-blue" />
            <div>
              <h3 className="mb-1 font-semibold text-foreground">Real identity verification</h3>
              <p className="text-sm text-muted-foreground">
                Submit your legal identity details and supporting documents to unlock higher trust, higher limits, and admin-reviewed verification.
              </p>
            </div>
          </div>
        </div>

        {currentApplication?.status === "rejected" ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-semibold">Previous KYC application was rejected.</p>
            <p className="mt-1">{currentApplication.rejection_reason || "Please review your details and submit a new application."}</p>
          </div>
        ) : null}

        {currentApplication?.status === "additional_info_required" ? (
          <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
            <p className="font-semibold">Additional information requested.</p>
            <p className="mt-1">{currentApplication.admin_notes || "Update your KYC application and submit it again for review."}</p>
          </div>
        ) : null}

        <div className="space-y-6">
          <div className="paypal-surface rounded-2xl p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
              <User className="h-4 w-4 text-paypal-blue" />
              Personal Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Full Name *</label>
                <input value={formData.full_name} onChange={(e) => handleInputChange("full_name", e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-foreground" placeholder="Enter your full legal name" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Date of Birth *</label>
                <input type="date" value={formData.date_of_birth} onChange={(e) => handleInputChange("date_of_birth", e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-foreground" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Nationality *</label>
                <input value={formData.nationality} onChange={(e) => handleInputChange("nationality", e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-foreground" placeholder="Enter your nationality" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Residential Address *</label>
                <textarea value={formData.residential_address} onChange={(e) => handleInputChange("residential_address", e.target.value)} className="h-20 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-foreground" placeholder="Enter your full residential address" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Phone Number *</label>
                <input value={formData.phone_number} onChange={(e) => handleInputChange("phone_number", e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-foreground" placeholder="+63..." />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Email Address *</label>
                <input type="email" value={formData.email} onChange={(e) => handleInputChange("email", e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-foreground" placeholder="name@example.com" />
              </div>
            </div>
          </div>

          <div className="paypal-surface rounded-2xl p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
              <FileText className="h-4 w-4 text-paypal-blue" />
              Financial Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Occupation *</label>
                <input value={formData.occupation} onChange={(e) => handleInputChange("occupation", e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-foreground" placeholder="Enter your occupation" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Employer Name</label>
                <input value={formData.employer_name} onChange={(e) => handleInputChange("employer_name", e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-foreground" placeholder="Employer or company name" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Source of Funds *</label>
                <select value={formData.source_of_funds} onChange={(e) => handleInputChange("source_of_funds", e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-foreground">
                  <option value="">Select source of funds</option>
                  {KYC_SOURCE_OF_FUNDS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Annual Income Range *</label>
                <select value={formData.annual_income_range} onChange={(e) => handleInputChange("annual_income_range", e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-foreground">
                  <option value="">Select income range</option>
                  {KYC_INCOME_RANGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-3 text-sm text-foreground">
                <input type="checkbox" checked={formData.political_exposure} onChange={(e) => handleInputChange("political_exposure", e.target.checked)} className="h-4 w-4 rounded border-border" />
                I am a politically exposed person (PEP) or closely related to one
              </label>
            </div>
          </div>

          <div className="paypal-surface rounded-2xl p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
              <FileText className="h-4 w-4 text-paypal-blue" />
              Identity Documents
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">ID Document Type *</label>
                <select value={formData.id_document_type} onChange={(e) => handleInputChange("id_document_type", e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-foreground">
                  <option value="">Select document type</option>
                  {KYC_DOCUMENT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Document Number *</label>
                <input value={formData.id_document_number} onChange={(e) => handleInputChange("id_document_number", e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-foreground" placeholder="Enter document number" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Issue Date *</label>
                  <input type="date" value={formData.id_document_issue_date} onChange={(e) => handleInputChange("id_document_issue_date", e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-foreground" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Expiry Date *</label>
                  <input type="date" value={formData.id_document_expiry_date} onChange={(e) => handleInputChange("id_document_expiry_date", e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-foreground" />
                </div>
              </div>

              <div className="space-y-4">
                {renderUploadCard("id_document_front", "ID Document Front", true)}
                {renderUploadCard("id_document_back", "ID Document Back")}
                {renderUploadCard("selfie", "Selfie Photo", true, "image/*", Camera)}
                {renderUploadCard("proof_of_address", "Proof of Address")}
              </div>
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={loading || Boolean(uploadingField)} className="h-12 w-full bg-paypal-blue hover:bg-[#004dc5]">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting Application...
              </>
            ) : currentApplication?.status === "rejected" ? (
              "Submit New KYC Application"
            ) : canEditExisting ? (
              "Resubmit KYC Application"
            ) : (
              "Submit KYC Application"
            )}
          </Button>
        </div>
      </div>
      <BottomNav active="menu" />
    </div>
  );
};

export default KycPage;
