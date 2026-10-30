// Game sound effects, synthesized with Web Audio so they cost 0 bytes of download and need no licence.
// The audio context starts only after a tap (browser rule), and the on/off choice is remembered per device.
type Name = "tap" | "go" | "nice" | "perfect" | "early" | "late" | "win" | "lose";

const KEY = "mr_sound";
const FEATURE_KEY = "mr_sound_feature";
let ctx: AudioContext | null = null;
let on = true;
// Sound is off for everyone until the team agrees on it; open a link with ?sound=1 to try it (remembered for the tab).
let feature = false;
const listeners = new Set<(v: boolean) => void>();

try {
  on = localStorage.getItem(KEY) !== "off";
} catch {
  /* storage blocked: keep the default */
}
try {
  if (typeof window !== "undefined") {
    if (new URLSearchParams(window.location.search).get("sound") === "1") sessionStorage.setItem(FEATURE_KEY, "1");
    feature = sessionStorage.getItem(FEATURE_KEY) === "1";
  }
} catch {
  /* storage blocked: sound stays off */
}

export function soundFeature(): boolean {
  return feature;
}

export function soundEnabled(): boolean {
  return on;
}

export function onSoundChange(fn: (v: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const SOUND_NAMES: Name[] = ["go", "tap", "nice", "perfect", "early", "late", "win", "lose"];

export function setSoundEnabled(v: boolean) {
  on = v;
  try {
    localStorage.setItem(KEY, v ? "on" : "off");
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(v));
  if (v) play("go"); // a short blip so the player hears that sound is on
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    try {
      ctx = new C();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  return ctx;
}

// One note: frequency glide from f0 to f1 over `dur` seconds, starting `at` seconds from now.
function note(c: AudioContext, type: OscillatorType, f0: number, f1: number, at: number, dur: number, vol = 0.18) {
  const t0 = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export function play(name: Name, force = false) {
  if (!force && (!feature || !on)) return;
  const c = ac();
  if (!c) return;
  switch (name) {
    case "go": // round start: three rising blips
      [520, 780, 1040].forEach((f, k) => note(c, "square", f, f * 1.08, k * 0.11, 0.12, 0.13));
      break;
    case "tap": // button slam: low thump plus a click
      note(c, "triangle", 200, 45, 0, 0.32, 0.5);
      note(c, "square", 900, 300, 0, 0.06, 0.12);
      break;
    case "nice": // bright three-note chime with a tail
      [784, 988, 1319].forEach((f, k) => {
        note(c, "sine", f, f, k * 0.1, 0.45, 0.2);
        note(c, "sine", f * 2, f * 2, k * 0.1, 0.3, 0.06);
      });
      break;
    case "perfect": // rising arpeggio ending on a held chord
      [523, 659, 784, 1047, 1319, 1568].forEach((f, k) => note(c, "sine", f, f, k * 0.075, 0.35, 0.18));
      [1047, 1319, 1568].forEach((f) => note(c, "triangle", f, f, 0.5, 0.9, 0.12));
      break;
    case "early": // boss alarm: four harsh beeps
      for (let k = 0; k < 4; k++) note(c, "sawtooth", k % 2 ? 260 : 340, k % 2 ? 260 : 340, k * 0.17, 0.14, 0.2);
      break;
    case "late": // sad trombone: two sliding notes
      note(c, "triangle", 392, 330, 0, 0.35, 0.28);
      note(c, "triangle", 330, 262, 0.38, 0.35, 0.28);
      note(c, "triangle", 262, 130, 0.78, 0.8, 0.3);
      break;
    case "win": // fanfare: run up, then a full chord
      [523, 659, 784, 1047, 784, 1047].forEach((f, k) => note(c, "square", f, f, k * 0.1, 0.18, 0.12));
      [523, 659, 784, 1047].forEach((f) => note(c, "triangle", f, f, 0.65, 1.1, 0.14));
      break;
    case "lose": // low three-step descent
      [330, 247, 185].forEach((f, k) => note(c, "sawtooth", f, f * 0.86, k * 0.34, 0.5, 0.18));
      note(c, "triangle", 92, 55, 1.0, 0.9, 0.3);
      break;
  }
}

// Browsers keep audio locked until a tap, so wake it on the first touch anywhere instead of at the first sound.
if (typeof window !== "undefined") {
  const wake = () => {
    if (feature && on) ac();
  };
  window.addEventListener("pointerdown", wake, { passive: true });
  window.addEventListener("keydown", wake, { passive: true });
}
