/**
 * Horoscope ambience: Web Audio drone + visual/copy tokens for a celestial UI.
 * CSS variables and shimmer utilities live in `src/index.css` (`horoscope global tokens`).
 */

/** Discoverable class names — mirror comments in `index.css` horoscope agent block. */
export const hzAmbienceClassNames = {
  /** Opacity + translate shimmer for short titles. */
  shimmer: "hz-shimmer",
  /** Lower contrast shimmer. */
  shimmerSubtle: "hz-shimmer hz-shimmer--subtle",
  /** Slower shimmer (e.g. decorative borders). */
  shimmerSlow: "hz-shimmer hz-shimmer--slow",
  /** Soft outer glow on cards or chips. */
  glowSoft: "hz-glow-soft",
  /** Cooler, moon-tinted halo. */
  glowMoon: "hz-glow-moon",
  /** Layered deep-sky gradient shell (use on a wrapper or section). */
  skyDeep: "hz-sky-deep",
} as const;

/** RGBA / hex tokens for inline styles or canvas (aligned with `--hz-*` in CSS). */
export const hzPalette = {
  ink: "#141c28",
  inkSoft: "rgba(20, 28, 40, 0.78)",
  accent: "#6a8aa3",
  accentSoft: "rgba(106, 138, 163, 0.38)",
  moon: "#e4eaf4",
  star: "#c5d2e6",
  twilight: "#8b7aa8",
  deepSpace: "#0c1018",
  skyBand: "rgba(95, 125, 158, 0.32)",
  hazeTop: "rgba(230, 236, 248, 0.16)",
} as const;

/** Full `background` stacks the UI agent can drop on a container (prefer CSS vars when possible). */
export const hzGradientPresets = {
  /** Twilight indigo → soft horizon (default “reading” sky). */
  deepSky: `radial-gradient(120% 85% at 50% -8%, ${hzPalette.hazeTop}, transparent 58%),
    radial-gradient(90% 70% at 100% 12%, ${hzPalette.skyBand}, transparent 52%),
    linear-gradient(168deg, ${hzPalette.deepSpace} 0%, #152030 38%, #243447 100%)`,
  /** Lighter veil for cards on warm app chrome. */
  cardVeil: `radial-gradient(140% 90% at 50% 0%, rgba(232, 240, 248, 0.55), transparent 50%),
    linear-gradient(155deg, rgba(255, 253, 248, 0.94) 0%, rgba(245, 248, 252, 0.88) 100%)`,
  /** Accent edge for focus rings or dividers. */
  accentEdge: `linear-gradient(90deg, transparent, ${hzPalette.accentSoft}, transparent)`,
} as const;

export type MoonPhaseKind = "new" | "waxing" | "full" | "waning" | "unknown";

/**
 * Coarse phase bucket from API `moonPhase` string (title-case labels from the server).
 */
export function inferMoonPhaseKind(moonPhase: string): MoonPhaseKind {
  const p = moonPhase.trim().toLowerCase();
  if (!p) return "unknown";
  if (p === "new") return "new";
  if (p.includes("full")) return "full";
  if (p.includes("waning") || p.includes("last quarter")) return "waning";
  if (p.includes("waxing") || p.includes("first quarter")) return "waxing";
  return "unknown";
}

/**
 * One-line atmospheric subtitle the panel can show under moon facts (optional).
 */
export function moonPhaseAmbienceLine(moonPhase: string, moonIlluminationPercent: number): string {
  const kind = inferMoonPhaseKind(moonPhase);
  const illum = Math.max(0, Math.min(100, moonIlluminationPercent));
  const lit = `${Math.round(illum)}%`;
  switch (kind) {
    case "new":
      return `The sky leans inward — a thin ${lit} sliver invites quiet intention.`;
    case "waxing":
      return `Light gathers (${lit} lit) — a slow brightening, steady as breath.`;
    case "full":
      return `Lunar fullness (${lit} lit) — high tides of feeling, soft edges in thought.`;
    case "waning":
      return `Silver recedes (${lit} lit) — room to release what no longer serves.`;
    default:
      if (illum < 18) return `A slender moon (${lit} lit) — secrets kept close to the chest.`;
      if (illum > 82) return `Almost full (${lit} lit) — clarity with a gentle halo.`;
      return `Balanced light (${lit} lit) — neither rush nor hush, just the present sky.`;
  }
}

