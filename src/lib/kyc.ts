export const ADMIN_PROFILE_USERNAMES = new Set(["openpay", "wainfoundation"]);

export type KycStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected"
  | "additional_info_required";

export interface KycApplicationRecord {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth: string;
  nationality: string;
  residential_address: string;
  phone_number: string;
  email: string;
  occupation: string;
  employer_name?: string | null;
  source_of_funds: string;
  annual_income_range: string;
  political_exposure: boolean;
  id_document_type: string;
  id_document_number: string;
  id_document_issue_date: string;
  id_document_expiry_date: string;
  id_document_front_url?: string | null;
  id_document_back_url?: string | null;
  selfie_url?: string | null;
  proof_of_address_url?: string | null;
  status: KycStatus;
  rejection_reason?: string | null;
  admin_notes?: string | null;
  submitted_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
}

export interface AdminKycApplicationRecord extends KycApplicationRecord {
  profile_username?: string | null;
  profile_avatar_url?: string | null;
}

export const KYC_SOURCE_OF_FUNDS_OPTIONS = [
  { value: "employment", label: "Employment Income" },
  { value: "business", label: "Business Income" },
  { value: "investments", label: "Investments" },
  { value: "inheritance", label: "Inheritance" },
  { value: "savings", label: "Personal Savings" },
  { value: "other", label: "Other" },
] as const;

export const KYC_INCOME_RANGE_OPTIONS = [
  { value: "0-25000", label: "Under $25,000" },
  { value: "25000-50000", label: "$25,000 - $50,000" },
  { value: "50000-100000", label: "$50,000 - $100,000" },
  { value: "100000-250000", label: "$100,000 - $250,000" },
  { value: "250000+", label: "$250,000+" },
] as const;

export const KYC_DOCUMENT_TYPE_OPTIONS = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID Card" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "residence_permit", label: "Residence Permit" },
] as const;

export const normalizeKycApplication = (row: any): KycApplicationRecord => ({
  id: String(row.id || ""),
  user_id: String(row.user_id || ""),
  full_name: String(row.full_name || ""),
  date_of_birth: String(row.date_of_birth || ""),
  nationality: String(row.nationality || ""),
  residential_address: String(row.residential_address || ""),
  phone_number: String(row.phone_number || ""),
  email: String(row.email || ""),
  occupation: String(row.occupation || ""),
  employer_name: row.employer_name ? String(row.employer_name) : null,
  source_of_funds: String(row.source_of_funds || ""),
  annual_income_range: String(row.annual_income_range || ""),
  political_exposure: Boolean(row.political_exposure),
  id_document_type: String(row.id_document_type || ""),
  id_document_number: String(row.id_document_number || ""),
  id_document_issue_date: String(row.id_document_issue_date || ""),
  id_document_expiry_date: String(row.id_document_expiry_date || ""),
  id_document_front_url: row.id_document_front_url ? String(row.id_document_front_url) : null,
  id_document_back_url: row.id_document_back_url ? String(row.id_document_back_url) : null,
  selfie_url: row.selfie_url ? String(row.selfie_url) : null,
  proof_of_address_url: row.proof_of_address_url ? String(row.proof_of_address_url) : null,
  status: String(row.status || "pending") as KycStatus,
  rejection_reason: row.rejection_reason ? String(row.rejection_reason) : null,
  admin_notes: row.admin_notes ? String(row.admin_notes) : null,
  submitted_at: String(row.submitted_at || ""),
  reviewed_at: row.reviewed_at ? String(row.reviewed_at) : null,
  reviewed_by: row.reviewed_by ? String(row.reviewed_by) : null,
});

export const isLikelyStoragePath = (value: string | null | undefined) =>
  Boolean(value) && !String(value).startsWith("http://") && !String(value).startsWith("https://");

