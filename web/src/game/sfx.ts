// Game sound: picked effect files plus a background loop, played through Web Audio (synthesized sounds are the fallback).
// The audio context starts only after a tap (browser rule). Defaults for everyone: effects ON, music ON, each with its own button and remembered per device.
// A link with ?sound=1 is the test mode (music on by default, vibration on, sound lab panel on the left).
type Name = "tap" | "go" | "nice" | "perfect" | "early" | "late" | "win" | "lose";

const KEY = "mr_sound";
const FEATURE_KEY = "mr_sound_feature";
let ctx: AudioContext | null = null;
let on = true; // sound effects
let musicOn = true; // background music (on by default; the visitor's own choice is remembered)
// Public since 2026-10-31: the sound button is shown to everyone. `lab` marks the ?sound=1 test mode (remembered for the tab).
let feature = true;
let lab = false;
const listeners = new Set<(v: boolean) => void>();

try {
  if (typeof window !== "undefined") {
    if (new URLSearchParams(window.location.search).get("sound") === "1") sessionStorage.setItem(FEATURE_KEY, "1");
    lab = sessionStorage.getItem(FEATURE_KEY) === "1";
  }
} catch {
  /* storage blocked: not in test mode */
}
try {
  const saved = localStorage.getItem(KEY);
  on = saved ? saved === "on" : true;
  const m = localStorage.getItem("mr_music");
  musicOn = m ? m === "on" : true; // music is on by default (decided 2026-10-31); a visitor who turns it off keeps it off
} catch {
  /* storage blocked: keep the default */
}

// Background music for the test build: open a link with &bgm=1 (or 2, 3) to hear /sfx/bgm/<n>.mp3 as a quiet loop during a game.
const BGM_KEY = "mr_bgm";
const DEFAULT_BGM = "5"; // confirmed 2026-10-31: Lyria fast electronic
let bgmId: string | null = null;
try {
  if (typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search).get("bgm");
    if (q) sessionStorage.setItem(BGM_KEY, q);
    const stored = sessionStorage.getItem(BGM_KEY);
    bgmId = stored === "none" ? null : stored || DEFAULT_BGM;
  }
} catch {
  /* storage blocked: no music */
}
let bgmBuf: AudioBuffer | null | undefined;
let bgmSrc: AudioBufferSourceNode | null = null;
let bgmLoading = false;
// After a game ends the music stays off (result and ranking screens) until the next game starts it again.
let bgmHold = false;

export function startBgm(force = false) {
  if (bgmHold && !force) return;
  if (force) bgmHold = false;
  if (!feature || !musicOn || !bgmId || bgmSrc || bgmLoading || bgmBuf === null) return;
  const c = ac();
  if (!c) return;
  const begin = (buf: AudioBuffer) => {
    if (bgmSrc || !musicOn) return;
    const g = c.createGain();
    g.gain.value = 0.22;
    const s = c.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.connect(g).connect(c.destination);
    s.start();
    bgmSrc = s;
  };
  if (bgmBuf) {
    begin(bgmBuf);
    return;
  }
  bgmLoading = true;
  fetch(`/sfx/bgm/${encodeURIComponent(bgmId)}.mp3`)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("none"))))
    .then((b) => c.decodeAudioData(b))
    .then((buf) => {
      bgmBuf = buf;
      bgmLoading = false;
      begin(buf);
    })
    .catch(() => {
      bgmBuf = null;
      bgmLoading = false;
    });
}

export function stopBgm(gameEnded = false) {
  if (gameEnded) bgmHold = true;
  if (bgmSrc) {
    try {
      bgmSrc.stop();
    } catch {
      /* already stopped */
    }
    bgmSrc = null;
  }
}

