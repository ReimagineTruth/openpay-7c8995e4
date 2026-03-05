import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type RegulatoryStatusModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const RegulatoryStatusContent = () => (
  <div className="space-y-4 text-sm leading-relaxed text-foreground">
    <div>
      <p className="text-base font-semibold">Regulatory Status</p>
      <p className="mt-2 text-foreground">
        OpenPay is a technology platform developed and operated by Mrwain Organization. OpenPay is not a registered
        broker-dealer, investment adviser, exchange, custodian, bank, money transmitter, or financial institution, and
        is not subject to regulation as such in any jurisdiction unless explicitly stated otherwise.
      </p>
      <p className="mt-2 text-foreground">
        OpenPay does not directly offer, solicit, arrange, execute, clear, or settle securities, digital asset trades,
        or other regulated financial transactions. OpenPay does not provide brokerage, custody, investment advisory, or
        banking services.
      </p>
      <p className="mt-2 text-foreground">
        Any regulated services, including but not limited to payments, digital asset transactions, on-ramps,
        off-ramps, custody, or financial settlement, may be provided exclusively by independent third-party providers
        that integrate with the OpenPay platform. These providers are solely responsible for their own licensing,
        regulatory compliance, and legal obligations within the jurisdictions in which they operate.
      </p>
      <p className="mt-2 text-foreground">
        Nothing on the OpenPay website, APIs, merchant portal, or mobile applications constitutes, or should be
        interpreted as, an offer to sell or a solicitation to buy any security, digital asset, financial product, or
        regulated instrument. Any such offer may only be made by the applicable third-party provider and only in
        jurisdictions where such offers are legally permitted.
      </p>
    </div>

    <div>
      <p className="text-base font-semibold">Disclaimer</p>
      <p className="mt-2 text-foreground">
        Information available through the OpenPay platform, website, APIs, and mobile applications is provided for
        general informational and technological purposes only and does not constitute financial, investment, legal,
        tax, or professional advice.
      </p>
      <p className="mt-2 text-foreground">
        OpenPay and Mrwain Organization do not endorse, control, verify, or guarantee any third-party providers,
        merchants, applications, integrations, tools, or services that may interact with the OpenPay ecosystem.
      </p>
      <p className="mt-2 text-foreground">
        OpenPay is not responsible for transactions, payments, losses, disputes, or outcomes resulting from
        interactions between users and third-party providers, merchants, or integrated services.
      </p>
      <p className="mt-2 text-foreground">
        All services are provided on an "as is" and "as available" basis without warranties of any kind, whether express
        or implied, including but not limited to warranties of accuracy, reliability, availability, security,
        merchantability, or fitness for a particular purpose.
      </p>
      <p className="mt-2 text-foreground">
        Users should carefully review the OpenPay Terms of Service and Privacy Policy for additional disclosures,
        limitations of liability, and user responsibilities.
      </p>
    </div>

    <div>
      <p className="text-base font-semibold">Pricing & Data Feeds</p>
      <p className="mt-2 text-foreground">
        Any prices, exchange rates, token values, yields, availability, transaction fees, or market data displayed
        within OpenPay - including information related to OpenUSD, Pi Network integrations, or other supported assets -
        may be provided by third-party data providers or external services.
      </p>
      <p className="mt-2 text-foreground">
        Such information may be delayed, incomplete, inaccurate, or subject to change without notice. OpenPay does not
        independently verify pricing data and makes no representations or warranties regarding the accuracy,
        timeliness, or completeness of such information.
      </p>
      <p className="mt-2 text-foreground">
        Users should independently verify all pricing, fees, and data before making decisions or initiating any
        payment or transaction.
      </p>
      <p className="mt-2 text-foreground">
        All pricing data may be indicative only and may not reflect final or executable transaction prices. Use of
        pricing information and data feeds is entirely at the user's own risk.
      </p>
    </div>
  </div>
);

const RegulatoryStatusModal = ({ open, onOpenChange }: RegulatoryStatusModalProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-2xl">
      <DialogTitle className="text-xl font-bold text-foreground">Regulatory Status</DialogTitle>
      <DialogDescription className="text-sm text-foreground">
        Important disclosures about OpenPay and third-party providers.
      </DialogDescription>
      <RegulatoryStatusContent />
      <Button
        type="button"
        className="h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
        onClick={() => onOpenChange(false)}
      >
        Close
      </Button>
    </DialogContent>
  </Dialog>
);

export default RegulatoryStatusModal;
