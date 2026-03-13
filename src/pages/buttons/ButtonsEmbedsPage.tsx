import { ArrowLeft, Code2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BrandLogo from "@/components/BrandLogo";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";

const ButtonsEmbedsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-28">
      <div className="px-4 pt-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/buttons")}
              className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-paypal-dark">Developer embeds</h1>
              <p className="text-xs font-semibold text-muted-foreground">Widget + iframe code.</p>
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white p-2 shadow-sm">
            <BrandLogo className="h-full w-full text-paypal-blue" />
          </div>
        </div>

        <div className="paypal-surface rounded-[2rem] bg-white p-6 shadow-sm border border-paypal-blue/5">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-paypal-blue/10">
              <Code2 className="h-6 w-6 text-paypal-blue" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-black tracking-tight text-foreground">Embed options</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a payment link, then copy embed code to place OpenPay checkout inside your site.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Button
              className="h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
              onClick={() => navigate("/payment-links/create?share_tab=iframe")}
            >
              Generate iframe
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full rounded-2xl"
              onClick={() => navigate("/payment-links/create?share_tab=widget")}
            >
              Generate widget
            </Button>
          </div>
        </div>
      </div>

      <BottomNav active="menu" />
    </div>
  );
};

export default ButtonsEmbedsPage;

