/**
 * The sound of placing an outbound call: a number being keyed, then the ringing
 * tone until the patient picks up.
 *
 * Synthesised with Web Audio rather than played from a file, so there is
 * nothing to load and nothing to fail mid-assessment. It has to be started
 * synchronously inside the click that places the call — that is the only
 * moment browsers allow a page to make sound.
 */

// Keypad tones: each digit is a low and a high frequency played together.
const DTMF: Record<string, [number, number]> = {
  "1": [697, 1209], "2": [697, 1336], "3": [697, 1477],
  "4": [770, 1209], "5": [770, 1336], "6": [770, 1477],
  "7": [852, 1209], "8": [852, 1336], "9": [852, 1477],
  "0": [941, 1336],
};

const KEY_ON = 0.09;
const KEY_OFF = 0.07;
const PAUSE_BEFORE_RING = 0.5;

// The familiar double ring: 400 + 450 Hz, on 0.4s, off 0.2s, on 0.4s, off 2s.
const RING_FREQS = [400, 450];
const RING_CYCLE = 3.0;
const RING_CYCLES = 40; // two minutes; stop() cuts it short

export interface Dialler {
  /** Resolves once the number has been keyed and the line has rung once. */
  ready: Promise<void>;
  /** Fades the sound out. Safe to call more than once. */
  stop(): void;
}

const SILENT: Dialler = { ready: Promise.resolve(), stop() {} };

export function startDialler(number = "07700900461"): Dialler {
  const Ctx =
    typeof window === "undefined"
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctx) return SILENT;

  let ctx: AudioContext;
  try {
    ctx = new Ctx();
  } catch {
    return SILENT;
  }
  void ctx.resume();

  const master = ctx.createGain();
  master.gain.value = 0.1;
  master.connect(ctx.destination);

  /** Opens a gain gate for `dur` seconds from `at`, with short ramps so it does not click. */
  const gate = (g: GainNode, at: number, dur: number, level = 1) => {
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(level, at + 0.01);
    g.gain.setValueAtTime(level, at + dur - 0.01);
    g.gain.linearRampToValueAtTime(0, at + dur);
  };

  const t0 = ctx.currentTime + 0.05;

  [...number].forEach((d, i) => {
    const pair = DTMF[d];
    if (!pair) return;
    const at = t0 + i * (KEY_ON + KEY_OFF);
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(master);
    for (const f of pair) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      o.connect(g);
      o.start(at);
      o.stop(at + KEY_ON + 0.02);
    }
    gate(g, at, KEY_ON, 0.6);
  });

  const ringStart = t0 + number.length * (KEY_ON + KEY_OFF) + PAUSE_BEFORE_RING;
  const ring = ctx.createGain();
  ring.gain.value = 0;
  ring.connect(master);
  for (const f of RING_FREQS) {
    const o = ctx.createOscillator();
    o.frequency.value = f;
    o.connect(ring);
    o.start(ringStart);
  }
  for (let c = 0; c < RING_CYCLES; c++) {
    const at = ringStart + c * RING_CYCLE;
    gate(ring, at, 0.4, 0.5);
    gate(ring, at + 0.6, 0.4, 0.5);
  }

  const readyIn = (ringStart + 1.0 - ctx.currentTime) * 1000;
  const ready = new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, readyIn)));

  let stopped = false;
  return {
    ready,
    stop() {
      if (stopped) return;
      stopped = true;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + 0.05);
      setTimeout(() => void ctx.close().catch(() => {}), 120);
    },
  };
}
