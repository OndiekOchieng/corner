/**
 * primeSpeechFromGesture — unlock the browser Speech API from a user gesture.
 *
 * On Chrome (especially Android), `speechSynthesis.speak()` only produces audio if
 * the FIRST utterance is initiated by a user gesture; a later, non-gesture speak()
 * is queued but never starts (onstart never fires) — the exact boundary this
 * project's speech traces to. Corner is hands-free: the coach's first line is
 * emitted from an effect after navigation, with no gesture.
 *
 * Calling this from the Start button's handler speaks a single SILENT utterance
 * within the gesture, which grants speech for the (same-document) workout that
 * follows. It is NOT a speech implementation and does NOT replace the
 * SpeechService — it only flips the browser's one-time activation, using the same
 * global `speechSynthesis` the SpeechService will use. Browser-only, so it lives
 * in the Media Runtime.
 */
export function primeSpeechFromGesture(): void {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;
  try {
    synth.resume(); // clear any suspended state
    synth.getVoices(); // kick the async voice load (Chrome)
    const primer = new SpeechSynthesisUtterance(' ');
    primer.volume = 0; // silent — this is an unlock, not a cue
    synth.speak(primer);
  } catch {
    /* best-effort: never let priming throw into a click handler */
  }
}
