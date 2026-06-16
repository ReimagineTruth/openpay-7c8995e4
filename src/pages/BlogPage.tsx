import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Search, Calendar, Tag } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import BlogEditorModal, { type BlogDraft } from "@/components/blog/BlogEditorModal";

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  category: string;
  tags: string[];
  author_name: string;
  youtube_id: string | null;
  video_url: string | null;
  published: boolean;
  published_at: string;
  views: number;
  likes: number;
}

const PLACEHOLDER_GRADIENTS = [
  "from-paypal-blue to-paypal-dark",
  "from-indigo-500 to-purple-700",
  "from-blue-600 to-cyan-500",
  "from-emerald-500 to-teal-700",
  "from-amber-500 to-rose-600",
];

export default function BlogPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<BlogDraft | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: admin } = await (supabase as any).rpc("is_openpay_core_admin");
      setIsAdmin(!!admin);
    }
    const { data, error } = await (supabase as any)
      .from("blog_posts")
      .select("*")
      .order("published_at", { ascending: false });
    if (error) toast.error(error.message);
    setPosts((data || []) as BlogPost[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      p.excerpt.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }, [posts, query]);

  const handleDelete = async (post: BlogPost) => {
    if (!confirm(`Delete "${post.title}"?`)) return;
    const { error } = await (supabase as any).from("blog_posts").delete().eq("id", post.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    void load();
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <button onClick={() => navigate(-1)} className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full" aria-label="Back">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground">OpenPay Blog</h1>
            <p className="text-xs text-muted-foreground">News, updates and tutorials from the OpenPay team</p>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setEditor({ open: true } as BlogDraft)}>
              <Plus className="h-4 w-4 mr-1" /> New post
            </Button>
          )}
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search posts, tags, categories" className="pl-9" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {loading && <p className="text-sm text-muted-foreground">Loading posts...</p>}
        {!loading && filtered.length === 0 && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No posts yet.</CardContent></Card>
        )}

        <div className="grid gap-6">
          {filtered.map((post, idx) => {
            const grad = PLACEHOLDER_GRADIENTS[idx % PLACEHOLDER_GRADIENTS.length];
            return (
              <Card key={post.id} className="overflow-hidden">
                <div className="grid md:grid-cols-[320px_1fr] gap-0">
                  <Link to={`/blog/${post.slug}`} className="block">
                    {post.cover_image_url ? (
                      <img src={post.cover_image_url} alt={post.title} className="h-full w-full object-cover aspect-[4/3] md:aspect-auto" />
                    ) : (
                      <div className={`h-full min-h-[200px] bg-gradient-to-br ${grad} flex items-center justify-center p-6 text-center text-white`}>
                        <div>
                          <div className="text-xs uppercase tracking-wide opacity-80">{post.category}</div>
                          <div className="mt-2 font-bold text-lg line-clamp-3">{post.title}</div>
                        </div>
                      </div>
                    )}
                  </Link>
                  <CardContent className="p-6 space-y-3">
                    <div className="flex flex-wrap gap-2 items-center">
                      <Badge variant="secondary" className="text-paypal-blue bg-paypal-blue/10 border-0">{post.category}</Badge>
                      {!post.published && <Badge variant="outline">Draft</Badge>}
                      {(post.tags || []).slice(0, 3).map((t) => (
                        <span key={t} className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                          <Tag className="h-3 w-3" />{t}
                        </span>
                      ))}
                    </div>
                    <Link to={`/blog/${post.slug}`}>
                      <h2 className="text-xl md:text-2xl font-extrabold text-foreground hover:text-paypal-blue transition-colors line-clamp-2">{post.title}</h2>
                    </Link>
                    <p className="text-sm text-muted-foreground line-clamp-3">{post.excerpt}</p>
                    <div className="flex items-center justify-between pt-2">
                      <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(post.published_at), "MMMM d, yyyy")}
                        <span>• By {post.author_name}</span>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditor({
                            open: true, id: post.id, slug: post.slug, title: post.title, excerpt: post.excerpt,
                            content: post.content, category: post.category, tags: (post.tags || []).join(", "),
                            coverImageUrl: post.cover_image_url || "", authorName: post.author_name,
                            youtubeId: post.youtube_id || "", videoUrl: post.video_url || "", published: post.published,
                          })}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(post)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </div>
              </Card>
            );
          })}
        </div>
      </main>

      {editor && (
        <BlogEditorModal
          draft={editor}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); void load(); }}
        />
      )}
    </div>
  );
}
