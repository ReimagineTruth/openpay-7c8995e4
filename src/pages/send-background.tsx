import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";
import BrandLogo from "@/components/BrandLogo";

interface Profile {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url?: string | null;
}

const SendBackground = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [backgroundText, setBackgroundText] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/signin");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .eq("id", user.id)
        .single();

      setProfile(data || null);
    };

    loadProfile();
  }, [navigate]);

  const handleCopy = async () => {
    if (!backgroundText.trim()) {
      toast.error("Please enter some background text to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(backgroundText);
      setCopied(true);
      toast.success("Background text copied to clipboard!");
      
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy to clipboard");
      console.error("Copy failed:", error);
    }
  };

  const handleShare = async () => {
    if (!backgroundText.trim()) {
      toast.error("Please enter some background text to share");
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: "OpenPay Background Text",
          text: backgroundText,
        });
      } else {
        // Fallback to copying
        await handleCopy();
      }
    } catch (error) {
      toast.error("Failed to share");
      console.error("Share failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-paypal-blue px-4 pt-4 pb-10 text-white">
      <div className="mb-6 flex items-center gap-4 animate-in-up">
        <button onClick={() => navigate("/menu")} className="ios-active rounded-full p-2 hover:bg-secondary/50 transition-colors">
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="text-2xl font-black tracking-tight text-white">Copy Background</h1>
      </div>

      <div className="mx-auto max-w-md space-y-6">
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <div className="text-center mb-6">
            {profile?.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt={profile.full_name} 
                className="w-20 h-20 rounded-full border-4 border-white/20 mx-auto mb-4 object-cover" 
              />
            ) : (
              <div className="w-20 h-20 rounded-full border-4 border-white/20 mx-auto mb-4 bg-white/10 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </span>
              </div>
            )}
            <h2 className="text-xl font-semibold text-white mb-2">
              {profile?.full_name || "User"}
            </h2>
            {profile?.username && (
              <p className="text-sm text-white/80 mb-4">@{profile.username}</p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Background Text
              </label>
              <textarea
                value={backgroundText}
                onChange={(e) => setBackgroundText(e.target.value)}
                placeholder="Enter your background text here..."
                className="w-full h-32 rounded-xl border border-border bg-white/10 text-white placeholder-white/50 px-4 py-3 text-sm resize-none focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
                rows={4}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCopy}
                disabled={!backgroundText.trim()}
                className="flex-1 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                {copied ? "Copied!" : "Copy Text"}
              </button>

              <button
                onClick={handleShare}
                disabled={!backgroundText.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Share Text
              </button>
            </div>
          </div>

          <div className="mt-6 p-4 bg-white/5 rounded-xl">
            <h3 className="text-sm font-semibold text-white mb-2">How to use:</h3>
            <ol className="text-sm text-white/80 space-y-2 list-decimal list-inside">
              <li>Enter your custom background text in the field above</li>
              <li>Click "Copy Text" to copy it to clipboard</li>
              <li>Click "Share Text" to share it with others</li>
              <li>Use this text for your OpenPay profile background</li>
            </ol>
          </div>
        </div>
      </div>

      <BottomNav active="menu" />
    </div>
  );
};

export default SendBackground;