/** True in the ?sound=1 test mode: the sound lab panel is shown. */
export function labEnabled(): boolean {
  return lab;
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

export function musicEnabled(): boolean {
  return musicOn;
}

const musicListeners = new Set<(v: boolean) => void>();
export function onMusicChange(fn: (v: boolean) => void): () => void {
  musicListeners.add(fn);
  return () => musicListeners.delete(fn);
}

export function setMusicEnabled(v: boolean) {
  musicOn = v;
  try {
    localStorage.setItem("mr_music", v ? "on" : "off");
  } catch {
    /* ignore */
  }
  musicListeners.forEach((fn) => fn(v));
  if (v) {
    ac();
    startBgm();
  } else stopBgm();
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

// Picked sound files, if any: /sfx/<number>_<name>/pick.mp3. A missing file keeps the synthesized sound.
const FILE_DIR: Record<Name, string> = { go: "01_go", tap: "02_tap", nice: "03_nice", perfect: "04_perfect", early: "05_early", late: "06_late", win: "07_win", lose: "08_lose" };
const files: Partial<Record<Name, AudioBuffer | null>> = {};
let filesAsked = false;

function loadFiles(c: AudioContext) {
  if (filesAsked) return;
  filesAsked = true;
  SOUND_NAMES.forEach((n) => {
    void loadOne(c, n);
  });
}

// `semis` raises a picked sound file by that many semitones (the tap climbs a step every round); the synthesized fallback ignores it.
// Vibration (Android browsers only; iOS Safari has no vibration API). Test mode only until the team decides to ship it.
const VIBE: Record<Name, number | number[]> = { go: 20, tap: 15, nice: [20, 30, 20], perfect: [30, 40, 30, 40, 80], early: [90, 50, 90], late: 120, win: [40, 40, 40, 40, 120], lose: 200 };
function buzz(name: Name) {
  if (!lab) return;
  try {
    navigator.vibrate?.(VIBE[name]);
  } catch {
    /* no vibration support */
  }
}

export function play(name: Name, force = false, semis = 0) {
  buzz(name);
  if (!force && (!feature || !on)) return;
  const c = ac();
  if (!c) return;
  loadFiles(c);
  const buf = files[name];
  if (buf) {
    const src = c.createBufferSource();
    src.buffer = buf;
    if (semis) src.playbackRate.value = 2 ** (semis / 12);
    src.connect(c.destination);
    src.start();
    return;
  }
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
    if (feature && (on || musicOn)) {
      ac();
      startBgm(); // the music runs from the first touch and keeps going through results and retries
    }
  };
  window.addEventListener("pointerdown", wake, { passive: true });
  window.addEventListener("keydown", wake, { passive: true });
}

// Sound lab (test build only, opened with ?sound=1): the left panel can swap the sound of each event and the background music.
// Choices live in localStorage so a reload keeps the combination.
const LAB_KEY = "mr_lab";
const labUrl: Partial<Record<Name, string>> = {};
try {
  const saved = typeof window !== "undefined" ? localStorage.getItem(LAB_KEY) : null;
  if (saved) Object.assign(labUrl, (JSON.parse(saved) as { sfx?: Record<string, string> }).sfx ?? {});
} catch {
  /* ignore a broken saved value */
}

function fileUrl(n: Name): string {
  return labUrl[n] || `/sfx/${FILE_DIR[n]}/pick.mp3`;
}

function loadOne(c: AudioContext, n: Name) {
  return fetch(fileUrl(n))
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("none"))))
    .then((b) => c.decodeAudioData(b))
    .then((buf) => {
      files[n] = buf;
    })
    .catch(() => {
      files[n] = null;
    });
}

/** Use `url` for this event from now on (empty string = back to the confirmed default file). */
export function labSetSound(n: Name, url: string) {
  if (url) labUrl[n] = url;
  else delete labUrl[n];
  try {
    localStorage.setItem(LAB_KEY, JSON.stringify({ sfx: labUrl }));
  } catch {
    /* ignore */
  }
  const c = ac();
  if (c) void loadOne(c, n);
}

/** Play any candidate file once, at its normal pitch. */
export function labPreview(url: string) {
  const c = ac();
  if (!c) return;
  void fetch(url)
    .then((r) => r.arrayBuffer())
    .then((b) => c.decodeAudioData(b))
    .then((buf) => {
      const s = c.createBufferSource();
      s.buffer = buf;
      s.connect(c.destination);
      s.start();
    })
    .catch(() => undefined);
}

/** Pick the background music (id = file name under /sfx/bgm/, empty = none); the next game start uses it. */
export function labSetBgm(id: string) {
  stopBgm();
  bgmBuf = undefined;
  bgmId = id || null;
  try {
    sessionStorage.setItem(BGM_KEY, id || "none");
  } catch {
    /* ignore */
  }
}

export function labBgmPreview(on: boolean) {
  if (on) {
    feature = true;
    setMusicEnabled(true);
    startBgm(true);
  } else stopBgm();
}

export function labCurrent(): { sfx: Partial<Record<Name, string>>; bgm: string | null } {
  return { sfx: { ...labUrl }, bgm: bgmId };
}
