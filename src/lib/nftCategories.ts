export interface NftCategory {
  id: string;
  label: string;
  emoji: string;
}

export const NFT_CATEGORIES: NftCategory[] = [
  { id: "general", label: "General", emoji: "✨" },
  { id: "art", label: "Art", emoji: "🎨" },
  { id: "gaming", label: "Gaming", emoji: "🎮" },
  { id: "music", label: "Music", emoji: "🎵" },
  { id: "collectibles", label: "Collectibles", emoji: "🪙" },
  { id: "photography", label: "Photography", emoji: "📷" },
  { id: "sports", label: "Sports", emoji: "🏆" },
  { id: "utility", label: "Utility", emoji: "🔑" },
  { id: "membership", label: "Membership", emoji: "🎟️" },
  { id: "virtual", label: "Virtual World", emoji: "🌐" },
];

export const getCategoryMeta = (id?: string | null) =>
  NFT_CATEGORIES.find((c) => c.id === (id || "general")) || NFT_CATEGORIES[0];
