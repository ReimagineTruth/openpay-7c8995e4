import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Heart, Share2, Tag, User } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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
  published_at: string;
  views: number;
  likes: number;
}

// Tiny markdown renderer — headings, bold, lists, line breaks
function renderMarkdown(md: string) {
  const lines = md.split("\n");
  const out: JSX.Element[] = [];
  let listBuffer: string[] = [];
  const flushList = () => {
    if (!listBuffer.length) return;
    out.push(
      <ul key={`ul-${out.length}`} className="list-disc pl-6 space-y-1 text-foreground/90">
        {listBuffer.map((li, i) => <li key={i} dangerouslySetInnerHTML={{ __html: inline(li) }} />)}
      </ul>
    );
    listBuffer = [];
  };
  const inline = (s: string) => s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-foreground">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a class="text-paypal-blue underline" href="$2" target="_blank" rel="noreferrer">$1</a>');

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (/^#{3}\s+/.test(line)) { flushList(); out.push(<h3 key={i} className="text-lg font-bold mt-6 mb-2 text-foreground" dangerouslySetInnerHTML={{ __html: inline(line.replace(/^#{3}\s+/, "")) }} />); return; }
    if (/^#{2}\s+/.test(line)) { flushList(); out.push(<h2 key={i} className="text-2xl font-bold mt-8 mb-3 text-foreground" dangerouslySetInnerHTML={{ __html: inline(line.replace(/^#{2}\s+/, "")) }} />); return; }
    if (/^#\s+/.test(line)) { flushList(); out.push(<h1 key={i} className="text-3xl font-extrabold mt-8 mb-4 text-foreground" dangerouslySetInnerHTML={{ __html: inline(line.replace(/^#\s+/, "")) }} />); return; }
    if (/^[-*]\s+/.test(line)) { listBuffer.push(line.replace(/^[-*]\s+/, "")); return; }
    if (!line.trim()) { flushList(); return; }
    flushList();
    out.push(<p key={i} className="text-foreground/90 leading-relaxed my-3" dangerouslySetInnerHTML={{ __html: inline(line) }} />);
  });
  flushList();
  return out;
}

export default function BlogPostPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) toast.error(error.message);
    setPost((data || null) as BlogPost | null);
    setLoading(false);
    if (data) {
      await (supabase as any).from("blog_posts").update({ views: (data.views || 0) + 1 }).eq("id", data.id);
    }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  const like = async () => {
    if (!post) return;
    const next = (post.likes || 0) + 1;
    setPost({ ...post, likes: next });
    const { error } = await (supabase as any).from("blog_posts").update({ likes: next }).eq("id", post.id);
    if (error) toast.error(error.message);
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: post?.title, url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch { /* user cancelled */ }
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  if (!post) return (
    <div className="p-6 text-center space-y-3">
      <p className="text-muted-foreground">Post not found.</p>
      <Link to="/blog" className="text-paypal-blue underline">Back to blog</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="bg-gradient-to-br from-paypal-blue to-paypal-dark text-white">
        <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Link to="/blog" className="text-sm opacity-80 hover:opacity-100">OpenPay Blog</Link>
          </div>
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge className="bg-white/15 hover:bg-white/15 text-white border-0">{post.category}</Badge>
              {(post.tags || []).map((t) => (
                <span key={t} className="text-xs inline-flex items-center gap-1 opacity-90"><Tag className="h-3 w-3" />{t}</span>
              ))}
            </div>
            <h1 className="text-2xl md:text-4xl font-extrabold leading-tight">{post.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm opacity-90">
              <span className="inline-flex items-center gap-1"><User className="h-4 w-4" /> {post.author_name}</span>
              <span className="inline-flex items-center gap-1"><Calendar className="h-4 w-4" /> {format(new Date(post.published_at), "MMMM d, yyyy")}</span>
              <span>{post.views || 0} views</span>
            </div>
          </div>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-8">
        {post.cover_image_url && (
          <img src={post.cover_image_url} alt={post.title} className="w-full rounded-2xl mb-6" />
        )}
        {post.excerpt && <p className="text-lg text-muted-foreground mb-6">{post.excerpt}</p>}

        {post.youtube_id && (
          <div className="aspect-video w-full rounded-2xl overflow-hidden mb-6">
            <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${post.youtube_id}`} title={post.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          </div>
        )}
        {!post.youtube_id && post.video_url && (
          <video src={post.video_url} controls className="w-full rounded-2xl mb-6" />
        )}

        <div className="prose-like">{renderMarkdown(post.content || "")}</div>

        <div className="flex items-center gap-2 mt-10 pt-6 border-t border-border">
          <Button variant="outline" onClick={like}><Heart className="h-4 w-4 mr-1 text-red-500" /> {post.likes || 0}</Button>
          <Button variant="outline" onClick={share}><Share2 className="h-4 w-4 mr-1" /> Share</Button>
          <Link to="/blog" className="ml-auto text-sm text-paypal-blue underline">← All posts</Link>
        </div>
      </article>
    </div>
  );
}
