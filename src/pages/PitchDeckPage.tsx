import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, X, TrendingUp, Globe, Zap, Shield, Wallet, Smartphone, Store, CreditCard, ArrowLeftRight, QrCode, FileText, Users, Code, Coins, Gift, BarChart3, Target, Rocket, Info } from "lucide-react";

const PitchDeckPage = () => {
  const navigate = useNavigate();

  const traction = [
    { icon: Target, label: "Top 5 Pi Testnet App", value: "Ranking" },
    { icon: Coins, label: "171,000+ Pi Staked", value: "Staking" },
    { icon: Users, label: "190,000+ Users", value: "Visits" },
    { icon: TrendingUp, label: "Growing Adoption", value: "Growth" }
  ];

  const productEcosystem = [
    { icon: Wallet, title: "OpenPay Wallet", description: "Secure wallet experience with transaction history and payment management" },
    { icon: QrCode, title: "OpenPay QR Pay", description: "Fast merchant and peer-to-peer payments" },
    { icon: Store, title: "OpenPay Merchant POS", description: "Accept payments online and offline" },
    { icon: Gift, title: "OpenPay NFT Platform", description: "Create, mint, manage, and trade NFTs" },
    { icon: CreditCard, title: "OpenUSD (OUSD)", description: "Stable digital currency designed for utility and commerce" },
    { icon: Code, title: "Developer Ecosystem", description: "Infrastructure for future Web3 applications and services" }
  ];

  const competitiveAdvantage = [
    { feature: "QR Payments", openpay: true, traditional: true, crypto: "Limited" },
    { feature: "Merchant POS", openpay: true, traditional: "Limited", crypto: "Limited" },
    { feature: "NFT Platform", openpay: true, traditional: false, crypto: "Limited" },
    { feature: "Stablecoin Utility", openpay: true, traditional: false, crypto: "Limited" },
    { feature: "Pi Ecosystem Focus", openpay: true, traditional: false, crypto: false },
    { feature: "Web3 Commerce Tools", openpay: true, traditional: false, crypto: "Limited" },
    { feature: "Creator Economy Features", openpay: true, traditional: false, crypto: "Limited" }
  ];

  const revenueStreams = [
    "Payment Processing Fees",
    "Merchant Services",
    "Premium Business Features",
    "NFT Marketplace Services",
    "API & Infrastructure Services",
    "Enterprise Integrations",
    "OpenUSD Utility Services",
    "Strategic Ecosystem Partnerships"
  ];

  const ousdFeatures = [
    "Merchant Payments",
    "Peer-to-Peer Transfers",
    "Lending",
    "Staking",
    "DeFi Services",
    "Digital Commerce",
    "Governance Participation"
  ];

  const nftUseCases = [
    "Digital Ownership",
    "Creator Monetization",
    "Loyalty Programs",
    "Membership Access",
    "Event Tickets",
    "Merchant Rewards",
    "Certifications",
    "Community Recognition"
  ];

  const roadmap = [
    { phase: "Phase 1", items: ["Wallet", "QR Payments", "Merchant Portal"] },
    { phase: "Phase 2", items: ["NFT Marketplace", "Creator Tools"] },
    { phase: "Phase 3", items: ["OpenUSD Ecosystem Expansion"] },
    { phase: "Phase 4", items: ["Merchant Network Scaling"] },
    { phase: "Phase 5", items: ["DeFi Services", "Advanced Financial Infrastructure"] },
    { phase: "Phase 6", items: ["Global Web3 Commerce Network"] }
  ];

  return (
    <div className="min-h-screen bg-white px-4 pt-4 pb-10">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 hover:bg-blue-100 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5 text-blue-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">OpenPay Pitch Deck</h1>
            <p className="text-sm text-gray-600">The Web3 Commerce & Payments Infrastructure for the Pi Ecosystem</p>
          </div>
        </div>

        {/* Slide 1 - Vision */}
        <div className="mb-8 bg-blue-600 rounded-2xl p-8 text-white">
          <div className="mb-4 text-sm font-semibold opacity-80">Slide 1 — Vision</div>
          <h2 className="text-3xl font-bold mb-4">Making Digital Payments Simple, Useful, and Accessible</h2>
          <p className="text-lg opacity-90 mb-4">
            OpenPay is building the payment and commerce infrastructure that enables people, merchants, creators, and businesses to transact seamlessly within the Pi ecosystem and the broader Web3 economy.
          </p>
          <p className="text-lg opacity-90">Our mission is to transform blockchain technology into practical everyday utility.</p>
        </div>

        {/* Slide 2 - Problem */}
        <div className="mb-8 bg-gray-50 rounded-2xl p-8 border border-gray-200">
          <div className="mb-4 text-sm font-semibold text-gray-600">Web3 Adoption Faces Major Challenges</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Current blockchain ecosystems suffer from:</h2>
          <ul className="space-y-3">
            {["Complex user experiences", "Limited merchant acceptance", "Lack of payment infrastructure", "Difficult onboarding for businesses", "Fragmented commerce solutions", "Limited real-world utility"].map((item, index) => (
              <li key={index} className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                <span className="text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <p className="text-gray-700">Millions of users hold digital assets, but few platforms make them useful for everyday transactions.</p>
          </div>
        </div>

        {/* Slide 3 - Solution */}
        <div className="mb-8 bg-blue-600 rounded-2xl p-8 text-white">
          <div className="mb-4 text-sm font-semibold opacity-80">Slide 3 — Solution</div>
          <h2 className="text-3xl font-bold mb-6">OpenPay</h2>
          <p className="text-xl mb-6 opacity-90">A complete Web3 payment ecosystem enabling:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {["Digital Wallet", "QR Payments", "Merchant POS", "P2P Transfers", "NFT Marketplace", "Stablecoin Infrastructure", "Digital Commerce Tools", "Creator Monetization"].map((item, index) => (
              <div key={index} className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
                <span className="text-sm font-medium">{item}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-lg opacity-90 text-center">OpenPay transforms digital assets into usable economic tools.</p>
        </div>

        {/* Slide 4 - Product Ecosystem */}
        <div className="mb-8 bg-gray-50 rounded-2xl p-8 border border-gray-200">
          <div className="mb-4 text-sm font-semibold text-gray-600">Slide 4 — Product Ecosystem</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Complete Product Suite</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {productEcosystem.map((product, index) => (
              <div key={index} className="bg-white rounded-xl p-5 border border-gray-200 hover:border-blue-300 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <product.icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-gray-900">{product.title}</h3>
                </div>
                <p className="text-sm text-gray-600">{product.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Slide 5 - Why Now */}
        <div className="mb-8 bg-blue-600 rounded-2xl p-8 text-white">
          <div className="mb-4 text-sm font-semibold opacity-80">Slide 5 — Why Now?</div>
          <h2 className="text-3xl font-bold mb-4">Massive Opportunity</h2>
          <div className="space-y-4 opacity-90">
            <p>The global digital payments market exceeds trillions of dollars annually.</p>
            <p>The Web3 economy continues to grow rapidly, yet user-friendly payment solutions remain limited.</p>
            <p>Pi Network has built one of the largest blockchain communities in the world, creating a unique opportunity for utility-focused applications.</p>
            <p className="font-semibold">OpenPay is positioned to become the commerce layer powering that adoption.</p>
          </div>
        </div>

        {/* Slide 6 - Market Validation */}
        <div className="mb-8 bg-gray-50 rounded-2xl p-8 border border-gray-200">
          <div className="mb-4 text-sm font-semibold text-gray-600">Slide 6 — Market Validation</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Traction</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {traction.map((stat, index) => (
              <div key={index} className="bg-white rounded-xl p-4 text-center border border-gray-200">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 mx-auto mb-2">
                  <stat.icon className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-sm font-bold text-gray-900">{stat.label}</div>
                <div className="text-xs text-gray-500">{stat.value}</div>
              </div>
            ))}
          </div>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• Growing merchant adoption and ecosystem engagement</li>
            <li>• Expanding global user base</li>
            <li>• Strong community-driven growth with minimal marketing spend</li>
          </ul>
        </div>

        {/* Slide 7 - Competitive Advantage */}
        <div className="mb-8 bg-blue-600 rounded-2xl p-8 text-white">
          <div className="mb-4 text-sm font-semibold opacity-80">Slide 7 — Competitive Advantage</div>
          <h2 className="text-2xl font-bold mb-6">Market Position</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-left py-3 px-4">Feature</th>
                  <th className="text-center py-3 px-4">OpenPay</th>
                  <th className="text-center py-3 px-4">Traditional</th>
                  <th className="text-center py-3 px-4">Crypto Wallets</th>
                </tr>
              </thead>
              <tbody>
                {competitiveAdvantage.map((row, index) => (
                  <tr key={index} className="border-b border-white/10">
                    <td className="py-3 px-4 font-medium">{row.feature}</td>
                    <td className="text-center py-3 px-4">
                      {row.openpay === true ? <Check className="h-5 w-5 mx-auto text-green-300" /> : row.openpay === false ? <X className="h-5 w-5 mx-auto text-red-300" /> : <span className="text-xs">{row.openpay}</span>}
                    </td>
                    <td className="text-center py-3 px-4">
                      {row.traditional === true ? <Check className="h-5 w-5 mx-auto text-green-300" /> : row.traditional === false ? <X className="h-5 w-5 mx-auto text-red-300" /> : <span className="text-xs">{row.traditional}</span>}
                    </td>
                    <td className="text-center py-3 px-4">
                      {row.crypto === true ? <Check className="h-5 w-5 mx-auto text-green-300" /> : row.crypto === false ? <X className="h-5 w-5 mx-auto text-red-300" /> : <span className="text-xs">{row.crypto}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Slide 8 - Business Model */}
        <div className="mb-8 bg-gray-50 rounded-2xl p-8 border border-gray-200">
          <div className="mb-4 text-sm font-semibold text-gray-600">Slide 8 — Business Model</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Revenue Streams</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {revenueStreams.map((stream, index) => (
              <div key={index} className="bg-white rounded-lg p-3 text-center border border-gray-200">
                <span className="text-sm text-gray-700">{stream}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Slide 9 - OpenUSD */}
        <div className="mb-8 bg-blue-600 rounded-2xl p-8 text-white">
          <div className="mb-4 text-sm font-semibold opacity-80">Slide 9 — OpenUSD (OUSD)</div>
          <h2 className="text-3xl font-bold mb-4">Utility Stablecoin</h2>
          <p className="text-lg mb-6 opacity-90">OpenUSD is a USD-pegged utility token designed to support:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ousdFeatures.map((feature, index) => (
              <div key={index} className="bg-white/10 rounded-lg p-3 text-center backdrop-blur-sm">
                <span className="text-sm font-medium">{feature}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-lg opacity-90 text-center">OUSD brings price stability and practical utility to the ecosystem.</p>
        </div>

        {/* Slide 10 - NFT Infrastructure */}
        <div className="mb-8 bg-gray-50 rounded-2xl p-8 border border-gray-200">
          <div className="mb-4 text-sm font-semibold text-gray-600">Slide 10 — NFT Infrastructure</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Beyond Collectibles</h2>
          <p className="text-gray-700 mb-6">OpenPay NFTs support:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {nftUseCases.map((useCase, index) => (
              <div key={index} className="bg-white rounded-lg p-3 text-center border border-gray-200">
                <span className="text-sm text-gray-700">{useCase}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-gray-700 text-center">NFTs become functional assets rather than speculative products.</p>
        </div>

        {/* Slide 11 - Roadmap */}
        <div className="mb-8 bg-blue-600 rounded-2xl p-8 text-white">
          <div className="mb-4 text-sm font-semibold opacity-80">Slide 11 — Roadmap</div>
          <h2 className="text-2xl font-bold mb-6">Development Phases</h2>
          <div className="space-y-4">
            {roadmap.map((phase, index) => (
              <div key={index} className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                <div className="font-bold mb-2">{phase.phase}</div>
                <div className="flex flex-wrap gap-2">
                  {phase.items.map((item, itemIndex) => (
                    <span key={itemIndex} className="bg-white/20 px-3 py-1 rounded-full text-sm">{item}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Slide 12 - Why OpenPay Wins */}
        <div className="mb-8 bg-gray-50 rounded-2xl p-8 border border-gray-200">
          <div className="mb-4 text-sm font-semibold text-gray-600">Slide 12 — Why OpenPay Wins</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Unified Ecosystem Approach</h2>
          <p className="text-gray-700 mb-6">
            OpenPay combines payments, commerce, stablecoins, NFTs, and merchant tools into a unified ecosystem.
            Rather than building another wallet, OpenPay is building the infrastructure that powers real-world Web3 utility.
          </p>
          <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
            <h3 className="font-bold text-gray-900 mb-4">Our focus is simple:</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-blue-600" />
                Enable users to transact
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-blue-600" />
                Enable merchants to grow
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-blue-600" />
                Enable creators to earn
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-blue-600" />
                Enable blockchain adoption through utility
              </li>
            </ul>
          </div>
        </div>

        {/* Slide 13 - Contact */}
        <div className="bg-blue-600 rounded-2xl p-8 text-white">
          <div className="mb-4 text-sm font-semibold opacity-80">Slide 13 — Contact</div>
          <h2 className="text-3xl font-bold mb-6">OpenPay</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5" />
              <div>
                <div className="text-sm opacity-80">Website</div>
                <a href="https://openpy.space" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">https://openpy.space</a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5" />
              <div>
                <div className="text-sm opacity-80">About</div>
                <button onClick={() => navigate("/about-openpay")} className="font-semibold hover:underline">https://openpy.space/about-openpay</button>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/20">
            <p className="text-sm opacity-80">Powered by MRWAIN ORGANIZATION</p>
            <p className="text-lg font-semibold mt-2">Building the future of Web3 commerce.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>© 2026 OpenPay. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default PitchDeckPage;
