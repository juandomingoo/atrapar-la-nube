// Sonido generado con Web Audio (sin archivos externos):
// viento continuo, gotas al llegar al estanque, soplido al tender la malla y acorde final.

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.lastDrip = 0;
  }

  start() {
    if (this.ctx) return;
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);

    // Ruido blanco reutilizable
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // Viento: ruido filtrado con un filtro que "respira" lentamente
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 450;
    filter.Q.value = 0.8;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain).connect(filter.frequency);
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.0;
    src.connect(filter).connect(this.windGain).connect(this.master);
    src.start();
    lfo.start();
    this.setWind(0.12);
  }

  setWind(v) {
    if (!this.ctx) return;
    this.windGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.8);
  }

  drip() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastDrip < 0.07) return;
    this.lastDrip = now;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(700 + Math.random() * 600, now);
    o.frequency.exponentialRampToValueAtTime(250, now + 0.12);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    o.connect(g).connect(this.master);
    o.start(now);
    o.stop(now + 0.2);
  }

  whoosh() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.5;
    f.frequency.setValueAtTime(300, now);
    f.frequency.exponentialRampToValueAtTime(2200, now + 0.7);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.25, now + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    src.connect(f).connect(g).connect(this.master);
    src.start(now);
    src.stop(now + 1);
  }

  // Acorde suave + campanitas cuando florece el desierto
  bloom() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.0, 493.88];
    for (const n of notes) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = n;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.04, now + 2.5);
      g.gain.setValueAtTime(0.04, now + 7);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 11);
      o.connect(g).connect(this.master);
      o.start(now);
      o.stop(now + 11.2);
    }
    const chimes = [784, 988, 1175, 1319, 1568, 1319, 1175, 988];
    chimes.forEach((n, i) => {
      const t = now + 0.6 + i * 0.45;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = n;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 1.3);
    });
    this.setWind(0.05);
  }

  toggleMute() {
    if (!this.ctx) return;
    this.muted = !this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }
}
