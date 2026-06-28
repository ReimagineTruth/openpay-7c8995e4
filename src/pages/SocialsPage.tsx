import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Globe, MessageCircle, Send } from "lucide-react";

type SocialLink = {
  label: string;
  url: string;
  icon: typeof Globe;
  description?: string;
};

type SocialGroup = {
  org: string;
  tagline: string;
  accent: string;
  logo?: string;
  links: SocialLink[];
};

const GROUPS: SocialGroup[] = [
  {
    org: "OpenPay",
    tagline: "Official channels for the OpenPay payments platform",
    accent: "from-paypal-blue to-[#072a7a]",
    links: [
      { label: "All OpenPay Socials", url: "https://droplink.space/@openpay", icon: Globe, description: "Linktree of every official channel" },
      { label: "Website", url: "https://www.openpy.space/", icon: Globe },
      { label: "Blog", url: "https://www.openpy.space/blog", icon: Globe },
      { label: "Telegram Community", url: "https://t.me/openpayofficial", icon: Send },
      { label: "Telegram Support", url: "https://t.me/openpayofficial", icon: MessageCircle },
    ],
  },
  {
    org: "Mrwain Organization",
    tagline: "Builders of OpenPay and the wider Mrwain ecosystem",
    accent: "from-[#0b1e4f] to-[#1a3a8a]",
    links: [
      { label: "All Mrwain Socials", url: "https://droplink.space/@mrwain", icon: Globe, description: "Linktree of every official channel" },
      { label: "Website", url: "https://mrwain.org", icon: Globe },
      { label: "Telegram", url: "https://t.me/mrwainorg", icon: Send },
    ],
  },
];

const SocialsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-12">
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-paypal-dark">Socials</h1>
          <p className="text-xs text-muted-foreground">Follow OpenPay & Mrwain Organization</p>
        </div>
      </div>

      <div className="space-y-5">
        {GROUPS.map((group) => (
          <section key={group.org} className="paypal-surface overflow-hidden rounded-3xl">
            <div className={`bg-gradient-to-br ${group.accent} px-5 py-5 text-white`}>
              <h2 className="text-lg font-extrabold tracking-tight">{group.org}</h2>
              <p className="mt-1 text-sm text-white/85">{group.tagline}</p>
            </div>

            <ul className="divide-y divide-border/60">
              {group.links.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={`${group.org}-${link.label}`}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-secondary/60 active:bg-secondary"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paypal-blue/10 text-paypal-blue">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">{link.label}</p>
                        {link.description && (
                          <p className="text-xs text-muted-foreground">{link.description}</p>
                        )}
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
};

export default SocialsPage;
