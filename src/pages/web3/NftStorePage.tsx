import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { NftStatusBadge } from "@/lib/nftStatus";
import {
  ArrowLeft, Pencil, MoreHorizontal, Copy, Share2, Globe, Twitter, Instagram, Send, Facebook, Youtube,
  BadgeCheck, Users, Package, TrendingUp, Grid3x3, List, Eye, Heart, X, MessageCircle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";


const ACCENT = "hsl(217 91% 60%)";

type Tab = "collected" | "created" | "activity" | "offers";

const NftStorePage = () => {
  const nav = useNavigate();
  const { handle } = useParams();
  const [me, setMe] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [owner, setOwner] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("collected");
  const [collected, setCollected] = useState<any[]>([]);
  const [created, setCreated] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [followers, setFollowers] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [following, setFollowing] = useState(false);
  const [followModal, setFollowModal] = useState<null | "followers" | "following">(null);
  const [followList, setFollowList] = useState<any[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [sales, setSales] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const { format } = useCurrency();
  const [view, setView] = useState<"grid" | "list">("grid");


  const isOwner = me?.id && owner?.id && me.id === owner.id;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setMe(user);

      let targetUserId: string | null = null;
      let prof: any = null;

      if (handle) {
        const { data: p } = await (supabase as any)
          .from("nft_store_profiles").select("*").eq("handle", handle).maybeSingle();
        if (p) { prof = p; targetUserId = p.user_id; }
      } else if (user) {
        targetUserId = user.id;
        const { data: p } = await (supabase as any)
          .from("nft_store_profiles").select("*").eq("user_id", user.id).maybeSingle();
        prof = p;
      }

      if (!targetUserId) { setLoading(false); return; }

      // Get base profile for fallback name/avatar
      const { data: base } = await (supabase as any)
        .from("profiles").select("id,full_name,username,avatar_url")
        .eq("id", targetUserId).maybeSingle();
      setOwner({ ...(base || {}), id: targetUserId });
      setProfile(prof);

      // Increment view count (don't await failures)
      if (user && user.id !== targetUserId) {
        (supabase as any).rpc?.("increment", {}).catch?.(() => {});
        await (supabase as any).from("nft_store_profiles")
          .update({ view_count: (prof?.view_count || 0) + 1 })
          .eq("user_id", targetUserId);
      }

      // Items owned
      const { data: own } = await (supabase as any)
        .from("nft_ownership")
        .select("quantity, item:nft_items(*)")
        .eq("owner_id", targetUserId)
        .gt("quantity", 0);
      setCollected((own || []).map((o: any) => ({ ...o.item, qty: o.quantity })).filter((x: any) => x.id));

      // Items created
      const { data: cre } = await (supabase as any)
        .from("nft_items").select("*").eq("creator_id", targetUserId)
        .order("created_at", { ascending: false });
      setCreated(cre || []);
      const createdIds = (cre || []).map((i: any) => i.id);
      if (createdIds.length) {
        const { data: tx } = await (supabase as any)
          .from("nft_transactions")
          .select("item_id, quantity, tx_kind")
          .in("item_id", createdIds)
          .in("tx_kind", ["sale", "resale"]);
        const soldMap: Record<string, number> = {};
        (tx || []).forEach((t: any) => { soldMap[t.item_id] = (soldMap[t.item_id] || 0) + Number(t.quantity || 0); });
        setSales(soldMap);
      }

      // Activity
      const { data: tx } = await (supabase as any)
        .from("nft_transactions")
        .select("id, tx_kind, quantity, amount, currency, created_at, item:nft_items(name,code,image_url)")
        .or(`from_user_id.eq.${targetUserId},to_user_id.eq.${targetUserId}`)
        .order("created_at", { ascending: false }).limit(50);
      setActivity(tx || []);

      // Followers
      const { count } = await (supabase as any)
        .from("nft_store_follows").select("*", { count: "exact", head: true })
        .eq("followed_id", targetUserId);
      setFollowers(count || 0);

      const { count: followingC } = await (supabase as any)
        .from("nft_store_follows").select("*", { count: "exact", head: true })
        .eq("follower_id", targetUserId);
      setFollowingCount(followingC || 0);

      if (user && user.id !== targetUserId) {
        const { data: f } = await (supabase as any)
          .from("nft_store_follows").select("id")
          .eq("follower_id", user.id).eq("followed_id", targetUserId).maybeSingle();
        setFollowing(!!f);
      }

      setLoading(false);
    })();
  }, [handle]);

  const totalValue = collected.reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 1), 0);

  const onFollow = async () => {
    if (!me) return nav("/auth");
    if (!owner) return;
    if (following) {
      await (supabase as any).from("nft_store_follows").delete()
        .eq("follower_id", me.id).eq("followed_id", owner.id);
      setFollowing(false); setFollowers((n) => Math.max(0, n - 1));
    } else {
      await (supabase as any).from("nft_store_follows")
        .insert({ follower_id: me.id, followed_id: owner.id });
      setFollowing(true); setFollowers((n) => n + 1);
    }
  };

  const onShare = async () => {
    const url = window.location.href;
    try { await navigator.share?.({ title: "NFT Store", url }); }
    catch { await navigator.clipboard.writeText(url); toast({ title: "Link copied" }); }
  };

  const onCopyAddr = async () => {
    await navigator.clipboard.writeText(owner?.id || "");
    toast({ title: "ID copied" });
  };

  const openFollowList = async (kind: "followers" | "following") => {
    if (!owner) return;
    setFollowModal(kind);
    setFollowListLoading(true);
    setFollowList([]);
    const col = kind === "followers" ? "followed_id" : "follower_id";
    const otherCol = kind === "followers" ? "follower_id" : "followed_id";
    const { data: rels } = await (supabase as any)
      .from("nft_store_follows").select(`${otherCol}, created_at`).eq(col, owner.id)
      .order("created_at", { ascending: false }).limit(200);
    const ids = (rels || []).map((r: any) => r[otherCol]);
    if (!ids.length) { setFollowListLoading(false); return; }
    const [{ data: profs }, { data: stores }] = await Promise.all([
      (supabase as any).from("profiles").select("id, username, full_name, avatar_url").in("id", ids),
      (supabase as any).from("nft_store_profiles").select("user_id, handle, display_name, avatar_url, is_verified, bio").in("user_id", ids),
    ]);
    const profMap: Record<string, any> = {};
    (profs || []).forEach((p: any) => (profMap[p.id] = p));
    const storeMap: Record<string, any> = {};
    (stores || []).forEach((s: any) => (storeMap[s.user_id] = s));
    setFollowList(ids.map((id: string) => ({
      id,
      profile: profMap[id],
      store: storeMap[id],
    })));
    setFollowListLoading(false);
  };


  if (loading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading store…</div>;
  }

  if (!owner) {
    return (
      <div className="min-h-screen bg-black text-white p-6 text-center">
        <p>Store not found.</p>
        <button onClick={() => nav("/web3/nft")} className="mt-4 underline">Back to marketplace</button>
      </div>
    );
  }

  const displayName = profile?.display_name || owner.full_name || owner.username || "Unnamed";
  const handleStr = profile?.handle || owner.username || owner.id?.slice(0, 8);
  const avatar = profile?.avatar_url || owner.avatar_url;
  const banner = profile?.banner_url;

  const items = tab === "collected" ? collected : tab === "created" ? created : [];

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Banner */}
      <div className="relative">
        <div className="h-44 sm:h-60 w-full overflow-hidden"
          style={banner ? { backgroundImage: `url(${banner})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: `linear-gradient(135deg, hsl(280 80% 30%), hsl(217 91% 40%))` }} />
        <button onClick={() => nav(-1)}
          className="absolute top-3 left-3 h-9 w-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="absolute top-3 right-3 flex gap-2">
          <button onClick={onShare} className="h-9 w-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center">
            <Share2 className="h-4 w-4" />
          </button>
          <button className="h-9 w-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Avatar */}
      <div className="px-4 -mt-12 relative">
        <div className="h-24 w-24 rounded-full ring-4 ring-black overflow-hidden bg-gradient-to-br from-pink-500 to-blue-500">
          {avatar ? <img src={avatar} className="h-full w-full object-cover" alt={displayName} /> : null}
        </div>
      </div>

      {/* Header info */}
      <div className="px-4 mt-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-extrabold truncate">{displayName}</h1>
              {profile?.is_verified && <BadgeCheck className="h-5 w-5" style={{ color: ACCENT }} />}
              {isOwner && (
                <button onClick={() => nav("/web3/nft/store/settings")}
                  className="ml-1 h-7 w-7 rounded-full bg-white/10 flex items-center justify-center">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button onClick={onCopyAddr} className="text-xs text-white/55 flex items-center gap-1 mt-0.5">
              @{handleStr} <Copy className="h-3 w-3" />
            </button>
          </div>
          {!isOwner && (
            <button onClick={onFollow}
              className="h-9 px-4 rounded-full font-bold text-sm"
              style={following ? { backgroundColor: "rgba(255,255,255,0.1)" } : { backgroundColor: ACCENT }}>
              {following ? "Following" : "Follow"}
            </button>
          )}
        </div>

        {profile?.bio && <p className="text-sm text-white/75 leading-relaxed">{profile.bio}</p>}

        {/* Socials */}
        {(profile?.website_url || profile?.twitter_url || profile?.instagram_url || profile?.telegram_url || profile?.discord_url || profile?.facebook_url || profile?.youtube_url) && (
          <div className="flex gap-2 pt-1 flex-wrap">
            {profile?.website_url && <a href={profile.website_url} target="_blank" rel="noreferrer"
              className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center" title="Website"><Globe className="h-4 w-4" /></a>}
            {profile?.twitter_url && <a href={profile.twitter_url} target="_blank" rel="noreferrer"
              className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center" title="Twitter / X"><Twitter className="h-4 w-4" /></a>}
            {profile?.instagram_url && <a href={profile.instagram_url} target="_blank" rel="noreferrer"
              className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center" title="Instagram"><Instagram className="h-4 w-4" /></a>}
            {profile?.facebook_url && <a href={profile.facebook_url} target="_blank" rel="noreferrer"
              className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center" title="Facebook"><Facebook className="h-4 w-4" /></a>}
            {profile?.youtube_url && <a href={profile.youtube_url} target="_blank" rel="noreferrer"
              className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center" title="YouTube"><Youtube className="h-4 w-4" /></a>}
            {profile?.telegram_url && <a href={profile.telegram_url} target="_blank" rel="noreferrer"
              className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center" title="Telegram"><Send className="h-4 w-4" /></a>}
            {profile?.discord_url && <a href={profile.discord_url} target="_blank" rel="noreferrer"
              className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center" title="Discord"><MessageCircle className="h-4 w-4" /></a>}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-5 gap-2 pt-3">
          <Stat label="Value" value={format(totalValue)} icon={<TrendingUp className="h-3 w-3" />} />
          <Stat label="NFTs" value={String(collected.length)} icon={<Package className="h-3 w-3" />} />
          <Stat label="Created" value={String(created.length)} icon={<Grid3x3 className="h-3 w-3" />} />
          <button onClick={() => openFollowList("followers")} className="text-left">
            <Stat label="Followers" value={String(followers)} icon={<Users className="h-3 w-3" />} />
          </button>
          <button onClick={() => openFollowList("following")} className="text-left">
            <Stat label="Following" value={String(followingCount)} icon={<Heart className="h-3 w-3" />} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-5 border-b border-white/10 px-4 flex gap-5 overflow-x-auto">
        {(["collected", "created", "activity", "offers"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`pb-3 text-sm font-bold capitalize whitespace-nowrap border-b-2 ${tab === t ? "text-white" : "text-white/50 border-transparent"}`}
            style={tab === t ? { borderColor: ACCENT } : {}}>
            {t} {t === "collected" && `(${collected.length})`}{t === "created" && `(${created.length})`}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      {(tab === "collected" || tab === "created") && (
        <div className="px-4 py-3 flex items-center justify-between">
          <p className="text-xs text-white/60">{items.length} items</p>
          <div className="flex bg-white/10 rounded-full p-0.5">
            <button onClick={() => setView("grid")}
              className={`h-7 w-7 rounded-full flex items-center justify-center ${view === "grid" ? "bg-white/20" : ""}`}>
              <Grid3x3 className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setView("list")}
              className={`h-7 w-7 rounded-full flex items-center justify-center ${view === "list" ? "bg-white/20" : ""}`}>
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-4">
        {tab === "activity" ? (
          activity.length === 0 ? (
            <p className="text-center text-white/50 mt-12">No activity yet.</p>
          ) : (
            <div className="space-y-2">
              {activity.map((a) => (
                <div key={a.id} className="flex items-center gap-3 bg-[#0f0f0f] border border-white/5 rounded-xl p-3">
                  <div className="h-10 w-10 rounded-lg overflow-hidden bg-white/5 shrink-0">
                    {a.item?.image_url && <img src={a.item.image_url} className="h-full w-full object-cover" alt="" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate capitalize">{a.tx_kind} · {a.item?.name || "NFT"}</p>
                    <p className="text-[11px] text-white/50">{new Date(a.created_at).toLocaleString()}</p>
                  </div>
                  <p className="text-sm font-bold" style={{ color: ACCENT }}>{format(Number(a.amount || 0))}</p>
                </div>
              ))}
            </div>
          )
        ) : tab === "offers" ? (
          <p className="text-center text-white/50 mt-12">No offers.</p>
        ) : items.length === 0 ? (
          <div className="text-center mt-12">
            <p className="text-white/60 mb-3">No items yet.</p>
            {isOwner && (
              <button onClick={() => nav("/web3/nft/create")} className="rounded-full px-5 py-2 font-bold" style={{ backgroundColor: ACCENT }}>
                {tab === "created" ? "Mint your first NFT" : "Explore marketplace"}
              </button>
            )}
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {items.map((it) => (
              <button key={it.id} onClick={() => nav(`/web3/nft/${it.id}`)}
                className="text-left rounded-2xl overflow-hidden bg-[#0f0f0f] border border-white/5 hover:border-white/20 transition">
                <div className="aspect-square bg-[#161616] overflow-hidden">
                  {it.image_url && <img src={it.image_url} className="h-full w-full object-cover" alt={it.name} />}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-bold truncate">{it.name}</p>
                  <p className="text-[10px] text-white/40 truncate">#{it.code}</p>
                  <NftStatusBadge sold={sales[it.id] || 0} total={it.quantity_total} className="mt-1.5" />
                  <p className="text-sm font-extrabold mt-1" style={{ color: ACCENT }}>{format(Number(it.price || 0))}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <button key={it.id} onClick={() => nav(`/web3/nft/${it.id}`)}
                className="w-full text-left flex items-center gap-3 bg-[#0f0f0f] border border-white/5 rounded-xl p-3">
                <div className="h-12 w-12 rounded-lg overflow-hidden bg-white/5 shrink-0">
                  {it.image_url && <img src={it.image_url} className="h-full w-full object-cover" alt="" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold truncate">{it.name}</p>
                    <NftStatusBadge sold={sales[it.id] || 0} total={it.quantity_total} />
                  </div>
                  <p className="text-[11px] text-white/50">#{it.code}</p>
                </div>
                <p className="text-sm font-extrabold" style={{ color: ACCENT }}>{format(Number(it.price || 0))}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {followModal && (
        <>
          <div className="fixed inset-0 bg-black/70 z-40" onClick={() => setFollowModal(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-[#111] p-4 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-extrabold capitalize">{followModal} · {followModal === "followers" ? followers : followingCount}</h3>
              <button onClick={() => setFollowModal(null)} className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            {followListLoading ? (
              <p className="text-center text-sm text-white/50 py-10">Loading…</p>
            ) : followList.length === 0 ? (
              <p className="text-center text-sm text-white/50 py-10">
                {followModal === "followers" ? "No followers yet" : "Not following anyone yet"}
              </p>
            ) : (
              <div className="space-y-2">
                {followList.map((u) => {
                  const name = u.store?.display_name || u.profile?.full_name || u.profile?.username || u.id.slice(0,8);
                  const handle = u.store?.handle || u.profile?.username;
                  const avatar = u.store?.avatar_url || u.profile?.avatar_url;
                  return (
                    <button
                      key={u.id}
                      onClick={() => {
                        setFollowModal(null);
                        if (handle) nav(`/web3/nft/store/${handle}`);
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition text-left"
                    >
                      {avatar
                        ? <img src={avatar} alt="" className="h-11 w-11 rounded-full object-cover flex-shrink-0" />
                        : <div className="h-11 w-11 rounded-full bg-gradient-to-br from-pink-500 to-blue-500 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="font-bold truncate">{name}</p>
                          {u.store?.is_verified && <BadgeCheck className="h-3.5 w-3.5 flex-shrink-0" style={{ color: ACCENT }} />}
                        </div>
                        {handle && <p className="text-xs text-white/50 truncate">@{handle}</p>}
                        {u.store?.bio && <p className="text-[11px] text-white/40 truncate">{u.store.bio}</p>}
                      </div>
                      {u.store?.handle && (
                        <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-white/10">View store</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const Stat = ({ label, value, icon }: any) => (
  <div className="rounded-xl bg-white/5 border border-white/10 p-2">
    <div className="flex items-center gap-1 text-[10px] text-white/55 uppercase">{icon}{label}</div>
    <p className="text-sm font-extrabold mt-0.5 truncate">{value}</p>
  </div>
);

export default NftStorePage;
