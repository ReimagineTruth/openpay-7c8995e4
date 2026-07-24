// Public read-only NFT API for external integration (e.g. OpenLedger).
// No authentication required. CORS-open. Cached briefly at the edge.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// Public marketplace base — used to build shareable permalinks for OpenLedger.
const SITE_BASE = (Deno.env.get("OPENPAY_PUBLIC_SITE") || "https://openpay.lovable.app").replace(/\/+$/, "");

const itemUrl = (id: string) => `${SITE_BASE}/web3/nft/${id}`;
const collectionUrl = (id: string) => `${SITE_BASE}/web3/nft?collection=${id}`;
const marketplaceUrl = () => `${SITE_BASE}/web3/nft`;
const storeUrl = (handle: string) => `${SITE_BASE}/web3/nft/store/${handle}`;
const auctionsUrl = () => `${SITE_BASE}/web3/nft?tab=auctions`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string) => UUID_RE.test(v);

const json = (body: unknown, status = 200, cache = 15) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": `public, s-maxage=${cache}, stale-while-revalidate=60`,
    },
  });

const parseLimit = (v: string | null, def = 50, max = 200) => {
  const n = Number(v || def);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), max);
};
const parseOffset = (v: string | null) => {
  const n = Number(v || 0);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};

type StoreLite = {
  user_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean | null;
};

const buildStore = (s: StoreLite | undefined | null, userId: string | null) => {
  if (!s) return userId ? { user_id: userId, handle: null, display_name: null, avatar_url: null, is_verified: false, url: null } : null;
  return {
    user_id: s.user_id,
    handle: s.handle,
    display_name: s.display_name,
    avatar_url: s.avatar_url,
    is_verified: !!s.is_verified,
    url: s.handle ? storeUrl(s.handle) : null,
  };
};

const enrichItem = (it: Record<string, unknown>, storeMap: Record<string, StoreLite>) => {
  const id = String(it.id);
  const creatorId = (it.creator_id as string) || null;
  const image = (it.media_url as string) || (it.image_url as string) || null;
  return {
    ...it,
    image,
    permalink: itemUrl(id),
    marketplace_url: marketplaceUrl(),
    collection_url: it.collection_id ? collectionUrl(String(it.collection_id)) : null,
    store: buildStore(creatorId ? storeMap[creatorId] : null, creatorId),
  };
};

const fetchStores = async (supabase: ReturnType<typeof createClient>, userIds: (string | null | undefined)[]): Promise<Record<string, StoreLite>> => {
  const ids = Array.from(new Set(userIds.filter((x): x is string => !!x)));
  if (!ids.length) return {};
  const { data } = await supabase
    .from("nft_store_profiles")
    .select("user_id, handle, display_name, avatar_url, is_verified")
    .in("user_id", ids);
  const map: Record<string, StoreLite> = {};
  for (const s of (data || []) as StoreLite[]) map[s.user_id] = s;
  return map;
};

const fetchItemsMap = async (supabase: ReturnType<typeof createClient>, itemIds: (string | null | undefined)[]) => {
  const ids = Array.from(new Set(itemIds.filter((x): x is string => !!x)));
  if (!ids.length) return {} as Record<string, Record<string, unknown>>;
  const { data } = await supabase
    .from("nft_items")
    .select("id, name, code, image_url, media_url, collection_id, creator_id, price, currency")
    .in("id", ids);
  const map: Record<string, Record<string, unknown>> = {};
  for (const r of (data || []) as Record<string, unknown>[]) map[String(r.id)] = r;
  return map;
};

