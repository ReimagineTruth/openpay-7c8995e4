import TopUpProviderPage from "@/components/TopUpProviderPage";

const USDC_LOGO_URL = "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/usdc.png";
const USDC_ADDRESS = "0x40c8ffe98d2d41a06081e3a4990c1b56c8927309";
const USDC_NETWORK = "Ethereum (ERC20)";

const TopUpUSDC = () => (
  <TopUpProviderPage
    providerName="USDC"
    providerLogoUrl={USDC_LOGO_URL}
    depositAddress={USDC_ADDRESS}
    depositNetwork={USDC_NETWORK}
    qrLogoUrl={USDC_LOGO_URL}
  />
);

export default TopUpUSDC;

