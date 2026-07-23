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

const fetchStores = async (supabase: ReturnType<typeof createClient>, userIds: string[]): Promise<Record<string, StoreLite>> => {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!ids.length) return {};
  const { data } = await supabase
    .from("nft_store_profiles")
    .select("user_id, handle, display_name, avatar_url, is_verified")
    .in("user_id", ids);
  const map: Record<string, StoreLite> = {};
  for (const s of (data || []) as StoreLite[]) map[s.user_id] = s;
  return map;
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
        version: "1.1.0",
        description: "Read-only feed of mint, sale, auction, gift, and transfer activity across OpenPay NFT collections. Every item, collection, and activity record includes a public permalink, image URL, and creator store info for OpenLedger integration.",
        site: SITE_BASE,
        endpoints: [
          "GET /collections",
          "GET /collections/:id",
          "GET /collections/:id/items",
          "GET /items",
          "GET /items/:id",
          "GET /stores/:handle",
          "GET /activity",
          "GET /activity/mints",
          "GET /activity/sales",
          "GET /activity/auctions",
          "GET /stats",
        ],
        docs: `${SITE_BASE}/web3/nft/api`,
      }, 200, 300);
    }

    // GET /stats — global marketplace stats
    if (parts[0] === "stats" && parts.length === 1) {
      const [{ count: collections }, { count: items }, { count: mints }, { count: sales }, { count: auctions }] = await Promise.all([
        supabase.from("nft_collections").select("id", { count: "exact", head: true }),
        supabase.from("nft_items").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("nft_transactions").select("id", { count: "exact", head: true }).eq("tx_kind", "mint"),
        supabase.from("nft_transactions").select("id", { count: "exact", head: true }).in("tx_kind", ["sale", "primary_sale", "resale", "auction_settle"]),
        supabase.from("nft_auctions").select("id", { count: "exact", head: true }),
      ]);
      const { data: volumeRows } = await supabase
        .from("nft_transactions")
        .select("total, currency")
        .in("status", ["completed"]);
      const volume: Record<string, number> = {};
      for (const r of volumeRows || []) {
        const c = (r as { currency: string }).currency || "OUSD";
        volume[c] = (volume[c] || 0) + Number((r as { total: number }).total || 0);
      }
      return json({
        collections: collections ?? 0,
        active_items: items ?? 0,
        mints: mints ?? 0,
        sales: sales ?? 0,
        auctions: auctions ?? 0,
        total_volume: volume,
        marketplace_url: marketplaceUrl(),
        generated_at: new Date().toISOString(),
      }, 200, 60);
    }

    // GET /collections
    if (parts[0] === "collections" && parts.length === 1) {
      const limit = parseLimit(url.searchParams.get("limit"));
      const offset = Number(url.searchParams.get("offset") || 0);
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

    // GET /collections/:id
    if (parts[0] === "collections" && parts.length === 2) {
      const { data, error } = await supabase
        .from("nft_collections")
        .select("id, name, code, description, cover_url, royalty_pct, creator_id, created_at")
        .or(`id.eq.${parts[1]},code.eq.${parts[1]}`)
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

    // GET /collections/:id/items
    if (parts[0] === "collections" && parts.length === 3 && parts[2] === "items") {
      const limit = parseLimit(url.searchParams.get("limit"));
      const offset = Number(url.searchParams.get("offset") || 0);
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
      const items = (data || []).map((i: Record<string, unknown>) => enrichItem(i, stores));
      return json({ items, pagination: { limit, offset } });
    }

    // GET /items
    if (parts[0] === "items" && parts.length === 1) {
      const limit = parseLimit(url.searchParams.get("limit"));
      const offset = Number(url.searchParams.get("offset") || 0);
      const creator = url.searchParams.get("creator_id");
      const category = url.searchParams.get("category");
      let q = supabase
        .from("nft_items")
        .select("id, collection_id, name, code, image_url, media_url, media_type, price, currency, quantity_total, quantity_minted, category, creator_id, created_at")
        .eq("is_active", true)
        .eq("hidden", false)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (creator) q = q.eq("creator_id", creator);
      if (category) q = q.eq("category", category);
      const { data, error } = await q;
      if (error) throw error;
      const stores = await fetchStores(supabase, (data || []).map((i: Record<string, unknown>) => i.creator_id as string));
      const items = (data || []).map((i: Record<string, unknown>) => enrichItem(i, stores));
      return json({ items, pagination: { limit, offset } });
    }

    // GET /items/:id
    if (parts[0] === "items" && parts.length === 2) {
      const { data, error } = await supabase
        .from("nft_items")
        .select("id, collection_id, creator_id, name, code, description, image_url, media_url, media_type, price, currency, quantity_total, quantity_minted, category, properties, created_at")
        .or(`id.eq.${parts[1]},code.eq.${parts[1]}`)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Item not found" }, 404);
      const stores = await fetchStores(supabase, [data.creator_id as string]);
      return json({ item: enrichItem(data as Record<string, unknown>, stores) });
    }

    // GET /stores/:handle — public creator store lookup
    if (parts[0] === "stores" && parts.length === 2) {
      const { data: store, error } = await supabase
        .from("nft_store_profiles")
        .select("user_id, handle, display_name, avatar_url, banner_url, bio, is_verified, created_at")
        .eq("handle", parts[1])
        .maybeSingle();
      if (error) throw error;
      if (!store) return json({ error: "Store not found" }, 404);
      const { data: items } = await supabase
        .from("nft_items")
        .select("id, collection_id, name, code, image_url, media_url, price, currency, quantity_total, quantity_minted, category, creator_id, created_at")
        .eq("creator_id", store.user_id)
        .eq("is_active", true)
        .eq("hidden", false)
        .order("created_at", { ascending: false })
        .limit(50);
      const storeMap: Record<string, StoreLite> = { [store.user_id]: store as StoreLite };
      return json({
        store: {
          ...store,
          url: storeUrl(store.handle),
        },
        items: (items || []).map((i: Record<string, unknown>) => enrichItem(i, storeMap)),
      });
    }

    // GET /activity, /activity/mints, /activity/sales, /activity/auctions
    if (parts[0] === "activity") {
      const limit = parseLimit(url.searchParams.get("limit"));
      const offset = Number(url.searchParams.get("offset") || 0);
      const itemId = url.searchParams.get("item_id");
      const collectionId = url.searchParams.get("collection_id");

      let kinds: string[] | null = null;
      if (parts[1] === "mints") kinds = ["mint"];
      else if (parts[1] === "sales") kinds = ["sale", "primary_sale", "resale"];
      else if (parts[1] === "auctions") kinds = ["auction_settle", "bid"];

      let q = supabase
        .from("nft_transactions")
        .select("id, item_id, listing_id, seller_id, buyer_id, quantity, price_each, total, royalty_amount, platform_fee, currency, payment_method, tx_kind, status, tx_ref, created_at, nft_items!inner(id, name, code, image_url, media_url, collection_id, creator_id)")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (kinds) q = q.in("tx_kind", kinds);
      if (itemId) q = q.eq("item_id", itemId);
      if (collectionId) q = q.eq("nft_items.collection_id", collectionId);

      const { data, error } = await q;
      if (error) throw error;

      const creatorIds = (data || [])
        .map((r: Record<string, unknown>) => (r.nft_items as Record<string, unknown> | null)?.creator_id as string | undefined)
        .filter((x): x is string => !!x);
      const stores = await fetchStores(supabase, creatorIds);

      const activity = (data || []).map((r: Record<string, unknown>) => {
        const item = r.nft_items as Record<string, unknown> | null;
        const itemId = item ? String(item.id) : null;
        const creatorId = (item?.creator_id as string) || null;
        const image = (item?.media_url as string) || (item?.image_url as string) || null;
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
          created_at: r.created_at,
          item: item ? {
            id: item.id,
            name: item.name,
            code: item.code,
            image,
            image_url: item.image_url,
            media_url: item.media_url,
            collection_id: item.collection_id,
            creator_id: item.creator_id,
            permalink: itemId ? itemUrl(itemId) : null,
            collection_url: item.collection_id ? collectionUrl(String(item.collection_id)) : null,
            store: buildStore(creatorId ? stores[creatorId] : null, creatorId),
          } : null,
          marketplace_url: marketplaceUrl(),
        };
      });

      return json({ activity, pagination: { limit, offset } });
    }

    return json({ error: "Not found", path }, 404);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return json({ error: msg }, 500);
  }
});
