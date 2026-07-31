/**
 * Premium OpenPay AI voices powered by Lovable AI text-to-speech.
 * Selected voices are stored with a `lovable:` prefix so they can live
 * alongside browser SpeechSynthesis voices in the same picker.
 */
export const LOVABLE_VOICE_PREFIX = "lovable:";

export type LovableVoiceOption = {
  id: string;
  label: string;
  description: string;
};

export const LOVABLE_VOICES: LovableVoiceOption[] = [
  { id: "alloy", label: "Alloy", description: "Balanced & neutral" },
  { id: "verse", label: "Verse", description: "Warm & expressive" },
  { id: "nova", label: "Nova", description: "Bright & friendly" },
  { id: "shimmer", label: "Shimmer", description: "Soft & calm" },
  { id: "sage", label: "Sage", description: "Calm & professional" },
  { id: "ballad", label: "Ballad", description: "Smooth storyteller" },
  { id: "ash", label: "Ash", description: "Deep & steady" },
  { id: "coral", label: "Coral", description: "Upbeat & clear" },
];

export const DEFAULT_LOVABLE_VOICE = "alloy";

export const isLovableVoiceUri = (uri: string) => uri.startsWith(LOVABLE_VOICE_PREFIX);

export const toLovableVoiceUri = (id: string) => `${LOVABLE_VOICE_PREFIX}${id}`;

export const parseLovableVoiceId = (uri: string) =>
  isLovableVoiceUri(uri) ? uri.slice(LOVABLE_VOICE_PREFIX.length) || DEFAULT_LOVABLE_VOICE : DEFAULT_LOVABLE_VOICE;

/** Fetch spoken audio for `text` from the ai-speech edge function. */
export async function fetchLovableSpeech(text: string, voiceId: string): Promise<string> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY) as string;

  const res = await fetch(`${baseUrl}/functions/v1/ai-speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ text, voice: voiceId }),
  });

  if (!res.ok) {
    let message = "Could not generate audio";
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
