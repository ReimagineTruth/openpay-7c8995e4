import TopUpProviderPage from "@/components/TopUpProviderPage";

const MRWN_LOGO_URL = "https://i.ibb.co/tTZvkjmN/a078a5ec-3c63-4ec5-8ade-f270722deab5-1-removebg-preview.png";
const MRWN_ADDRESS = "GDSXE723WPHZ5RGIJCSYXTPKSOIGPTSXE4RF5U3JTNGTCHXON7ZVD4LJ"; // TODO: Replace with actual MRWN contract address
const MRWN_NETWORK = "Pi Launchpad"; // TODO: Update with actual network details

const TopUpMRWN = () => (
  <TopUpProviderPage
    providerName="MRWN"
    providerLogoUrl={MRWN_LOGO_URL}
    depositAddress={MRWN_ADDRESS}
    depositNetwork={MRWN_NETWORK}
    qrLogoUrl={MRWN_LOGO_URL}
  />
);

export default TopUpMRWN;
