type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; abort(): void;
};
const speechWindow = window as unknown as {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
const Speech = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
export const browserVoiceAvailable = !!Speech;
export function startBrowserVoice(text: (value: string) => void, status: (value: string) => void): () => void {
  if (!Speech) throw Error("Browser voice input is unavailable. Use the keyboard.");
  const recognition = new Speech();
  let active = true;
  recognition.lang = navigator.language || "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;
  const cleanup = () => { active = false; clearTimeout(timer); recognition.abort(); };
  recognition.onresult = (event) => {
    if (active) {
      text(event.results[0][0].transcript.slice(0, 400));
      status("Review your words, then select Search.");
    }
  };
  recognition.onerror = (event) => {
    if (active) status(event.error === "not-allowed" ? "Microphone permission denied. Use the keyboard." : "No voice input received. Try again or use the keyboard.");
  };
  recognition.onend = () => { if (active) { active = false; clearTimeout(timer); } };
  const timer = setTimeout(() => { if (active) { status("Voice input ended. Review your words or try again."); cleanup(); } }, 15000);
  try { recognition.start(); } catch (error) { cleanup(); throw error; }
  return cleanup;
}