const itemSummary = (
  item: Record<string, unknown> | null | undefined,
  storeMap: Record<string, StoreLite>,
) => {
  if (!item) return null;
  const creatorId = (item.creator_id as string) || null;
  const id = String(item.id);
  return {
    id: item.id,
    name: item.name,
    code: item.code,
    image: (item.media_url as string) || (item.image_url as string) || null,
    image_url: item.image_url,
    media_url: item.media_url,
    collection_id: item.collection_id,
    creator_id: item.creator_id,
    permalink: itemUrl(id),
    collection_url: item.collection_id ? collectionUrl(String(item.collection_id)) : null,
    store: buildStore(creatorId ? storeMap[creatorId] : null, creatorId),
  };
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/nft-public-api\/?/, "").replace(/\/+$/, "");
  const parts = path.split("/").filter(Boolean);

  try {
    // GET / — API index
    if (parts.length === 0) {
      return json({
        name: "OpenPay NFT Public API",
        version: "2.0.0",
        description: "Complete read-only feed of every NFT collection, item, store, listing, auction, owner, and transaction across the OpenPay marketplace. Every record embeds a public permalink, image URL, currency, and creator store info for OpenLedger integration.",
        site: SITE_BASE,
        endpoints: [
          "GET /stats",
          "GET /collections",
          "GET /collections/:id",
          "GET /collections/:id/items",
          "GET /items",
          "GET /items/:id",
          "GET /items/:id/owners",
          "GET /items/:id/transactions",
          "GET /items/:id/listings",
          "GET /items/:id/auctions",
          "GET /stores",
          "GET /stores/:handle",
          "GET /stores/:handle/items",
          "GET /stores/:handle/transactions",
          "GET /owners/:user_id",
          "GET /listings",
          "GET /auctions",
          "GET /auctions/:id",
          "GET /auctions/:id/bids",
          "GET /transactions",
          "GET /transactions/:id",
          "GET /activity",
          "GET /activity/mints",
          "GET /activity/sales",
          "GET /activity/auctions",
          "GET /activity/gifts",
        ],
        docs: `${SITE_BASE}/web3/nft/api`,
      }, 200, 300);
    }

    // ---------- /stats ----------
    if (parts[0] === "stats" && parts.length === 1) {
      const [
        { count: collections },
        { count: items },
        { count: stores },
        { count: mints },
        { count: sales },
        { count: auctionsCount },
        { count: liveAuctions },
        { count: activeListings },
        { count: owners },
      ] = await Promise.all([
        supabase.from("nft_collections").select("id", { count: "exact", head: true }),
        supabase.from("nft_items").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("nft_store_profiles").select("id", { count: "exact", head: true }),
        supabase.from("nft_transactions").select("id", { count: "exact", head: true }).eq("tx_kind", "mint"),
        supabase.from("nft_transactions").select("id", { count: "exact", head: true }).in("tx_kind", ["sale", "primary_sale", "resale", "auction_settle"]),
        supabase.from("nft_auctions").select("id", { count: "exact", head: true }),
        supabase.from("nft_auctions").select("id", { count: "exact", head: true }).eq("status", "live"),
        supabase.from("nft_listings").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("nft_ownership").select("id", { count: "exact", head: true }),
      ]);
      const { data: volumeRows } = await supabase
        .from("nft_transactions")
        .select("total, currency, tx_kind")
        .eq("status", "completed");
      const volume: Record<string, number> = {};
      const volumeByKind: Record<string, Record<string, number>> = {};
      for (const r of volumeRows || []) {
        const row = r as { currency: string; total: number; tx_kind: string };
        const c = row.currency || "OUSD";
        const t = Number(row.total || 0);
        volume[c] = (volume[c] || 0) + t;
        volumeByKind[row.tx_kind] ||= {};
        volumeByKind[row.tx_kind][c] = (volumeByKind[row.tx_kind][c] || 0) + t;
      }
      return json({
        collections: collections ?? 0,
        active_items: items ?? 0,
        stores: stores ?? 0,
        owner_records: owners ?? 0,
        mints: mints ?? 0,
        sales: sales ?? 0,
        auctions: auctionsCount ?? 0,
        live_auctions: liveAuctions ?? 0,
        active_listings: activeListings ?? 0,
        total_volume: volume,
        volume_by_kind: volumeByKind,
        marketplace_url: marketplaceUrl(),
        generated_at: new Date().toISOString(),
      }, 200, 60);
    }

    // ---------- /collections ----------
    if (parts[0] === "collections" && parts.length === 1) {
      const limit = parseLimit(url.searchParams.get("limit"));
      const offset = parseOffset(url.searchParams.get("offset"));
      const { data, error } = await supabase
        .from("nft_collections")
        .select("id, name, code, description, cover_url, royalty_pct, creator_id, created_at")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      const stores = await fetchStores(supabase, (data || []).map((c: Record<string, unknown>) => c.creator_id as string));
      const collections = (data || []).map((c: Record<string, unknown>) => ({
        ...c,
        image: c.cover_url ?? null,
        permalink: collectionUrl(String(c.id)),
        store: buildStore(stores[c.creator_id as string], (c.creator_id as string) || null),
      }));
      return json({ collections, pagination: { limit, offset } });
    }

    if (parts[0] === "collections" && parts.length === 2) {
      const key = parts[1];
      const { data, error } = await supabase
        .from("nft_collections")
        .select("id, name, code, description, cover_url, royalty_pct, creator_id, created_at")
        .eq(isUuid(key) ? "id" : "code", key)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Collection not found" }, 404);
      const [{ count: itemsCount }, stores] = await Promise.all([
        supabase.from("nft_items").select("id", { count: "exact", head: true }).eq("collection_id", data.id),
        fetchStores(supabase, [data.creator_id as string]),
      ]);
      return json({
        collection: {
          ...data,
          image: (data as Record<string, unknown>).cover_url ?? null,
          permalink: collectionUrl(String(data.id)),
          items_count: itemsCount ?? 0,
          store: buildStore(stores[data.creator_id as string], (data.creator_id as string) || null),
        },
      });
    }

    if (parts[0] === "collections" && parts.length === 3 && parts[2] === "items") {
      const limit = parseLimit(url.searchParams.get("limit"));
      const offset = parseOffset(url.searchParams.get("offset"));
      const { data, error } = await supabase
        .from("nft_items")
        .select("id, collection_id, name, code, description, image_url, media_url, media_type, price, currency, quantity_total, quantity_minted, category, creator_id, created_at")
        .eq("collection_id", parts[1])
        .eq("is_active", true)
        .eq("hidden", false)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      const stores = await fetchStores(supabase, (data || []).map((i: Record<string, unknown>) => i.creator_id as string));
      return json({ items: (data || []).map((i: Record<string, unknown>) => enrichItem(i, stores)), pagination: { limit, offset } });
    }

    // ---------- /items ----------
    if (parts[0] === "items" && parts.length === 1) {
      const limit = parseLimit(url.searchParams.get("limit"));
      const offset = parseOffset(url.searchParams.get("offset"));
      const creator = url.searchParams.get("creator_id");
      const category = url.searchParams.get("category");
      const collectionId = url.searchParams.get("collection_id");
      let q = supabase
        .from("nft_items")
        .select("id, collection_id, name, code, image_url, media_url, media_type, price, currency, quantity_total, quantity_minted, category, creator_id, created_at")
        .eq("is_active", true)
        .eq("hidden", false)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (creator) q = q.eq("creator_id", creator);
      if (category) q = q.eq("category", category);
      if (collectionId) q = q.eq("collection_id", collectionId);
      const { data, error } = await q;
      if (error) throw error;
      const stores = await fetchStores(supabase, (data || []).map((i: Record<string, unknown>) => i.creator_id as string));
      return json({ items: (data || []).map((i: Record<string, unknown>) => enrichItem(i, stores)), pagination: { limit, offset } });
    }

    if (parts[0] === "items" && parts.length === 2) {
      const key = parts[1];
      const { data, error } = await supabase
        .from("nft_items")
        .select("id, collection_id, creator_id, name, code, description, image_url, media_url, media_type, price, currency, quantity_total, quantity_minted, category, properties, created_at")
        .eq(isUuid(key) ? "id" : "code", key)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Item not found" }, 404);
      const stores = await fetchStores(supabase, [data.creator_id as string]);
      return json({ item: enrichItem(data as Record<string, unknown>, stores) });
    }

    // /items/:id/owners
    if (parts[0] === "items" && parts.length === 3 && parts[2] === "owners") {
      const limit = parseLimit(url.searchParams.get("limit"));
      const offset = parseOffset(url.searchParams.get("offset"));
      const { data, error } = await supabase
        .from("nft_ownership")
        .select("id, item_id, owner_id, quantity, acquired_at, updated_at")
        .eq("item_id", parts[1])
        .gt("quantity", 0)
        .order("quantity", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      const stores = await fetchStores(supabase, (data || []).map((r: Record<string, unknown>) => r.owner_id as string));
      const owners = (data || []).map((r: Record<string, unknown>) => ({
        ...r,
        owner: buildStore(stores[r.owner_id as string], r.owner_id as string),
      }));
      return json({ item_id: parts[1], owners, pagination: { limit, offset } });
    }

    // /items/:id/transactions
    if (parts[0] === "items" && parts.length === 3 && parts[2] === "transactions") {
      return await transactionsResponse(supabase, url, { itemId: parts[1] });
    }

    // /items/:id/listings
    if (parts[0] === "items" && parts.length === 3 && parts[2] === "listings") {
      const { data, error } = await supabase
        .from("nft_listings")
        .select("id, item_id, seller_id, price, quantity, currency, status, created_at, updated_at")
        .eq("item_id", parts[1])
        .order("created_at", { ascending: false })
        .limit(parseLimit(url.searchParams.get("limit")));
      if (error) throw error;
      const stores = await fetchStores(supabase, (data || []).map((r: Record<string, unknown>) => r.seller_id as string));
      return json({
        listings: (data || []).map((r: Record<string, unknown>) => ({
          ...r,
          seller: buildStore(stores[r.seller_id as string], r.seller_id as string),
          item_url: itemUrl(String(r.item_id)),
        })),
      });
    }

    // /items/:id/auctions
    if (parts[0] === "items" && parts.length === 3 && parts[2] === "auctions") {
      const { data, error } = await supabase
        .from("nft_auctions")
        .select("id, item_id, seller_id, quantity, start_price, min_increment, current_bid, current_bidder, currency, ends_at, status, winner_id, created_at")
        .eq("item_id", parts[1])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ auctions: (data || []).map((a) => ({ ...a, item_url: itemUrl(String((a as Record<string, unknown>).item_id)) })) });
    }

    // ---------- /stores ----------
    if (parts[0] === "stores" && parts.length === 1) {
      const limit = parseLimit(url.searchParams.get("limit"));
      const offset = parseOffset(url.searchParams.get("offset"));
      const verifiedOnly = url.searchParams.get("verified") === "true";
      let q = supabase
        .from("nft_store_profiles")
        .select("user_id, handle, display_name, bio, avatar_url, banner_url, is_verified, category, view_count, created_at")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (verifiedOnly) q = q.eq("is_verified", true);
      const { data, error } = await q;
      if (error) throw error;
      return json({
        stores: (data || []).map((s: Record<string, unknown>) => ({ ...s, url: s.handle ? storeUrl(String(s.handle)) : null })),
        pagination: { limit, offset },
      });
    }

    if (parts[0] === "stores" && parts.length === 2) {
      const { data: store, error } = await supabase
        .from("nft_store_profiles")
        .select("user_id, handle, display_name, avatar_url, banner_url, bio, is_verified, category, view_count, website_url, twitter_url, instagram_url, discord_url, telegram_url, created_at")
        .eq("handle", parts[1])
        .maybeSingle();
      if (error) throw error;
      if (!store) return json({ error: "Store not found" }, 404);
      const [{ data: items }, { count: followers }, { count: itemCount }] = await Promise.all([
        supabase.from("nft_items")
          .select("id, collection_id, name, code, image_url, media_url, price, currency, quantity_total, quantity_minted, category, creator_id, created_at")
          .eq("creator_id", store.user_id).eq("is_active", true).eq("hidden", false)
          .order("created_at", { ascending: false }).limit(50),
        supabase.from("nft_store_follows").select("id", { count: "exact", head: true }).eq("followed_id", store.user_id),
        supabase.from("nft_items").select("id", { count: "exact", head: true }).eq("creator_id", store.user_id).eq("is_active", true),
      ]);
      const storeMap: Record<string, StoreLite> = { [store.user_id]: store as StoreLite };
      return json({
        store: { ...store, url: storeUrl(store.handle), followers: followers ?? 0, items_count: itemCount ?? 0 },
        items: (items || []).map((i: Record<string, unknown>) => enrichItem(i, storeMap)),
      });
    }

    if (parts[0] === "stores" && parts.length === 3 && parts[2] === "items") {
      const { data: store } = await supabase.from("nft_store_profiles").select("user_id, handle, display_name, avatar_url, is_verified").eq("handle", parts[1]).maybeSingle();
      if (!store) return json({ error: "Store not found" }, 404);
      const limit = parseLimit(url.searchParams.get("limit"));
      const offset = parseOffset(url.searchParams.get("offset"));
      const { data, error } = await supabase
        .from("nft_items")
        .select("id, collection_id, name, code, image_url, media_url, price, currency, quantity_total, quantity_minted, category, creator_id, created_at")
        .eq("creator_id", store.user_id).eq("is_active", true).eq("hidden", false)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      const storeMap: Record<string, StoreLite> = { [store.user_id]: store as StoreLite };
      return json({ items: (data || []).map((i: Record<string, unknown>) => enrichItem(i, storeMap)), pagination: { limit, offset } });
    }

    if (parts[0] === "stores" && parts.length === 3 && parts[2] === "transactions") {
      const { data: store } = await supabase.from("nft_store_profiles").select("user_id").eq("handle", parts[1]).maybeSingle();
      if (!store) return json({ error: "Store not found" }, 404);
      return await transactionsResponse(supabase, url, { sellerId: store.user_id as string });
    }

    // ---------- /owners/:user_id ----------
    if (parts[0] === "owners" && parts.length === 2) {
      const limit = parseLimit(url.searchParams.get("limit"));
      const offset = parseOffset(url.searchParams.get("offset"));
      const { data, error } = await supabase
        .from("nft_ownership")
        .select("id, item_id, owner_id, quantity, acquired_at, updated_at")
        .eq("owner_id", parts[1])
        .gt("quantity", 0)
        .order("updated_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      const itemMap = await fetchItemsMap(supabase, (data || []).map((r: Record<string, unknown>) => r.item_id as string));
      const stores = await fetchStores(supabase, Object.values(itemMap).map((i) => i.creator_id as string));
      return json({
        owner_id: parts[1],
        holdings: (data || []).map((r: Record<string, unknown>) => ({
          ...r,
          item: itemSummary(itemMap[String(r.item_id)], stores),
        })),
        pagination: { limit, offset },
      });
    }

    // ---------- /listings ----------
    if (parts[0] === "listings" && parts.length === 1) {
      const limit = parseLimit(url.searchParams.get("limit"));
      const offset = parseOffset(url.searchParams.get("offset"));
      const status = url.searchParams.get("status") || "active";
      const { data, error } = await supabase
        .from("nft_listings")
        .select("id, item_id, seller_id, price, quantity, currency, status, created_at, updated_at")
        .eq("status", status)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      const itemMap = await fetchItemsMap(supabase, (data || []).map((r: Record<string, unknown>) => r.item_id as string));
      const stores = await fetchStores(supabase, [
        ...Object.values(itemMap).map((i) => i.creator_id as string),
        ...(data || []).map((r: Record<string, unknown>) => r.seller_id as string),
      ]);
      return json({
        listings: (data || []).map((r: Record<string, unknown>) => ({
          ...r,
          item: itemSummary(itemMap[String(r.item_id)], stores),
          seller: buildStore(stores[r.seller_id as string], r.seller_id as string),
        })),
        pagination: { limit, offset },
      });
    }

    // ---------- /auctions ----------
    if (parts[0] === "auctions" && parts.length === 1) {
      const limit = parseLimit(url.searchParams.get("limit"));
      const offset = parseOffset(url.searchParams.get("offset"));
      const status = url.searchParams.get("status");
      let q = supabase
        .from("nft_auctions")
        .select("id, item_id, seller_id, quantity, start_price, min_increment, current_bid, current_bidder, currency, ends_at, status, winner_id, created_at, updated_at")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      const itemMap = await fetchItemsMap(supabase, (data || []).map((r: Record<string, unknown>) => r.item_id as string));
      const stores = await fetchStores(supabase, [
        ...Object.values(itemMap).map((i) => i.creator_id as string),
        ...(data || []).map((r: Record<string, unknown>) => r.seller_id as string),
      ]);
      return json({
        auctions: (data || []).map((r: Record<string, unknown>) => ({
          ...r,
          item: itemSummary(itemMap[String(r.item_id)], stores),
          seller: buildStore(stores[r.seller_id as string], r.seller_id as string),
          url: auctionsUrl(),
        })),
        pagination: { limit, offset },
      });
    }

    if (parts[0] === "auctions" && parts.length === 2) {
      const { data, error } = await supabase
        .from("nft_auctions")
        .select("id, item_id, seller_id, quantity, start_price, min_increment, current_bid, current_bidder, currency, ends_at, status, winner_id, created_at, updated_at")
        .eq("id", parts[1]).maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Auction not found" }, 404);
      const itemMap = await fetchItemsMap(supabase, [data.item_id as string]);
      const stores = await fetchStores(supabase, [data.seller_id as string, (itemMap[String(data.item_id)]?.creator_id as string) || null]);
      const { data: bids } = await supabase
        .from("nft_auction_bids")
        .select("id, bidder_id, amount, payment_method, fee_amount, created_at")
        .eq("auction_id", parts[1])
        .order("amount", { ascending: false });
      return json({
        auction: {
          ...data,
          item: itemSummary(itemMap[String(data.item_id)], stores),
          seller: buildStore(stores[data.seller_id as string], data.seller_id as string),
          url: auctionsUrl(),
        },
        bids: bids || [],
      });
    }

    if (parts[0] === "auctions" && parts.length === 3 && parts[2] === "bids") {
      const { data, error } = await supabase
        .from("nft_auction_bids")
        .select("id, auction_id, bidder_id, amount, payment_method, fee_amount, created_at")
        .eq("auction_id", parts[1])
        .order("amount", { ascending: false });
      if (error) throw error;
      return json({ auction_id: parts[1], bids: data || [] });
    }

    // ---------- /transactions ----------
    if (parts[0] === "transactions" && parts.length === 1) {
      return await transactionsResponse(supabase, url, {});
    }

    if (parts[0] === "transactions" && parts.length === 2) {
      const { data, error } = await supabase
        .from("nft_transactions")
        .select("id, item_id, listing_id, seller_id, buyer_id, quantity, price_each, total, royalty_amount, platform_fee, currency, payment_method, tx_kind, status, tx_ref, created_at")
        .eq("id", parts[1]).maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Transaction not found" }, 404);
      const itemMap = await fetchItemsMap(supabase, [data.item_id as string]);
      const stores = await fetchStores(supabase, [
        data.seller_id as string,
        data.buyer_id as string,
        (itemMap[String(data.item_id)]?.creator_id as string) || null,
      ]);
      return json({
        transaction: {
          ...data,
          type: data.tx_kind,
          item: itemSummary(itemMap[String(data.item_id)], stores),
          seller: buildStore(stores[data.seller_id as string], data.seller_id as string),
          buyer: buildStore(stores[data.buyer_id as string], data.buyer_id as string),
        },
      });
    }

    // ---------- /activity ----------
    if (parts[0] === "activity") {
      const kindsMap: Record<string, string[]> = {
        mints: ["mint"],
        sales: ["sale", "primary_sale", "resale"],
        auctions: ["auction_settle", "auction_start", "bid"],
        gifts: ["gift"],
      };
      const kinds = parts[1] ? kindsMap[parts[1]] : null;
      return await transactionsResponse(supabase, url, { kinds });
    }

    return json({ error: "Not found", path }, 404);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return json({ error: msg }, 500);
  }
});

