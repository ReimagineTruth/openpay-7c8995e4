import { useNavigate } from "react-router-dom";
import { Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFeatureMaintenance } from "@/hooks/useFeatureMaintenance";

type Props = {
  featureKey: string;
  children: React.ReactNode;
};

/**
 * Blocks a feature route when admins have enabled maintenance for `featureKey`.
 */
export default function FeatureMaintenanceGate({ featureKey, children }: Props) {
  const navigate = useNavigate();
  const { loading, maintenance, message } = useFeatureMaintenance(featureKey);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (maintenance) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <div className="mb-4 rounded-2xl bg-amber-500/10 p-4 text-amber-600">
          <Wrench className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Under maintenance</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{message}</p>
        <Button
          type="button"
          variant="outline"
          className="mt-6 rounded-full"
          onClick={() => navigate("/dashboard", { replace: true })}
        >
          Back to dashboard
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
