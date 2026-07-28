export const AI_SPEECH_VOICE_STORAGE_KEY = "openpay_ai_speech_voice";

export type AiSpeechVoiceOption = {
  uri: string;
  name: string;
  lang: string;
  label: string;
};

export const getStoredAiSpeechVoiceUri = (): string => {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(AI_SPEECH_VOICE_STORAGE_KEY) || "";
  } catch {
    return "";
  }
};

export const setStoredAiSpeechVoiceUri = (voiceUri: string) => {
  if (typeof window === "undefined") return;
  try {
    if (!voiceUri) {
      localStorage.removeItem(AI_SPEECH_VOICE_STORAGE_KEY);
      return;
    }
    localStorage.setItem(AI_SPEECH_VOICE_STORAGE_KEY, voiceUri);
  } catch {
    // ignore quota / private mode
  }
};

export const loadSpeechVoices = (): SpeechSynthesisVoice[] => {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
};

export const toSpeechVoiceOptions = (voices: SpeechSynthesisVoice[]): AiSpeechVoiceOption[] =>
  voices
    .map((voice) => ({
      uri: voice.voiceURI,
      name: voice.name,
      lang: voice.lang,
      label: `${voice.name} (${voice.lang})${voice.default ? " · default" : ""}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

export const findSpeechVoiceByUri = (
  voices: SpeechSynthesisVoice[],
  voiceUri: string,
): SpeechSynthesisVoice | null => {
  if (!voiceUri) return null;
  return voices.find((voice) => voice.voiceURI === voiceUri) || null;
};

export const applyStoredSpeechVoice = (utterance: SpeechSynthesisUtterance) => {
  const voices = loadSpeechVoices();
  const preferred = findSpeechVoiceByUri(voices, getStoredAiSpeechVoiceUri());
  if (preferred) {
    utterance.voice = preferred;
    if (preferred.lang) utterance.lang = preferred.lang;
  }
};

export const previewSpeechVoice = (voiceUri: string, sampleText = "Hello from OpenPay AI. This is your listen voice.") => {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  const voices = loadSpeechVoices();
  const voice = findSpeechVoiceByUri(voices, voiceUri);
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(sampleText);
  utterance.rate = 1;
  utterance.pitch = 1;
  if (voice) {
    utterance.voice = voice;
    if (voice.lang) utterance.lang = voice.lang;
  }
  window.speechSynthesis.speak(utterance);
  return true;
};
