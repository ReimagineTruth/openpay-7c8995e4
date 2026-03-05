import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import RegulatoryStatusModal, { RegulatoryStatusContent } from "@/components/RegulatoryStatusModal";

const RegulatoryStatusPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-8">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/menu")}>
          <ArrowLeft className="h-6 w-6 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-paypal-dark">Regulatory Status</h1>
      </div>

      <div className="paypal-surface mt-6 rounded-3xl p-6">
        <RegulatoryStatusContent />
      </div>
    </div>
  );
};

export default RegulatoryStatusPage;