/**
 * Short epithet for badges or aria-hidden decorative spans (no medical claims).
 */
export function moonPhaseEpithet(moonPhase: string): string {
  const kind = inferMoonPhaseKind(moonPhase);
  const map: Record<MoonPhaseKind, string> = {
    new: "Hush tide",
    waxing: "Gathering light",
    full: "Silver crown",
    waning: "Soft ebb",
    unknown: "Open sky",
  };
  return map[kind];
}

/* --- Web Audio drone (user gesture) --- */

let audioContext: AudioContext | null = null;

type RunningGraph = {
  oscillators: OscillatorNode[];
  oscGains: GainNode[];
  filter: BiquadFilterNode;
  masterGain: GainNode;
};

let runningGraph: RunningGraph | null = null;

/** Bumped on every stop/start so an in-flight `startHoroscopeAmbience` can abort after `await resume()`. */
let ambienceToken = 0;

function getAudioContextCtor(): (typeof AudioContext) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { webkitAudioContext?: typeof AudioContext };
  return window.AudioContext ?? w.webkitAudioContext ?? null;
}

function ensureContext(): AudioContext | null {
  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new Ctor();
  }
  return audioContext;
}

function teardownGraph(): void {
  if (!runningGraph || !audioContext) return;
  const ctx = audioContext;
  const { oscillators, oscGains, filter, masterGain } = runningGraph;
  masterGain.gain.cancelScheduledValues(ctx.currentTime);
  for (const o of oscillators) {
    try {
      o.stop();
    } catch {
      /* already stopped */
    }
    o.disconnect();
  }
  for (const g of oscGains) {
    g.disconnect();
  }
  filter.disconnect();
  masterGain.disconnect();
  runningGraph = null;
}

/** Disconnect oscillators and silence output. Safe to call repeatedly. */
export function stopHoroscopeAmbience(): void {
  ambienceToken++;
  teardownGraph();
}

/**
 * Call **synchronously** from a click/keydown handler **before** any `await`.
 * Browsers only resume a suspended `AudioContext` from a user gesture; starting
 * audio only inside `useEffect` after `setState` is usually too late.
 */
export function touchHoroscopeAmbienceFromUserGesture(): void {
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
}

/** Alias for mood generator + horoscope — resume `AudioContext` inside the user-gesture stack. */
export const touchAmbientAudioFromUserGesture = touchHoroscopeAmbienceFromUserGesture;

/** One layer in an AI-designed mood ambience patch (Web Audio). */
export type MoodAmbienceLayer = {
  waveform: "sine" | "triangle";
  frequencyHz: number;
  detuneCents: number;
  gain: number;
};

/** Full patch from `POST /api/ambience/generate`. */
export type MoodAmbienceSpec = {
  title: string;
  description: string;
  layers: MoodAmbienceLayer[];
  lowpassHz: number;
  lowpassQ: number;
  masterPeak: number;
  swellSeconds: number;
  filterSweepToHz?: number | null;
};

function coerceMoodSpec(raw: MoodAmbienceSpec): MoodAmbienceSpec {
  const layers = (raw.layers || [])
    .slice(0, 4)
    .map((L) => ({
      waveform: L.waveform === "triangle" ? "triangle" : "sine",
      frequencyHz: Math.min(400, Math.max(48, Number(L.frequencyHz) || 110)),
      detuneCents: Math.min(25, Math.max(-25, Number(L.detuneCents) || 0)),
      gain: Math.min(0.12, Math.max(0.02, Number(L.gain) || 0.05)),
    }))
    .filter((L) => Number.isFinite(L.frequencyHz));
  while (layers.length < 2) {
    layers.push({ waveform: "sine", frequencyHz: 110 + layers.length * 55, detuneCents: 0, gain: 0.045 });
  }
  const lowpassHz = Math.min(5500, Math.max(350, Number(raw.lowpassHz) || 900));
  const lowpassQ = Math.min(3, Math.max(0.2, Number(raw.lowpassQ) || 0.8));
  const masterPeak = Math.min(0.36, Math.max(0.08, Number(raw.masterPeak) || 0.2));
  const swellSeconds = Math.min(14, Math.max(2, Number(raw.swellSeconds) || 5));
  const fs = raw.filterSweepToHz;
  const filterSweepToHz =
    fs != null && Number.isFinite(Number(fs)) ? Math.min(9000, Math.max(400, Number(fs))) : null;
  return {
    title: String(raw.title || "Ambience").slice(0, 80),
    description: String(raw.description || "").slice(0, 220),
    layers,
    lowpassHz,
    lowpassQ,
    masterPeak,
    swellSeconds,
    filterSweepToHz,
  };
}

