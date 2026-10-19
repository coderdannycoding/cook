// Fully procedural audio: every sound effect and the background music are synthesised
// with the Web Audio API at runtime. No audio files are loaded.

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

const SONGS = {
  day: {
    bpm: 112, swing: 0.6, drums: 'full', melodyProb: 0.5,
    chords: [
      { bass: 48, notes: [64, 67, 71, 74], scale: [60, 62, 64, 67, 69, 72, 74, 76] },
      { bass: 45, notes: [61, 64, 67, 71], scale: [57, 61, 64, 67, 69, 73, 76] },
      { bass: 50, notes: [65, 69, 72, 76], scale: [62, 65, 67, 69, 72, 74, 77] },
      { bass: 43, notes: [65, 69, 71, 76], scale: [62, 65, 67, 71, 74, 77, 79] },
    ],
  },
  night: {
    bpm: 76, swing: 0.62, drums: 'lofi', melodyProb: 0.32,
    chords: [
      { bass: 41, notes: [64, 69, 72, 76], scale: [65, 67, 69, 72, 74, 76] },
      { bass: 40, notes: [62, 67, 71, 74], scale: [64, 67, 69, 71, 74, 76] },
      { bass: 38, notes: [60, 65, 69, 72], scale: [62, 65, 67, 69, 72, 74] },
      { bass: 36, notes: [59, 64, 67, 71], scale: [60, 62, 64, 67, 69, 72] },
    ],
  },
  rush: {
    bpm: 132, swing: 0.55, drums: 'full', melodyProb: 0.6,
    chords: [
      { bass: 45, notes: [60, 64, 67, 71], scale: [57, 60, 62, 64, 67, 69, 72] },
      { bass: 41, notes: [60, 64, 65, 69], scale: [57, 60, 62, 65, 67, 69, 72] },
      { bass: 43, notes: [59, 62, 65, 67], scale: [55, 59, 62, 65, 67, 71] },
      { bass: 40, notes: [59, 62, 64, 68], scale: [56, 59, 62, 64, 68, 71] },
    ],
  },
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.vol = { master: 0.8, sfx: 0.9, music: 0.55 };
    this.muted = false;
    this.loopLevels = { sizzle: 0, fire: 0, spray: 0, boil: 0, fry: 0 };
    this.loops = {};
    this.song = null;
    this.musicStep = 0;
    this.nextNoteTime = 0;
    this.motif = [];
    this.lastAlarm = 0;
    this.alarmOn = false;
    this.alarmFlip = false;
    this.lastCrackle = 0;
    this.lastBubble = 0;
    this.throttle = new Map();
  }

  get ready() { return !!this.ctx && this.ctx.state === 'running'; }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);

    // Small procedural reverb for bells & music
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(1.6, 2.8);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.25;
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.master);

    this.noiseBuf = this._noiseBuffer(2);
    this._applyVolumes();
    this._initLoops();
  }

  setVolumes({ master, sfx, music }) {
    if (master !== undefined) this.vol.master = master;
    if (sfx !== undefined) this.vol.sfx = sfx;
    if (music !== undefined) this.vol.music = music;
    this._applyVolumes();
  }

  setMuted(m) {
    this.muted = m;
    this._applyVolumes();
  }

  _applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.05);
  }

  _noiseBuffer(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _impulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // Generic oscillator voice with envelope
  _tone({ type = 'sine', freq = 440, freqEnd = null, dur = 0.2, vol = 0.2, attack = 0.005, delay = 0, dest = null, filter = null, q = 1, reverb = 0, detune = 0, vibrato = 0 }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.detune.value = detune;
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 7;
      lg.gain.value = vibrato;
      lfo.connect(lg);
      lg.connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.05);
    }
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      f.Q.value = q;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(dest || this.sfxBus);
    if (reverb) {
      const rg = ctx.createGain();
      rg.gain.value = reverb;
      g.connect(rg);
      rg.connect(this.reverb);
    }
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  _noise({ dur = 0.2, vol = 0.2, type = 'bandpass', freq = 1000, freqEnd = null, q = 1, attack = 0.003, delay = 0, dest = null, reverb = 0 }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const off = Math.random() * Math.max(0, 1.85 - dur);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest || this.sfxBus);
    if (reverb) {
      const rg = ctx.createGain();
      rg.gain.value = reverb;
      g.connect(rg);
      rg.connect(this.reverb);
    }
    src.start(t0, off, dur + 0.1);
  }

  _ok(name, minGap = 0.03) {
    if (!this.ctx || this.muted) return false;
    const t = this.ctx.currentTime;
    const last = this.throttle.get(name) || 0;
    if (t - last < minGap) return false;
    this.throttle.set(name, t);
    return true;
  }

  // ---------------------------------------------------------------- loops
  _initLoops() {
    const ctx = this.ctx;
    const mk = (type, freq, q, extra) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f);
      let last = f;
      if (extra) { f.connect(extra); last = extra; }
      last.connect(g);
      g.connect(this.sfxBus);
      src.start();
      return { src, f, g };
    };
    this.loops.sizzle = mk('highpass', 3500, 0.5);
    this.loops.fry = mk('bandpass', 2200, 0.6);
    this.loops.fire = mk('lowpass', 700, 0.8);
    this.loops.spray = mk('bandpass', 1400, 0.5);
    this.loops.boil = mk('lowpass', 400, 1);
  }

  setLoop(name, level) {
    this.loopLevels[name] = level;
  }

  _updateLoops() {
    const t = this.ctx.currentTime;
    const L = this.loopLevels;
    const jitter = () => 0.75 + Math.random() * 0.5;
    this.loops.sizzle.g.gain.setTargetAtTime(Math.min(1, L.sizzle) * 0.07 * jitter(), t, 0.05);
    this.loops.fry.g.gain.setTargetAtTime(Math.min(1, L.fry) * 0.06 * jitter(), t, 0.05);
    this.loops.fire.g.gain.setTargetAtTime(Math.min(1.5, L.fire) * 0.22 * jitter(), t, 0.08);
    this.loops.spray.g.gain.setTargetAtTime(L.spray ? 0.16 : 0, t, 0.03);
    this.loops.boil.g.gain.setTargetAtTime(Math.min(1, L.boil) * 0.08, t, 0.1);

    if (L.boil > 0 && t - this.lastBubble > 0.09 && Math.random() < 0.35) {
      this.lastBubble = t;
      this._tone({ freq: 250 + Math.random() * 300, freqEnd: 700 + Math.random() * 500, dur: 0.07, vol: 0.03 * Math.min(1, L.boil) });
    }
    if (L.fire > 0 && t - this.lastCrackle > 0.05 && Math.random() < 0.3) {
      this.lastCrackle = t;
      this._noise({ dur: 0.03, vol: 0.12, type: 'highpass', freq: 2500 + Math.random() * 3000, q: 0.5 });
    }
    if (this.alarmOn && t - this.lastAlarm > 0.42) {
      this.lastAlarm = t;
      this.alarmFlip = !this.alarmFlip;
      this._tone({ type: 'square', freq: this.alarmFlip ? 932 : 698, dur: 0.36, vol: 0.035, filter: 2400 });
    }
  }

  setAlarm(on) { this.alarmOn = on; }

  // ---------------------------------------------------------------- sfx
  chop() {
    if (!this._ok('chop', 0.05)) return;
    const p = 0.85 + Math.random() * 0.3;
    this._noise({ dur: 0.05, vol: 0.35, type: 'bandpass', freq: 2600 * p, q: 1.5 });
    this._tone({ type: 'triangle', freq: 210 * p, freqEnd: 90, dur: 0.08, vol: 0.25 });
  }
  knead() {
    if (!this._ok('knead', 0.05)) return;
    this._noise({ dur: 0.1, vol: 0.2, type: 'lowpass', freq: 600, q: 0.7 });
    this._tone({ freq: 120, freqEnd: 70, dur: 0.1, vol: 0.18 });
  }
  clink() {
    if (!this._ok('clink', 0.04)) return;
    const p = 0.95 + Math.random() * 0.1;
    this._tone({ freq: 2200 * p, dur: 0.25, vol: 0.09 });
    this._tone({ freq: 3170 * p, dur: 0.18, vol: 0.06 });
    this._tone({ freq: 4410 * p, dur: 0.12, vol: 0.04 });
  }
  cash() {
    if (!this._ok('cash', 0.08)) return;
    this._noise({ dur: 0.05, vol: 0.25, type: 'highpass', freq: 3000 });
    this._tone({ type: 'triangle', freq: 1318.5, dur: 0.5, vol: 0.16, delay: 0.05, reverb: 0.3 });
    this._tone({ type: 'triangle', freq: 1760, dur: 0.7, vol: 0.16, delay: 0.12, reverb: 0.3 });
    this._tone({ freq: 3520, dur: 0.4, vol: 0.05, delay: 0.12 });
  }
  coin() {
    if (!this._ok('coin', 0.04)) return;
    this._tone({ type: 'square', freq: 1500, dur: 0.06, vol: 0.05, filter: 5000 });
    this._tone({ type: 'square', freq: 2250, dur: 0.18, vol: 0.05, delay: 0.06, filter: 5000 });
  }
  bell() {
    if (!this._ok('bell', 0.3)) return;
    this._tone({ freq: 1046.5, dur: 0.9, vol: 0.12, reverb: 0.5 });
    this._tone({ freq: 2093, dur: 0.5, vol: 0.03, reverb: 0.3 });
    this._tone({ freq: 1318.5, dur: 1.1, vol: 0.12, delay: 0.22, reverb: 0.5 });
    this._tone({ freq: 2637, dur: 0.5, vol: 0.03, delay: 0.22 });
  }
  ding() {
    if (!this._ok('ding', 0.15)) return;
    this._tone({ freq: 1975, dur: 1.0, vol: 0.1, reverb: 0.4 });
    this._tone({ freq: 2960, dur: 0.6, vol: 0.05, reverb: 0.2 });
  }
  cookDone() {
    if (!this._ok('cookDone', 0.1)) return;
    this._tone({ type: 'triangle', freq: 1568, dur: 0.25, vol: 0.12 });
    this._tone({ type: 'triangle', freq: 2093, dur: 0.35, vol: 0.1, delay: 0.08 });
  }
  warn() {
    if (!this._ok('warn', 0.2)) return;
    this._tone({ type: 'square', freq: 1046, dur: 0.07, vol: 0.05, filter: 3000 });
  }
  error() {
    if (!this._ok('error', 0.2)) return;
    this._tone({ type: 'square', freq: 155, dur: 0.12, vol: 0.12, filter: 1100 });
    this._tone({ type: 'square', freq: 147, dur: 0.16, vol: 0.12, filter: 1100, delay: 0.15 });
  }
  click() {
    if (!this._ok('click', 0.02)) return;
    this._tone({ freq: 1400, freqEnd: 700, dur: 0.04, vol: 0.12 });
  }
  hover() {
    if (!this._ok('hover', 0.05)) return;
    this._tone({ freq: 2400, dur: 0.02, vol: 0.025 });
  }
  swoosh() {
    if (!this._ok('swoosh', 0.1)) return;
    this._noise({ dur: 0.24, vol: 0.22, type: 'bandpass', freq: 500, freqEnd: 3200, q: 1.2 });
  }
  pickup() {
    if (!this._ok('pickup', 0.04)) return;
    this._tone({ freq: 480, freqEnd: 820, dur: 0.08, vol: 0.14 });
  }
  drop() {
    if (!this._ok('drop', 0.04)) return;
    this._tone({ freq: 620, freqEnd: 330, dur: 0.09, vol: 0.13 });
    this._noise({ dur: 0.04, vol: 0.08, type: 'lowpass', freq: 900 });
  }
  thud() {
    if (!this._ok('thud', 0.05)) return;
    this._tone({ freq: 140, freqEnd: 50, dur: 0.18, vol: 0.35 });
    this._noise({ dur: 0.12, vol: 0.16, type: 'lowpass', freq: 500 });
  }
  trash() {
    if (!this._ok('trash', 0.08)) return;
    this._noise({ dur: 0.18, vol: 0.2, type: 'lowpass', freq: 800, freqEnd: 200 });
    this._tone({ type: 'triangle', freq: 300, freqEnd: 120, dur: 0.14, vol: 0.14 });
  }
  wash() {
    if (!this._ok('wash', 0.12)) return;
    this._noise({ dur: 0.22, vol: 0.12, type: 'bandpass', freq: 700 + Math.random() * 500, freqEnd: 1800, q: 2 });
  }
  splash() {
    if (!this._ok('splash', 0.15)) return;
    this._noise({ dur: 0.35, vol: 0.18, type: 'bandpass', freq: 1500, freqEnd: 500, q: 0.8 });
    this.clink();
  }
  munch() {
    if (!this._ok('munch', 0.18)) return;
    this._noise({ dur: 0.07, vol: 0.06, type: 'bandpass', freq: 900 + Math.random() * 400, q: 3 });
  }
  complete() {
    if (!this._ok('complete', 0.1)) return;
    [72, 76, 79, 84].forEach((n, i) => this._tone({ type: 'triangle', freq: midi(n), dur: 0.3, vol: 0.12, delay: i * 0.06, reverb: 0.2 }));
  }
  fail() {
    if (!this._ok('fail', 0.2)) return;
    this._tone({ type: 'sawtooth', freq: 330, freqEnd: 196, dur: 0.6, vol: 0.09, filter: 1200, vibrato: 6 });
  }
  angry() {
    if (!this._ok('angry', 0.25)) return;
    this._tone({ type: 'sawtooth', freq: 120, freqEnd: 90, dur: 0.35, vol: 0.09, filter: 700, vibrato: 12 });
  }
  honk(angry = false) {
    if (!this._ok('honk', 0.4)) return;
    const n = angry ? 2 : 1;
    for (let i = 0; i < n; i++) {
      this._tone({ type: 'square', freq: 392, dur: 0.22, vol: 0.06, filter: 1400, delay: i * 0.3 });
      this._tone({ type: 'square', freq: 494, dur: 0.22, vol: 0.05, filter: 1400, delay: i * 0.3 });
    }
  }
  happy() {
    if (!this._ok('happy', 0.15)) return;
    this._tone({ freq: 880, freqEnd: 1320, dur: 0.1, vol: 0.08 });
    this._tone({ freq: 1100, freqEnd: 1760, dur: 0.12, vol: 0.08, delay: 0.1 });
  }
  fanfare() {
    if (!this._ok('fanfare', 0.5)) return;
    [60, 64, 67, 72].forEach((n, i) => this._tone({ type: 'square', freq: midi(n), dur: 0.18, vol: 0.06, delay: i * 0.1, filter: 2500 }));
    [72, 76, 79].forEach((n) => this._tone({ type: 'triangle', freq: midi(n), dur: 1.1, vol: 0.08, delay: 0.42, reverb: 0.5 }));
  }
  ignite() {
    if (!this._ok('ignite', 0.3)) return;
    this._noise({ dur: 0.6, vol: 0.35, type: 'lowpass', freq: 200, freqEnd: 2500, q: 0.8 });
    this._tone({ freq: 90, freqEnd: 40, dur: 0.5, vol: 0.3 });
  }
  extinguish() {
    if (!this._ok('extinguish', 0.3)) return;
    this._noise({ dur: 0.7, vol: 0.2, type: 'highpass', freq: 4000, freqEnd: 1500, q: 0.5 });
  }
  countdown(final = false) {
    if (!this.ctx) return;
    if (final) {
      [72, 76, 79, 84].forEach((n) => this._tone({ type: 'triangle', freq: midi(n), dur: 0.7, vol: 0.09, reverb: 0.4 }));
    } else {
      this._tone({ type: 'triangle', freq: 660, dur: 0.18, vol: 0.12 });
    }
  }
  place() {
    if (!this._ok('place', 0.05)) return;
    this.thud();
    this._tone({ freq: 660, freqEnd: 990, dur: 0.08, vol: 0.06, delay: 0.05 });
  }
  sell() {
    if (!this._ok('sell', 0.1)) return;
    [88, 84, 79].forEach((n, i) => this._tone({ type: 'square', freq: midi(n), dur: 0.08, vol: 0.04, delay: i * 0.05, filter: 4000 }));
  }
  critic() {
    if (!this._ok('critic', 1)) return;
    [62, 66, 69, 73, 76].forEach((n, i) => this._tone({ type: 'triangle', freq: midi(n), dur: 1.2, vol: 0.07, delay: i * 0.09, reverb: 0.6 }));
  }
  levelUp() {
    if (!this._ok('levelUp', 0.5)) return;
    [67, 72, 76, 79, 84].forEach((n, i) => this._tone({ type: 'triangle', freq: midi(n), dur: 0.5, vol: 0.09, delay: i * 0.07, reverb: 0.4 }));
  }
  doorClose() {
    if (!this._ok('door', 0.5)) return;
    this._tone({ type: 'triangle', freq: 784, dur: 0.6, vol: 0.1, reverb: 0.5 });
    this._tone({ type: 'triangle', freq: 523, dur: 1.0, vol: 0.1, delay: 0.25, reverb: 0.5 });
  }

  // ---------------------------------------------------------------- music
  startMusic(mode) {
    if (!this.ctx) return;
    if (this.song === SONGS[mode]) return;
    this.song = SONGS[mode];
    this.musicStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.12;
    this._newMotif();
  }

  stopMusic() { this.song = null; }

  _newMotif() {
    const song = this.song;
    this.motif = [];
    for (let bar = 0; bar < 4; bar++) {
      const steps = [];
      for (let s = 0; s < 16; s++) {
        const strong = s % 4 === 0 || s === 6 || s === 10 || s === 14;
        if (Math.random() < (strong ? song.melodyProb : song.melodyProb * 0.25)) {
          steps.push({ s, i: Math.floor(Math.random() * song.chords[bar].scale.length), len: Math.random() < 0.3 ? 2 : 1 });
        }
      }
      this.motif.push(steps);
    }
  }

  _scheduleMusic() {
    const song = this.song;
    if (!song) return;
    const ctx = this.ctx;
    const sixteenth = 60 / song.bpm / 4;
    while (this.nextNoteTime < ctx.currentTime + 0.2) {
      const step = this.musicStep % 16;
      const bar = Math.floor(this.musicStep / 16) % 4;
      let t = this.nextNoteTime;
      if (step % 2 === 1) t += sixteenth * (song.swing - 0.5) * 2;
      this._playStep(song, bar, step, t, sixteenth);
      this.musicStep++;
      if (this.musicStep % (16 * 8) === 0) this._newMotif();
      this.nextNoteTime += sixteenth;
    }
  }

  _playStep(song, bar, step, t, sx) {
    const ch = song.chords[bar];
    const dest = this.musicBus;
    const delay = Math.max(0, t - this.ctx.currentTime);
    // Bass
    const bassPattern = song.drums === 'lofi' ? { 0: 0, 10: 7 } : { 0: 0, 3: 0, 8: 7, 11: 12, 14: -1 };
    if (step in bassPattern) {
      let n = ch.bass + bassPattern[step];
      if (bassPattern[step] === -1) n = song.chords[(bar + 1) % 4].bass - 1;
      this._tone({ type: 'triangle', freq: midi(n), dur: song.drums === 'lofi' ? 0.9 : 0.32, vol: 0.2, delay, dest, filter: 700 });
      this._tone({ type: 'sine', freq: midi(n - 12), dur: 0.3, vol: 0.12, delay, dest });
    }
    // Electric piano comping (FM)
    const comp = song.drums === 'lofi' ? [0, 9] : [0, 6, 10];
    if (comp.includes(step)) {
      const long = step === 0;
      for (const n of ch.notes) this._ep(midi(n), long ? (song.drums === 'lofi' ? 2.4 : 1.1) : 0.35, long ? 0.045 : 0.03, delay);
    }
    // Melody (marimba)
    for (const m of this.motif[bar]) {
      if (m.s === step) {
        const f = midi(ch.scale[m.i] + 12);
        this._tone({ freq: f, dur: 0.35 * m.len, vol: 0.06, delay, dest, reverb: 0.15 });
        this._tone({ freq: f * 4, dur: 0.06, vol: 0.012, delay, dest });
      }
    }
    // Drums
    if (song.drums === 'full') {
      if (step === 0 || step === 8 || (step === 10 && bar % 2 === 1)) this._kick(delay, 0.4);
      if (step === 4 || step === 12) this._snare(delay, 0.1);
      if (step % 2 === 0) this._hat(delay, step === 14 ? 0.12 : 0.03, step === 14 ? 0.035 : 0.025);
    } else if (song.drums === 'lofi') {
      if (step === 0 || step === 10) this._kick(delay, 0.28);
      if (step === 8) this._snare(delay, 0.07);
      if (step % 2 === 0) this._hat(delay, 0.025, 0.012);
    }
  }

  _ep(freq, dur, vol, delay) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const mg = ctx.createGain();
    const g = ctx.createGain();
    car.frequency.value = freq;
    mod.frequency.value = freq * 1.0;
    mg.gain.setValueAtTime(freq * 1.6, t0);
    mg.gain.exponentialRampToValueAtTime(freq * 0.05, t0 + Math.min(dur, 0.6));
    mod.connect(mg);
    mg.connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2600;
    car.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    const rg = ctx.createGain();
    rg.gain.value = 0.25;
    g.connect(rg);
    rg.connect(this.reverb);
    car.start(t0); mod.start(t0);
    car.stop(t0 + dur + 0.05); mod.stop(t0 + dur + 0.05);
  }

  _kick(delay, vol) {
    this._tone({ freq: 150, freqEnd: 42, dur: 0.22, vol, delay, dest: this.musicBus });
  }
  _snare(delay, vol) {
    this._noise({ dur: 0.12, vol, type: 'bandpass', freq: 1900, q: 0.9, delay, dest: this.musicBus });
    this._tone({ type: 'triangle', freq: 330, freqEnd: 200, dur: 0.06, vol: vol * 0.6, delay, dest: this.musicBus });
  }
  _hat(delay, dur, vol) {
    this._noise({ dur, vol, type: 'highpass', freq: 7500, q: 0.5, delay, dest: this.musicBus });
  }

  update() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    this._updateLoops();
    this._scheduleMusic();
  }

  silenceLoops() {
    for (const k in this.loopLevels) this.loopLevels[k] = 0;
    this.alarmOn = false;
  }
}
