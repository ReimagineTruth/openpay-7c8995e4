import TopUpProviderPage from "@/components/TopUpProviderPage";

const OUSD_LOGO_URL = "/openpay-o.svg";
const OUSD_ADDRESS = "GDSXE723WPHZ5RGIJCSYXTPKSOIGPTSXE4RF5U3JTNGTCHXON7ZVD4LJ"; // TODO: Replace with actual OUSD contract address
const OUSD_NETWORK = "Pi Launchpad"; // TODO: Update with actual network details

const TopUpOUSD = () => (
  <TopUpProviderPage
    providerName="OUSD"
    providerLogoUrl={OUSD_LOGO_URL}
    depositAddress={OUSD_ADDRESS}
    depositNetwork={OUSD_NETWORK}
    qrLogoUrl={OUSD_LOGO_URL}
  />
);

export default TopUpOUSD;
