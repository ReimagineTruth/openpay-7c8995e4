import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, ShoppingCart, Tag, Gavel, Gift, Share2, Wallet, TrendingUp } from "lucide-react";

const ACCENT = "hsl(217 91% 60%)";

const Step = ({ icon, title, desc }: any) => (
  <div className="rounded-2xl bg-[#0f0f0f] border border-white/10 p-4 flex gap-3">
    <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${ACCENT}22`, color: ACCENT }}>
      {icon}
    </div>
    <div>
      <p className="font-bold">{title}</p>
      <p className="text-sm text-white/65 mt-1 leading-relaxed">{desc}</p>
    </div>
  </div>
);

const NftHowToPage = () => {
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <header className="sticky top-0 z-10 bg-black/85 backdrop-blur px-4 py-3 flex items-center gap-3 border-b border-white/5">
        <button onClick={() => nav(-1)} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src="/openpay-nft-logo.png" alt="OpenPay NFT" className="h-9 w-9 object-contain rounded-lg" />
        <h1 className="text-xl font-extrabold">How NFTs Work</h1>
      </header>

      <div className="p-4 space-y-4">
        <div className="rounded-3xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${ACCENT}, hsl(217 91% 35%))` }}>
          <Sparkles className="h-6 w-6" />
          <h2 className="text-xl font-extrabold mt-2">Mint, own, trade and auction</h2>
          <p className="text-sm text-white/90 mt-1">Create collectibles on OpenPay, sell from your wallet, or run auctions where the price keeps climbing until the timer ends.</p>
        </div>

        <Step icon={<Sparkles className="h-5 w-5" />} title="1. Mint your NFT"
          desc="Tap Mint, upload an image/GIF/video, set a name, code, supply and starting price. Add a royalty so you earn from every resale." />
        <Step icon={<ShoppingCart className="h-5 w-5" />} title="2. Buy from the marketplace"
          desc="Pay with OpenPay balance, Pi or a virtual card. Ownership transfers instantly and the activity is logged in the transparent history." />
        <Step icon={<Tag className="h-5 w-5" />} title="3. Resell at any price"
          desc="Once you own an NFT you can list it for resale. You can raise or lower the price any time, or cancel the listing. Original creator earns the royalty on each resale." />
        <Step icon={<Gavel className="h-5 w-5" />} title="4. Run an auction"
          desc="Set a start price, minimum bid increment and duration. Bidders' funds are escrowed; outbid users are refunded automatically. The highest bid at the end wins." />
        <Step icon={<Gift className="h-5 w-5" />} title="5. Send as a gift"
          desc="Transfer an NFT you own to any @username — perfect for collectibles, rewards and giveaways." />
        <Step icon={<Share2 className="h-5 w-5" />} title="6. Share anywhere"
          desc="Every NFT has a public link with media preview, current price and owner list. Share to socials in one tap." />
        <Step icon={<Wallet className="h-5 w-5" />} title="Earnings & royalties"
          desc="Primary sales pay you directly. Royalty payouts from resales appear in the Creator Dashboard, alongside totals and item performance." />
        <Step icon={<TrendingUp className="h-5 w-5" />} title="Transparency"
          desc="Every mint, sale, resale, gift and bid is recorded on-chain-style in nft_transactions — visible to everyone, forever." />

        <div className="rounded-2xl bg-[#0f0f0f] border border-white/10 p-4 text-sm text-white/70">
          <p className="font-bold text-white">Tips</p>
          <ul className="mt-2 space-y-1 list-disc pl-4">
            <li>Use a clear square image for the best marketplace preview.</li>
            <li>Set the supply higher than 1 for editions; set it to 1 for a unique piece.</li>
            <li>Royalties are capped at 50%.</li>
            <li>You can't bid on your own auction.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default NftHowToPage;
