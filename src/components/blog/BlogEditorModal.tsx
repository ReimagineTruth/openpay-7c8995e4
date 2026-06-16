import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export interface BlogDraft {
  open: boolean;
  id?: string;
  slug?: string;
  title?: string;
  excerpt?: string;
  content?: string;
  category?: string;
  tags?: string;
  coverImageUrl?: string;
  authorName?: string;
  youtubeId?: string;
  videoUrl?: string;
  published?: boolean;
}

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

interface Props { draft: BlogDraft; onClose: () => void; onSaved: () => void; }

export default function BlogEditorModal({ draft, onClose, onSaved }: Props) {
  const [d, setD] = useState<BlogDraft>({
    open: true, category: "General", authorName: "OpenPay", published: true, ...draft,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const title = (d.title || "").trim();
    if (!title) return toast.error("Title is required");
    const slug = (d.slug || slugify(title)).trim();
    if (!slug) return toast.error("Slug is required");

    setSaving(true);
    const payload: any = {
      slug, title,
      excerpt: d.excerpt || "",
      content: d.content || "",
      category: d.category || "General",
      tags: (d.tags || "").split(",").map((t) => t.trim()).filter(Boolean),
      cover_image_url: d.coverImageUrl || null,
      author_name: d.authorName || "OpenPay",
      youtube_id: d.youtubeId || null,
      video_url: d.videoUrl || null,
      published: d.published !== false,
    };
    const q = d.id
      ? (supabase as any).from("blog_posts").update(payload).eq("id", d.id)
      : (supabase as any).from("blog_posts").upsert(payload, { onConflict: "slug" });
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{d.id ? "Edit blog post" : "New blog post"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={d.title || ""} onChange={(e) => setD({ ...d, title: e.target.value, slug: d.slug || slugify(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Slug</Label>
              <Input value={d.slug || ""} onChange={(e) => setD({ ...d, slug: e.target.value })} placeholder="auto-from-title" />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={d.category || ""} onChange={(e) => setD({ ...d, category: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Cover image URL</Label>
            <Input value={d.coverImageUrl || ""} onChange={(e) => setD({ ...d, coverImageUrl: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <Label>Excerpt</Label>
            <Textarea rows={2} value={d.excerpt || ""} onChange={(e) => setD({ ...d, excerpt: e.target.value })} />
          </div>
          <div>
            <Label>Content (Markdown supported)</Label>
            <Textarea rows={10} value={d.content || ""} onChange={(e) => setD({ ...d, content: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Author</Label>
              <Input value={d.authorName || ""} onChange={(e) => setD({ ...d, authorName: e.target.value })} />
            </div>
            <div>
              <Label>Tags (comma-separated)</Label>
              <Input value={d.tags || ""} onChange={(e) => setD({ ...d, tags: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>YouTube ID</Label>
              <Input value={d.youtubeId || ""} onChange={(e) => setD({ ...d, youtubeId: e.target.value })} placeholder="e.g. dQw4w9WgXcQ" />
            </div>
            <div>
              <Label>Video URL</Label>
              <Input value={d.videoUrl || ""} onChange={(e) => setD({ ...d, videoUrl: e.target.value })} placeholder="https://..." />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={d.published !== false} onCheckedChange={(v) => setD({ ...d, published: v })} />
            <Label>Published</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save post"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
