import TopUpProviderPage from "@/components/TopUpProviderPage";

const USDT_LOGO_URL = "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/usdt.png";
const USDT_ADDRESS = "TP6KytPEDGgBvqy5aKvFiFtuQwAXtL1dJC";
const USDT_NETWORK = "Tron (TRC20)";

const TopUpUSDT = () => (
  <TopUpProviderPage
    providerName="USDT"
    providerLogoUrl={USDT_LOGO_URL}
    depositAddress={USDT_ADDRESS}
    depositNetwork={USDT_NETWORK}
    qrLogoUrl={USDT_LOGO_URL}
  />
);

export default TopUpUSDT;

