import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Copy, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

interface Item { name: string; description?: string; quantity: number; unit_price: number }

export default function QrPayCreatePage() {
  const navigate = useNavigate();
  const { currencies, currency } = useCurrency();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cur, setCur] = useState<string>(currency.code);
  const [items, setItems] = useState<Item[]>([{ name: "", quantity: 1, unit_price: 0 }]);
  const [allow, setAllow] = useState({ pi: true, wallet: true, card: true, guest: true });
  const [reusable, setReusable] = useState(false);
  const [expiresMin, setExpiresMin] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ token: string; total: number } | null>(null);

  const total = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0), 0);

  const update = (i: number, k: keyof Item, v: any) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

  const submit = async () => {
    const cleaned = items
      .filter(it => it.name.trim() && Number(it.unit_price) >= 0 && Number(it.quantity) > 0)
      .map(it => ({ name: it.name.trim(), description: it.description, quantity: Number(it.quantity), unit_price: Number(it.unit_price) }));
    if (cleaned.length === 0) { toast.error("Add at least one item"); return; }
    if (total <= 0) { toast.error("Total must be greater than 0"); return; }
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("qr_pay_create", {
      p_title: title || "QR Payment",
      p_description: description || null,
      p_currency: cur,
      p_items: cleaned,
      p_allow_pi: allow.pi,
      p_allow_wallet: allow.wallet,
      p_allow_virtual_card: allow.card,
      p_allow_guest: allow.guest,
      p_reusable: reusable,
      p_expires_minutes: expiresMin ? Number(expiresMin) : null,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setCreated({ token: data.token, total: Number(data.total) });
    toast.success("QR payment created");
  };

  if (created) {
    const url = `${window.location.origin}/qr-pay/${created.token}`;
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-gradient-to-r from-paypal-blue to-[#0073e6] text-primary-foreground p-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/20" onClick={() => navigate("/qr-pay")}><ArrowLeft className="h-5 w-5"/></Button>
          <h1 className="text-xl font-bold">Share QR Payment</h1>
        </div>
        <div className="p-4 max-w-md mx-auto space-y-4">
          <Card><CardContent className="p-6 flex flex-col items-center">
            <div className="bg-white p-4 rounded-xl"><QRCodeSVG value={url} size={220}/></div>
            <div className="mt-4 text-center">
              <div className="text-3xl font-bold">{cur} {created.total.toFixed(2)}</div>
              <p className="text-sm text-muted-foreground mt-1">Customers can scan this QR or open the link</p>
            </div>
            <div className="w-full mt-4 bg-muted rounded-lg p-2 text-xs break-all text-center">{url}</div>
            <div className="flex gap-2 w-full mt-3">
              <Button variant="outline" className="flex-1" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}><Copy className="h-4 w-4 mr-1"/>Copy</Button>
              <Button className="flex-1" onClick={async () => {
                try { if ((navigator as any).share) await (navigator as any).share({ title: "Pay with OpenPay", url }); else { navigator.clipboard.writeText(url); toast.success("Link copied"); } } catch {}
              }}><Share2 className="h-4 w-4 mr-1"/>Share</Button>
            </div>
            <Button variant="ghost" className="mt-2 w-full" onClick={() => window.open(url, "_blank")}>Open checkout preview</Button>
          </CardContent></Card>
          <Button variant="outline" className="w-full" onClick={() => navigate("/qr-pay")}>Back to dashboard</Button>
          <Button variant="ghost" className="w-full" onClick={() => { setCreated(null); setItems([{ name: "", quantity: 1, unit_price: 0 }]); setTitle(""); setDescription(""); }}>Create another</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="bg-gradient-to-r from-paypal-blue to-[#0073e6] text-primary-foreground p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/20" onClick={() => navigate("/qr-pay")}><ArrowLeft className="h-5 w-5"/></Button>
        <h1 className="text-xl font-bold">New QR Payment</h1>
      </div>
      <div className="p-4 max-w-xl mx-auto space-y-4">
        <Card><CardContent className="p-4 space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Coffee shop order" />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}/>
          </div>
          <div>
            <Label>Currency</Label>
            <Select value={cur} onValueChange={setCur}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                {currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label>Items</Label>
            <Button size="sm" variant="outline" onClick={() => setItems([...items, { name: "", quantity: 1, unit_price: 0 }])}><Plus className="h-4 w-4 mr-1"/>Add item</Button>
          </div>
          {items.map((it, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <Input placeholder="Product name" value={it.name} onChange={e => update(i, "name", e.target.value)} />
                {items.length > 1 && (
                  <Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4"/></Button>
                )}
              </div>
              <Input placeholder="Description (optional)" value={it.description || ""} onChange={e => update(i, "description", e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Quantity</Label><Input type="number" min={1} value={it.quantity} onChange={e => update(i, "quantity", Number(e.target.value))}/></div>
                <div><Label className="text-xs">Unit price ({cur})</Label><Input type="number" step="0.01" min={0} value={it.unit_price} onChange={e => update(i, "unit_price", Number(e.target.value))}/></div>
              </div>
              <div className="text-right text-sm text-muted-foreground">Line: {cur} {(it.quantity * it.unit_price).toFixed(2)}</div>
            </div>
          ))}
          <div className="text-right text-lg font-bold">Total: {cur} {total.toFixed(2)}</div>
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-3">
          <Label>Payment methods</Label>
          <div className="flex items-center justify-between"><span>Pi Network</span><Switch checked={allow.pi} onCheckedChange={v => setAllow({ ...allow, pi: v })}/></div>
          <div className="flex items-center justify-between"><span>OpenPay Wallet</span><Switch checked={allow.wallet} onCheckedChange={v => setAllow({ ...allow, wallet: v })}/></div>
          <div className="flex items-center justify-between"><span>Virtual Card</span><Switch checked={allow.card} onCheckedChange={v => setAllow({ ...allow, card: v })}/></div>
          <div className="flex items-center justify-between"><span>Allow guest (no sign-in for Pi)</span><Switch checked={allow.guest} onCheckedChange={v => setAllow({ ...allow, guest: v })}/></div>
          <div className="flex items-center justify-between"><span>Reusable (accept multiple payments)</span><Switch checked={reusable} onCheckedChange={setReusable}/></div>
          <div>
            <Label>Expires in (minutes, optional)</Label>
            <Input type="number" min={1} value={expiresMin} onChange={e => setExpiresMin(e.target.value)} placeholder="Never"/>
          </div>
        </CardContent></Card>

        <Button className="w-full bg-paypal-blue hover:bg-paypal-blue/90 text-primary-foreground" disabled={loading || total <= 0} onClick={submit}>
          {loading ? "Creating…" : `Create QR Payment · ${cur} ${total.toFixed(2)}`}
        </Button>
      </div>
    </div>
  );
}