// Shared transactions/activity fetcher
async function transactionsResponse(
  supabase: ReturnType<typeof createClient>,
  url: URL,
  opts: { itemId?: string; sellerId?: string; buyerId?: string; kinds?: string[] | null },
) {
  const limit = parseLimit(url.searchParams.get("limit"));
  const offset = parseOffset(url.searchParams.get("offset"));
  const collectionId = url.searchParams.get("collection_id");
  const currency = url.searchParams.get("currency");
  const paymentMethod = url.searchParams.get("payment_method");
  const since = url.searchParams.get("since");

  let q = supabase
    .from("nft_transactions")
    .select("id, item_id, listing_id, seller_id, buyer_id, quantity, price_each, total, royalty_amount, platform_fee, currency, payment_method, tx_kind, status, tx_ref, created_at, nft_items!inner(id, name, code, image_url, media_url, collection_id, creator_id)")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.kinds && opts.kinds.length) q = q.in("tx_kind", opts.kinds);
  if (opts.itemId) q = q.eq("item_id", opts.itemId);
  if (opts.sellerId) q = q.eq("seller_id", opts.sellerId);
  if (opts.buyerId) q = q.eq("buyer_id", opts.buyerId);
  if (collectionId) q = q.eq("nft_items.collection_id", collectionId);
  if (currency) q = q.eq("currency", currency);
  if (paymentMethod) q = q.eq("payment_method", paymentMethod);
  if (since) q = q.gte("created_at", since);

  const kindParam = url.searchParams.get("kind");
  if (kindParam) q = q.eq("tx_kind", kindParam);

  const { data, error } = await q;
  if (error) throw error;

  const userIds: string[] = [];
  const rows = (data || []) as Record<string, unknown>[];
  for (const r of rows) {
    if (r.seller_id) userIds.push(r.seller_id as string);
    if (r.buyer_id) userIds.push(r.buyer_id as string);
    const item = r.nft_items as Record<string, unknown> | null;
    if (item?.creator_id) userIds.push(item.creator_id as string);
  }
  const stores = await fetchStores(supabase, userIds);

  const activity = rows.map((r) => {
    const item = r.nft_items as Record<string, unknown> | null;
    return {
      id: r.id,
      type: r.tx_kind,
      status: r.status,
      quantity: r.quantity,
      price_each: r.price_each,
      total: r.total,
      royalty_amount: r.royalty_amount,
      platform_fee: r.platform_fee,
      currency: r.currency,
      payment_method: r.payment_method,
      tx_ref: r.tx_ref,
      seller_id: r.seller_id,
      buyer_id: r.buyer_id,
      seller: buildStore(stores[r.seller_id as string], (r.seller_id as string) || null),
      buyer: buildStore(stores[r.buyer_id as string], (r.buyer_id as string) || null),
      created_at: r.created_at,
      item: itemSummary(item, stores),
      marketplace_url: marketplaceUrl(),
    };
  });

  return json({ activity, transactions: activity, pagination: { limit, offset } });
}
