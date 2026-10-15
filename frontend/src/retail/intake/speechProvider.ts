export type SpeechLanguage = "en-IN" | "hi-IN";
export interface SpeechProvider {
  supported: boolean;
  start(
    language: SpeechLanguage,
    onText: (text: string) => void,
    onError: (message: string) => void,
    onEnd: () => void,
  ): () => void;
}
/** Optional device service, never a generative model. The browser may use its
 * own online recognition service; the UI explains this before microphone use. */
export const browserSpeechProvider: SpeechProvider = {
  supported:
    typeof window !== "undefined" &&
    !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    ),
  start(language, onText, onError, onEnd) {
    const Constructor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!Constructor) {
      onError(
        "Voice input isn't supported on this device yet. Type items instead.",
      );
      return () => {};
    }
    const recognition = new Constructor();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      onText(
        Array.from(event.results as any[])
          .map((r: any) => r[0]?.transcript || "")
          .join(" "),
      );
    };
    recognition.onerror = () =>
      onError("Voice could not be recognized. Try again or type your items.");
    recognition.onend = onEnd;
    recognition.start();
    return () => recognition.abort();
  },
};