/**
 * Play a mood-designed drone (replaces any horoscope drone — same output bus).
 */
export async function startMoodAmbience(rawSpec: MoodAmbienceSpec): Promise<void> {
  const spec = coerceMoodSpec(rawSpec);
  const ctx = ensureContext();
  if (!ctx) throw new Error("Web Audio API unavailable in this environment.");

  teardownGraph();
  const startToken = ++ambienceToken;

  await ctx.resume();

  if (startToken !== ambienceToken) return;

  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = spec.lowpassQ;

  const fStart = Math.max(90, Math.min(spec.lowpassHz * 0.32, 520));
  filter.frequency.setValueAtTime(fStart, now);

  masterGain.gain.value = 0;
  filter.connect(masterGain);
  masterGain.connect(ctx.destination);

  const oscillators: OscillatorNode[] = [];
  const oscGains: GainNode[] = [];

  for (const layer of spec.layers) {
    const osc = ctx.createOscillator();
    osc.type = layer.waveform === "triangle" ? "triangle" : "sine";
    osc.frequency.value = layer.frequencyHz;
    osc.detune.value = layer.detuneCents;
    const g = ctx.createGain();
    g.gain.value = layer.gain;
    osc.connect(g);
    g.connect(filter);
    oscillators.push(osc);
    oscGains.push(g);
  }
  const swell = spec.swellSeconds;
  const tOpen = now + Math.max(1.2, swell * 0.55);
  const tEnd = now + swell;

  oscillators.forEach((o) => o.start(now));
  masterGain.gain.linearRampToValueAtTime(spec.masterPeak, tEnd);

  const fMid = Math.max(fStart + 30, spec.lowpassHz);
  filter.frequency.exponentialRampToValueAtTime(Math.min(fMid, 6000), tOpen);
  const sweepTo = spec.filterSweepToHz;
  if (sweepTo != null && sweepTo > fMid + 8) {
    filter.frequency.exponentialRampToValueAtTime(Math.min(sweepTo, 8500), tEnd);
  } else {
    filter.frequency.exponentialRampToValueAtTime(Math.min(fMid * 1.08, 7200), tEnd);
  }

  if (startToken !== ambienceToken) {
    teardownGraph();
    return;
  }

  runningGraph = { oscillators, oscGains, filter, masterGain };
}

/**
 * Start (or restart) the drone. Resumes a suspended AudioContext after browser autoplay rules.
 * Master gain uses a slow ramp for a gentle swell.
 */
export async function startHoroscopeAmbience(): Promise<void> {
  const ctx = ensureContext();
  if (!ctx) return;

  teardownGraph();
  const startToken = ++ambienceToken;

  await ctx.resume();

  if (startToken !== ambienceToken) return;

  const masterGain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1050;
  filter.Q.value = 0.85;

  masterGain.gain.value = 0;
  filter.connect(masterGain);
  masterGain.connect(ctx.destination);

  const baseFreq = 146;
  const detunesCents = [-7, 0, 6];
  /** Per-oscillator gain into the filter; combined with master stays below clipping. */
  const perOscGain = 0.055;

  const oscillators: OscillatorNode[] = [];
  const oscGains: GainNode[] = [];

  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = baseFreq;
    osc.detune.value = detunesCents[i];
    const g = ctx.createGain();
    g.gain.value = perOscGain;
    osc.connect(g);
    g.connect(filter);
    oscillators.push(osc);
    oscGains.push(g);
  }

  const now = ctx.currentTime;
  /** Master output ~ whisper-soft but clearly audible on laptop speakers. */
  const peakMaster = 0.22;
  oscillators.forEach((o) => o.start(now));
  masterGain.gain.linearRampToValueAtTime(peakMaster, now + 4);

  if (startToken !== ambienceToken) {
    teardownGraph();
    return;
  }

  runningGraph = { oscillators, oscGains, filter, masterGain };
}
