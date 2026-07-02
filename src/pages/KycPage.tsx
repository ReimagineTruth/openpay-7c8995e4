import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle,
  FileText,
  Loader2,
  ScanFace,
  Shield,
  Upload,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import BrandLogo from "@/components/BrandLogo";
import KycFaceCapture, { type KycFaceCaptureResult } from "@/components/kyc/KycFaceCapture";
import KycStepIndicator from "@/components/kyc/KycStepIndicator";
import { supabase } from "@/integrations/supabase/client";
import {
  KYC_DOCUMENT_TYPE_OPTIONS,
  KYC_INCOME_RANGE_OPTIONS,
  KYC_SOURCE_OF_FUNDS_OPTIONS,
  KYC_WIZARD_STEPS,
  type KycApplicationRecord,
  type KycWizardStep,
  isLikelyStoragePath,
  kycStatusLabel,
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
  const [step, setStep] = useState<KycWizardStep>("intro");
  const [faceVerification, setFaceVerification] = useState<KycFaceCaptureResult | null>(null);

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
    currentApplication &&
    currentApplication.status !== "rejected" &&
    currentApplication.status !== "additional_info_required";

  const prefilledName = useMemo(() => formData.full_name.trim(), [formData.full_name]);

  const handleInputChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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

    if (application.liveness_passed && application.selfie_url) {
      setFaceVerification({
        file: new File([], "existing-selfie"),
        metadata: (application.face_verification_metadata as KycFaceCaptureResult["metadata"]) || {
          challenges_completed: ["center", "turn_left", "turn_right", "blink"],
          face_detected_steps: 4,
          total_steps: 4,
          captured_at: application.selfie_captured_at || new Date().toISOString(),
        },
        livenessScore: application.liveness_score ?? 85,
      });
    }

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

        if (appError) throw appError;

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

      setStoredDocumentPaths((prev) => ({ ...prev, [`${field}_url`]: fileName }));
      setUploadedUrls((prev) => ({ ...prev, [`${field}_url`]: signedData.signedUrl }));
      toast.success(`${field.replace(/_/g, " ")} uploaded`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(`Failed to upload ${field.replace(/_/g, " ")}`);
    } finally {
      setUploadingField(null);
    }
  };

  const uploadFaceCapture = async (result: KycFaceCaptureResult) => {
    setFaceVerification(result);
    if (result.file.size > 0) {
      await handleFileUpload("selfie", result.file);
    }
  };

  const validateStep = (target: KycWizardStep): boolean => {
    if (target === "personal") {
      if (!formData.full_name || !formData.date_of_birth || !formData.nationality || !formData.residential_address || !formData.phone_number || !formData.email) {
        toast.error("Complete all personal information fields");
        return false;
      }
    }
    if (target === "financial") {
      if (!formData.occupation || !formData.source_of_funds || !formData.annual_income_range) {
        toast.error("Complete financial information");
        return false;
      }
    }
    if (target === "documents") {
      if (!formData.id_document_type || !formData.id_document_number || !formData.id_document_issue_date || !formData.id_document_expiry_date) {
        toast.error("Complete ID document details");
        return false;
      }
      if (!storedDocumentPaths.id_document_front_url) {
        toast.error("Upload the front of your ID document");
        return false;
      }
    }
    if (target === "face") {
      if (!faceVerification && !storedDocumentPaths.selfie_url) {
        toast.error("Complete live face verification");
        return false;
      }
    }
    return true;
  };

  const goNext = () => {
    const order = KYC_WIZARD_STEPS.map((s) => s.id);
    const idx = order.indexOf(step);
    const next = order[idx + 1];
    if (!next) return;
    if (step !== "intro" && !validateStep(step)) return;
    setStep(next);
  };

  const goBack = () => {
    const order = KYC_WIZARD_STEPS.map((s) => s.id);
    const idx = order.indexOf(step);
    const prev = order[idx - 1];
    if (prev) setStep(prev);
    else navigate("/menu");
  };

  const handleSubmit = async () => {
    if (!validateStep("personal") || !validateStep("financial") || !validateStep("documents") || !validateStep("face")) return;

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
        liveness_passed: Boolean(faceVerification || storedDocumentPaths.selfie_url),
        liveness_score: faceVerification?.livenessScore ?? null,
        face_verification_metadata: faceVerification?.metadata ?? null,
        selfie_captured_at: faceVerification?.metadata.captured_at ?? new Date().toISOString(),
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

      toast.success("Identity verification submitted for review");
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
        <div className="rounded-xl border-2 border-dashed border-border p-4">
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
                  <img src={preview} alt={label} className="h-28 w-full max-w-[200px] rounded-lg object-cover" />
                  <CheckCircle className="absolute -right-2 -top-2 h-6 w-6 text-green-600" />
                </div>
              ) : (
                <>
                  {uploadingField === field ? (
                    <Loader2 className="mb-2 h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    <Icon className="mb-2 h-8 w-8 text-muted-foreground" />
                  )}
                  <p className="text-center text-sm text-muted-foreground">Tap to upload {label.toLowerCase()}</p>
                </>
              )}
            </div>
          </label>
        </div>
      </div>
    );
  };

  const header = (
    <div className="mb-6 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-paypal-dark">Identity verification</h1>
          <p className="text-xs text-muted-foreground">Secure KYC · Banking standard</p>
        </div>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white p-2 shadow-sm">
        <BrandLogo className="h-full w-full text-paypal-blue" />
      </div>
    </div>
  );

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
          {header}
          <div className="paypal-surface rounded-2xl p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Application status</p>
                <h2 className="text-lg font-semibold text-foreground">{prefilledName || "Your KYC"}</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(currentApplication.status)}`}>
                {kycStatusLabel(currentApplication.status)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Your verification is in progress or complete. Track review updates on the status page.
            </p>
            {currentApplication.liveness_passed ? (
              <p className="mt-3 flex items-center gap-2 text-sm font-medium text-green-700">
                <ScanFace className="h-4 w-4" />
                Face verification on file
              </p>
            ) : null}
            <Button onClick={() => navigate("/kyc-status")} className="mt-6 w-full bg-paypal-blue hover:bg-[#004dc5]">
              View KYC status
            </Button>
          </div>
        </div>
        <BottomNav active="menu" />
      </div>
    );
  }

  const renderStepContent = () => {
    switch (step) {
      case "intro":
        return (
          <div className="space-y-4">
            <div className="paypal-surface rounded-2xl p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 h-6 w-6 text-paypal-blue" />
                <div>
                  <h3 className="font-semibold text-foreground">Verify your identity</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Complete a guided check with ID upload and live face verification — the same flow used by modern banking apps.
                  </p>
                </div>
              </div>
            </div>

            {/* PiVerify Alternative Option - Prominently displayed */}
            <button
              type="button"
              onClick={() => navigate("/kyc/piverify")}
              className="flex w-full items-center justify-between rounded-2xl border-2 border-paypal-blue/30 bg-gradient-to-r from-paypal-light-blue/20 to-paypal-blue/10 p-5 text-left hover:from-paypal-light-blue/30 hover:to-paypal-blue/20 transition-all shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-paypal-blue/20">
                  <Shield className="h-6 w-6 text-paypal-blue" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-base">Quick Verification with PiVerify</p>
                  <p className="text-sm text-muted-foreground mt-1">Fast ID + selfie check. Complete verification in minutes with our hosted partner flow.</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-paypal-blue flex-shrink-0" />
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with manual form</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: User, title: "Personal details", desc: "Legal name, address, contact" },
                { icon: FileText, title: "Financial profile", desc: "Occupation and source of funds" },
                { icon: Camera, title: "Government ID", desc: "Photo of your ID document" },
                { icon: ScanFace, title: "Face scan", desc: "Live camera liveness check" },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-border/80 bg-white p-4">
                  <item.icon className="mb-2 h-5 w-5 text-paypal-blue" />
                  <p className="font-semibold text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Estimated time: 5–8 minutes. Have your ID ready in good lighting.</p>
          </div>
        );

      case "personal":
        return (
          <div className="paypal-surface space-y-4 rounded-2xl p-6 shadow-sm">
            <h3 className="flex items-center gap-2 font-semibold text-foreground">
              <User className="h-4 w-4 text-paypal-blue" />
              Personal information
            </h3>
            <div>
              <label className="mb-1 block text-sm font-medium">Full legal name *</label>
              <input value={formData.full_name} onChange={(e) => handleInputChange("full_name", e.target.value)} className="h-11 w-full rounded-xl border border-border px-3" placeholder="As shown on your ID" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Date of birth *</label>
              <input type="date" value={formData.date_of_birth} onChange={(e) => handleInputChange("date_of_birth", e.target.value)} className="h-11 w-full rounded-xl border border-border px-3" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Nationality *</label>
              <input value={formData.nationality} onChange={(e) => handleInputChange("nationality", e.target.value)} className="h-11 w-full rounded-xl border border-border px-3" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Residential address *</label>
              <textarea value={formData.residential_address} onChange={(e) => handleInputChange("residential_address", e.target.value)} className="min-h-[88px] w-full rounded-xl border border-border px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Phone *</label>
              <input value={formData.phone_number} onChange={(e) => handleInputChange("phone_number", e.target.value)} className="h-11 w-full rounded-xl border border-border px-3" placeholder="+63..." />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Email *</label>
              <input type="email" value={formData.email} onChange={(e) => handleInputChange("email", e.target.value)} className="h-11 w-full rounded-xl border border-border px-3" />
            </div>
          </div>
        );

      case "financial":
        return (
          <div className="paypal-surface space-y-4 rounded-2xl p-6 shadow-sm">
            <h3 className="flex items-center gap-2 font-semibold text-foreground">
              <FileText className="h-4 w-4 text-paypal-blue" />
              Financial information
            </h3>
            <div>
              <label className="mb-1 block text-sm font-medium">Occupation *</label>
              <input value={formData.occupation} onChange={(e) => handleInputChange("occupation", e.target.value)} className="h-11 w-full rounded-xl border border-border px-3" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Employer</label>
              <input value={formData.employer_name} onChange={(e) => handleInputChange("employer_name", e.target.value)} className="h-11 w-full rounded-xl border border-border px-3" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Source of funds *</label>
              <select value={formData.source_of_funds} onChange={(e) => handleInputChange("source_of_funds", e.target.value)} className="h-11 w-full rounded-xl border border-border px-3">
                <option value="">Select</option>
                {KYC_SOURCE_OF_FUNDS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Annual income *</label>
              <select value={formData.annual_income_range} onChange={(e) => handleInputChange("annual_income_range", e.target.value)} className="h-11 w-full rounded-xl border border-border px-3">
                <option value="">Select</option>
                {KYC_INCOME_RANGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={formData.political_exposure} onChange={(e) => handleInputChange("political_exposure", e.target.checked)} className="h-4 w-4" />
              I am a politically exposed person (PEP)
            </label>
          </div>
        );

      case "documents":
        return (
          <div className="paypal-surface space-y-4 rounded-2xl p-6 shadow-sm">
            <h3 className="flex items-center gap-2 font-semibold text-foreground">
              <Camera className="h-4 w-4 text-paypal-blue" />
              Identity documents
            </h3>
            <select value={formData.id_document_type} onChange={(e) => handleInputChange("id_document_type", e.target.value)} className="h-11 w-full rounded-xl border border-border px-3">
              <option value="">Document type *</option>
              {KYC_DOCUMENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input value={formData.id_document_number} onChange={(e) => handleInputChange("id_document_number", e.target.value)} className="h-11 w-full rounded-xl border border-border px-3" placeholder="Document number *" />
            <div className="grid grid-cols-2 gap-3">
              <input type="date" value={formData.id_document_issue_date} onChange={(e) => handleInputChange("id_document_issue_date", e.target.value)} className="h-11 w-full rounded-xl border border-border px-3" />
              <input type="date" value={formData.id_document_expiry_date} onChange={(e) => handleInputChange("id_document_expiry_date", e.target.value)} className="h-11 w-full rounded-xl border border-border px-3" />
            </div>
            {renderUploadCard("id_document_front", "ID front", true)}
            {renderUploadCard("id_document_back", "ID back (optional)")}
            {renderUploadCard("proof_of_address", "Proof of address (optional)")}
          </div>
        );

      case "face":
        return (
          <div className="paypal-surface rounded-2xl p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
              <ScanFace className="h-4 w-4 text-paypal-blue" />
              Face verification
            </h3>
            {faceVerification || storedDocumentPaths.selfie_url ? (
              <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                <p className="font-semibold">Face verification complete</p>
                {faceVerification?.livenessScore != null ? (
                  <p className="mt-1">Liveness score: {faceVerification.livenessScore}%</p>
                ) : null}
                <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => { setFaceVerification(null); setStoredDocumentPaths((p) => ({ ...p, selfie_url: "" })); setUploadedUrls((p) => ({ ...p, selfie_url: "" })); }}>
                  Retake face scan
                </Button>
              </div>
            ) : (
              <KycFaceCapture
                disabled={Boolean(uploadingField)}
                onCancel={() => setStep("documents")}
                onComplete={(result) => void uploadFaceCapture(result)}
              />
            )}
          </div>
        );

      case "review":
        return (
          <div className="space-y-4">
            <div className="paypal-surface rounded-2xl p-6 shadow-sm">
              <h3 className="mb-4 font-semibold text-foreground">Review before submit</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Name</dt><dd className="font-medium text-right">{formData.full_name}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Email</dt><dd className="font-medium text-right">{formData.email}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">ID</dt><dd className="font-medium text-right">{formData.id_document_type.replace(/_/g, " ")}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Face check</dt><dd className="font-medium text-green-700">{faceVerification || storedDocumentPaths.selfie_url ? "Complete" : "Missing"}</dd></div>
              </dl>
            </div>
            <p className="text-xs text-muted-foreground">
              By submitting, you confirm the information is accurate. OpenPay compliance will review your documents and face verification.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-24">
      <div className="px-4 pt-6">
        {header}

        {currentApplication?.status === "rejected" ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-semibold">Previous application rejected</p>
            <p className="mt-1">{currentApplication.rejection_reason || "Submit a new application with updated documents."}</p>
          </div>
        ) : null}

        {currentApplication?.status === "additional_info_required" ? (
          <div className="mb-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
            <p className="font-semibold">Additional information requested</p>
            <p className="mt-1">{currentApplication.admin_notes || "Update your details and resubmit."}</p>
          </div>
        ) : null}

        {step !== "intro" ? <KycStepIndicator currentStep={step} /> : null}

        {renderStepContent()}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {step !== "review" ? (
            <Button type="button" className="h-12 flex-1 bg-paypal-blue hover:bg-[#004dc5]" onClick={goNext} disabled={Boolean(uploadingField)}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" className="h-12 flex-1 bg-paypal-blue hover:bg-[#004dc5]" onClick={() => void handleSubmit()} disabled={loading || Boolean(uploadingField)}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit for review"
              )}
            </Button>
          )}
          {step !== "intro" ? (
            <Button type="button" variant="outline" className="h-12 flex-1" onClick={goBack}>
              Back
            </Button>
          ) : null}
        </div>
      </div>
      <BottomNav active="menu" />
    </div>
  );
};

export default KycPage;
