import TopUpProviderPage from "@/components/TopUpProviderPage";
import {
  OUSD_SOL_DEPOSIT_ADDRESS,
  OUSD_SOL_LABEL,
  OUSD_SOL_LOGO_URL,
  OUSD_SOL_NETWORK,
} from "@/lib/ousdSol";

const TopUpOUSDSol = () => (
  <TopUpProviderPage
    providerName={OUSD_SOL_LABEL}
    providerLogoUrl={OUSD_SOL_LOGO_URL}
    depositAddress={OUSD_SOL_DEPOSIT_ADDRESS}
    depositNetwork={OUSD_SOL_NETWORK}
    qrLogoUrl={OUSD_SOL_LOGO_URL}
  />
);

export default TopUpOUSDSol;
