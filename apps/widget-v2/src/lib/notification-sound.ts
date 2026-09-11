/**
 * A short two-note chime played when the agent replies while the visitor is not
 * watching the conversation.
 *
 * Synthesized with the Web Audio API rather than shipped as an audio file: it
 * adds no bytes to the bundle, makes no network request, and cannot fail on a
 * blocked or slow asset. The envelope matters — a bare oscillator start/stop
 * produces an audible click, so each note fades in and out.
 */

const MUTED_KEY_PREFIX = "ag_widget_sound_muted_v1";

// A5 then D6: a rising interval reads as "something arrived" rather than
// "something went wrong", and sits above typical page noise without being shrill.
const NOTES = [
  { frequency: 880, startAt: 0, duration: 0.16 },
  { frequency: 1174.66, startAt: 0.1, duration: 0.22 },
] as const;

const PEAK_GAIN = 0.07;
const ATTACK_SECONDS = 0.012;

type AudioContextConstructor = typeof AudioContext;

let audioContext: AudioContext | null = null;
let audioUnavailable = false;

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;

  const candidate =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor })
      .webkitAudioContext;

  return candidate ?? null;
}

function getAudioContext() {
  if (audioUnavailable) return null;
  if (audioContext) return audioContext;

  const Constructor = getAudioContextConstructor();
  if (!Constructor) {
    audioUnavailable = true;
    return null;
  }

  try {
    audioContext = new Constructor();
    return audioContext;
  } catch {
    audioUnavailable = true;
    return null;
  }
}

function getMutedKey(widgetPublicKey: string) {
  return `${MUTED_KEY_PREFIX}_${widgetPublicKey}`;
}

export function isNotificationSoundMuted(widgetPublicKey: string) {
  if (typeof window === "undefined") return false;

  try {
    return localStorage.getItem(getMutedKey(widgetPublicKey)) === "true";
  } catch {
    // Privacy-restricted browsers simply get the default.
    return false;
  }
}

export function setNotificationSoundMuted(
  widgetPublicKey: string,
  muted: boolean,
) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(getMutedKey(widgetPublicKey), muted ? "true" : "false");
  } catch {
    // The preference is best-effort; muting still applies for this page view.
  }
}

/**
 * Browsers create an AudioContext in a suspended state until a user gesture.
 * Call this from a real interaction (opening the widget, sending a message) so
 * the context is running by the time a reply arrives — otherwise the first
 * chime of a conversation is silently dropped.
 */
export function primeNotificationSound() {
  const context = getAudioContext();
  if (!context || context.state !== "suspended") return;

  void context.resume().catch(() => {
    // Still no gesture the browser accepts; the next attempt can try again.
  });
}

export function playNotificationSound() {
  const context = getAudioContext();
  if (!context) return;

  if (context.state === "suspended") {
    // Resuming is async, so this chime is lost; priming on interaction is what
    // keeps that from happening on a real conversation.
    void context.resume().catch(() => {});
    return;
  }

  try {
    const startedAt = context.currentTime;

    for (const note of NOTES) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = startedAt + note.startAt;
      const noteEnd = noteStart + note.duration;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(note.frequency, noteStart);

      // Fade in, then decay to (near) silence. exponentialRampToValueAtTime
      // cannot target 0, hence the small floor.
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(
        PEAK_GAIN,
        noteStart + ATTACK_SECONDS,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteEnd + 0.02);
    }
  } catch {
    // Audio is a nicety; never let it interrupt the conversation.
  }
}
