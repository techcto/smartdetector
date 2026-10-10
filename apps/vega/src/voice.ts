export const browserVoiceAvailable = false;
export function startBrowserVoice(_text: (value: string) => void, _status: (value: string) => void): () => void {
  throw new Error("Use your TV keyboard’s dictation option, if available, or type your search.");
}
