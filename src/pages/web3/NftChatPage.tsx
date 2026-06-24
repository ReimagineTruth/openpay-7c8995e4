import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Send, Image as ImageIcon, X, Trash2, MessageCircle, BadgeCheck, Store as StoreIcon, ExternalLink } from "lucide-react";

const ACCENT = "hsl(217 91% 60%)";

type Msg = {
  id: string;
  user_id: string;
  message: string;
  item_id: string | null;
  created_at: string;
};

const NftChatPage = () => {
  const nav = useNavigate();
  const [me, setMe] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [storesByUser, setStoresByUser] = useState<Record<string, any>>({});
  const [items, setItems] = useState<Record<string, any>>({});
  const [text, setText] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [myNfts, setMyNfts] = useState<any[]>([]);
  const [attached, setAttached] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [profilePeek, setProfilePeek] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadProfilesAndItems = async (rows: Msg[]) => {
    const userIds = Array.from(new Set(rows.map((m) => m.user_id))).filter(
      (id) => !profiles[id],
    );
    const itemIds = Array.from(
      new Set(rows.map((m) => m.item_id).filter(Boolean) as string[]),
    ).filter((id) => !items[id]);
    if (userIds.length) {
      const [{ data: pData }, { data: sData }] = await Promise.all([
        (supabase as any).from("profiles").select("id, username, full_name, avatar_url").in("id", userIds),
        (supabase as any).from("nft_store_profiles").select("user_id, handle, display_name, avatar_url, banner_url, bio, is_verified, category").in("user_id", userIds),
      ]);
      const pMap: Record<string, any> = { ...profiles };
      (pData || []).forEach((p: any) => (pMap[p.id] = p));
      setProfiles(pMap);
      const sMap: Record<string, any> = { ...storesByUser };
      (sData || []).forEach((s: any) => (sMap[s.user_id] = s));
      setStoresByUser(sMap);
    }
    if (itemIds.length) {
      const { data } = await (supabase as any)
        .from("nft_items").select("id, name, image_url, media_url, price, currency, code").in("id", itemIds);
      const map: Record<string, any> = { ...items };
      (data || []).forEach((it: any) => (map[it.id] = it));
      setItems(map);
    }
  };

  const openProfile = (userId: string) => {
    if (userId === me) { nav("/web3/nft/store"); return; }
    setProfilePeek(userId);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setMe(user?.id || null);
      const { data } = await (supabase as any)
        .from("nft_chat_messages")
        .select("*").order("created_at", { ascending: false }).limit(100);
      const rows = ((data || []) as Msg[]).slice().reverse();
      setMsgs(rows);
      await loadProfilesAndItems(rows);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 100);
    })();

    const ch = supabase
      .channel("nft-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "nft_chat_messages" },
        async (payload) => {
          const m = payload.new as Msg;
          setMsgs((prev) => [...prev, m]);
          await loadProfilesAndItems([m]);
          setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "nft_chat_messages" },
        (payload) => {
          setMsgs((prev) => prev.filter((m) => m.id !== (payload.old as any).id));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAttach = async () => {
    setAttaching(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: owned } = await (supabase as any)
      .from("nft_ownership").select("item_id, quantity").eq("owner_id", user.id).gt("quantity", 0);
    const ids = (owned || []).map((o: any) => o.item_id);
    const { data: created } = await (supabase as any)
      .from("nft_items").select("id, name, image_url, media_url, price, currency, code").eq("creator_id", user.id);
    const { data: ownedItems } = ids.length
      ? await (supabase as any).from("nft_items").select("id, name, image_url, media_url, price, currency, code").in("id", ids)
      : { data: [] };
    const map = new Map<string, any>();
    [...(created || []), ...(ownedItems || [])].forEach((it: any) => map.set(it.id, it));
    setMyNfts(Array.from(map.values()));
  };

  const send = async () => {
    const msg = text.trim();
    if (!msg && !attached) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in required");
      const { error } = await (supabase as any).from("nft_chat_messages").insert({
        user_id: user.id,
        message: msg || (attached ? `Check out my NFT "${attached.name}"!` : ""),
        item_id: attached?.id || null,
      });
      if (error) throw error;
      setText("");
      setAttached(null);
    } catch (e: any) {
      toast({ title: "Failed to send", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const del = async (id: string) => {
    await (supabase as any).from("nft_chat_messages").delete().eq("id", id);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="sticky top-0 z-10 bg-black/85 backdrop-blur px-4 py-3 flex items-center gap-3 border-b border-white/5">
        <button onClick={() => nav(-1)} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-extrabold flex items-center gap-2">
            <MessageCircle className="h-5 w-5" style={{ color: ACCENT }} /> NFT Live Chat
          </h1>
          <p className="text-[11px] text-white/50">Global · share your NFTs · {msgs.length} messages</p>
        </div>
        <div className="relative">
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-400">LIVE</span>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 pb-4">
        {msgs.length === 0 && (
          <div className="text-center text-white/40 py-16">
            <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Be the first to say something!</p>
          </div>
        )}
        {msgs.map((m) => {
          const p = profiles[m.user_id];
          const s = storesByUser[m.user_id];
          const it = m.item_id ? items[m.item_id] : null;
          const mine = m.user_id === me;
          const displayName = s?.display_name || p?.full_name || p?.username || "User";
          const handle = s?.handle || p?.username || m.user_id.slice(0, 6);
          const avatar = s?.avatar_url || p?.avatar_url;
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <button
                onClick={() => openProfile(m.user_id)}
                className="flex-shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-white/30 transition active:scale-95"
                aria-label={`View @${handle}`}
              >
                {avatar
                  ? <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                  : <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-500 to-blue-500" />}
              </button>
              <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                <button
                  onClick={() => openProfile(m.user_id)}
                  className={`flex items-center gap-1.5 hover:opacity-80 transition ${mine ? "flex-row-reverse" : ""}`}
                >
                  <span className="text-[11px] text-white/70 font-bold">
                    {mine ? "You" : displayName}
                  </span>
                  {s?.is_verified && <BadgeCheck className="h-3 w-3" style={{ color: ACCENT }} />}
                  <span className="text-[10px] text-white/40">@{handle}</span>
                  <span className="text-[10px] text-white/30">· {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </button>
                <div className={`rounded-2xl px-3 py-2 ${mine ? "rounded-tr-sm" : "rounded-tl-sm bg-white/10"}`} style={mine ? { background: ACCENT } : {}}>
                  {m.message && <p className="text-sm break-words whitespace-pre-wrap">{m.message}</p>}
                  {it && (
                    <button
                      onClick={() => nav(`/web3/nft/${it.id}`)}
                      className="mt-2 flex items-center gap-2 p-2 rounded-xl bg-black/30 hover:bg-black/50 transition text-left w-full"
                    >
                      {(it.image_url || it.media_url) && (
                        <img src={it.image_url || it.media_url} alt="" className="h-14 w-14 rounded-lg object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{it.name}</p>
                        <p className="text-[10px] text-white/60 truncate">#{it.code}</p>
                        <p className="text-[11px] font-bold" style={{ color: mine ? "#fff" : ACCENT }}>{it.price} {it.currency}</p>
                      </div>
                    </button>
                  )}
                </div>
                {mine && (
                  <button onClick={() => del(m.id)} className="text-[10px] text-white/40 hover:text-red-400 flex items-center gap-1">
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {attached && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 rounded-xl bg-white/10 p-2 border border-white/10">
            <img src={attached.image_url || attached.media_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">Sharing: {attached.name}</p>
              <p className="text-[10px] text-white/50">#{attached.code}</p>
            </div>
            <button onClick={() => setAttached(null)} className="h-7 w-7 rounded-full bg-black/50 flex items-center justify-center">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="sticky bottom-0 bg-black/90 backdrop-blur border-t border-white/10 p-3 flex items-end gap-2">
        <button onClick={openAttach} className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0" aria-label="Share NFT">
          <ImageIcon className="h-5 w-5" />
        </button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Say something to the community…"
          rows={1}
          className="flex-1 max-h-24 resize-none rounded-2xl bg-white/10 border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-white/30"
        />
        <button onClick={send} disabled={busy || (!text.trim() && !attached)}
          className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40"
          style={{ backgroundColor: ACCENT }} aria-label="Send">
          <Send className="h-4 w-4" />
        </button>
      </div>

      {attaching && (
        <>
          <div className="fixed inset-0 bg-black/70 z-40" onClick={() => setAttaching(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-[#111] p-4 max-h-[75vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-extrabold">Share an NFT</h3>
              <button onClick={() => setAttaching(false)} className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            {myNfts.length === 0 ? (
              <p className="text-sm text-white/50 text-center py-8">No NFTs yet — mint or buy one first.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {myNfts.map((it) => (
                  <button key={it.id} onClick={() => { setAttached(it); setAttaching(false); }}
                    className="rounded-xl overflow-hidden border border-white/10 hover:border-white/40 transition text-left">
                    <div className="aspect-square bg-[#0f0f0f]">
                      {(it.image_url || it.media_url) && (
                        <img src={it.image_url || it.media_url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-[11px] font-bold truncate">{it.name}</p>
                      <p className="text-[10px] truncate" style={{ color: ACCENT }}>{it.price} {it.currency}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {profilePeek && (() => {
        const p = profiles[profilePeek];
        const s = storesByUser[profilePeek];
        const name = s?.display_name || p?.full_name || p?.username || "User";
        const handle = s?.handle || p?.username;
        const avatar = s?.avatar_url || p?.avatar_url;
        const msgCount = msgs.filter((m) => m.user_id === profilePeek).length;
        return (
          <>
            <div className="fixed inset-0 bg-black/70 z-40 animate-in fade-in" onClick={() => setProfilePeek(null)} />
            <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-[#0f0f0f] border-t border-white/10 overflow-hidden animate-in slide-in-from-bottom duration-200">
              {s?.banner_url ? (
                <div className="h-24 w-full" style={{ backgroundImage: `url(${s.banner_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
              ) : (
                <div className="h-24 w-full" style={{ background: `linear-gradient(135deg, hsl(280 80% 30%), ${ACCENT})` }} />
              )}
              <div className="p-4 -mt-10">
                <div className="flex items-end justify-between">
                  {avatar ? (
                    <img src={avatar} alt="" className="h-20 w-20 rounded-full object-cover border-4 border-[#0f0f0f]" />
                  ) : (
                    <div className="h-20 w-20 rounded-full border-4 border-[#0f0f0f] bg-gradient-to-br from-pink-500 to-blue-500" />
                  )}
                  <button onClick={() => setProfilePeek(null)} className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-extrabold">{name}</h3>
                    {s?.is_verified && <BadgeCheck className="h-5 w-5" style={{ color: ACCENT }} />}
                  </div>
                  {handle && <p className="text-sm text-white/60">@{handle}</p>}
                  {s?.bio && <p className="text-sm text-white/70 mt-2 leading-snug">{s.bio}</p>}
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-white/60">
                    {s?.category && <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">{s.category}</span>}
                    <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">{msgCount} msgs</span>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {handle ? (
                    <button
                      onClick={() => { setProfilePeek(null); nav(`/web3/nft/store/${handle}`); }}
                      className="rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2"
                      style={{ background: ACCENT }}
                    >
                      <StoreIcon className="h-4 w-4" /> View Store
                    </button>
                  ) : (
                    <button disabled className="rounded-xl py-3 font-bold text-sm bg-white/5 text-white/40 flex items-center justify-center gap-2">
                      <StoreIcon className="h-4 w-4" /> No store yet
                    </button>
                  )}
                  <button
                    onClick={() => { setProfilePeek(null); setText((t) => `@${handle || name} ${t}`); }}
                    className="rounded-xl py-3 font-bold text-sm bg-white/10 flex items-center justify-center gap-2 hover:bg-white/15"
                  >
                    <ExternalLink className="h-4 w-4" /> Mention
                  </button>
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
};

export default NftChatPage;
