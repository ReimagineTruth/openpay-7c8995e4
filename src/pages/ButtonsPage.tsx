import { useMemo, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Code2, HeartHandshake, ShoppingCart, Sparkles } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";

type ButtonCard = {
  title: string;
  badge?: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  cta: string;
  action: () => void;
};

const ButtonsPage = () => {
  const navigate = useNavigate();

  const cards = useMemo<ButtonCard[]>(
    () => [
      {
        title: "Payment Links & Buttons",
        badge: "NEW FEATURES",
        description:
          "Create a shareable link and generate a website button, widget, iframe, or QR for one-time payments.",
        icon: Sparkles,
        cta: "Create button",
        action: () => navigate("/buttons/payment-links"),
      },
      {
        title: "Shopping Cart Buttons",
        badge: "NEW FEATURES",
        description:
          "Set up product-based checkout and generate Add to Cart / View Cart style embeds from your catalog.",
        icon: ShoppingCart,
        cta: "Open catalog",
        action: () => navigate("/buttons/cart"),
      },
      {
        title: "Donate",
        badge: "NEW FEATURES",
        description:
          "Accept one-time donations with a custom amount. Generate a Donate button, link, or QR in seconds.",
        icon: HeartHandshake,
        cta: "Create donate button",
        action: () => navigate("/buttons/donate"),
      },
      {
        title: "Smart Subscribe",
        badge: "NEW FEATURES",
        description:
          "Create a subscription-style checkout experience with recurring payments (coming soon).",
        icon: BadgeCheck,
        cta: "Coming soon",
        action: () => navigate("/buttons/subscribe"),
      },
      {
        title: "Developer embeds",
        description: "Need iframe or widget code? Generate it directly from your payment link share options.",
        icon: Code2,
        cta: "Generate embed code",
        action: () => navigate("/buttons/embeds"),
      },
    ],
    [navigate],
  );

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-28">
      <div className="px-4 pt-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/menu")}
              className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-paypal-dark">Buttons</h1>
              <p className="text-xs font-semibold text-muted-foreground">Create OpenPay payment buttons for your site.</p>
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white p-2 shadow-sm">
            <BrandLogo className="h-full w-full text-paypal-blue" />
          </div>
        </div>

        <div className="paypal-surface rounded-[2rem] bg-white p-5 shadow-sm border border-paypal-blue/5">
          <p className="text-sm font-semibold text-foreground">Which button would you like to add?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Select one option and OpenPay will guide you to generate a shareable link + button/embed code.
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="paypal-surface rounded-[2rem] bg-white p-6 shadow-sm border border-paypal-blue/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-paypal-blue/10">
                      <Icon className="h-6 w-6 text-paypal-blue" />
                    </div>
                    <div>
                      <p className="text-base font-black tracking-tight text-foreground">{card.title}</p>
                      {card.badge ? (
                        <span className="mt-1 inline-flex rounded-md bg-paypal-blue/10 px-2 py-0.5 text-[10px] font-black text-paypal-blue">
                          {card.badge}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-sm text-muted-foreground">{card.description}</p>

                <Button
                  className="mt-5 h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
                  onClick={card.action}
                >
                  {card.cta}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <BottomNav active="menu" />
    </div>
  );
};

export default ButtonsPage;
