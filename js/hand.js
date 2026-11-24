// Entrada de mano: MediaPipe Hand Landmarker (cámara) o mouse como respaldo.
// Entrega un estado simple: { present, x, y, open, fist } con x,y entre 0 y 1 (pantalla).

const TASKS_VERSION = '0.10.14';
const TASKS_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// Conexiones de la mano para dibujar el esqueleto en la vista de cámara
const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
// [punta, articulación media] de índice, medio, anular y meñique
const FINGERS = [[8, 6], [12, 10], [16, 14], [20, 18]];

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class HandInput {
  constructor(video, overlay, statusEl) {
    this.video = video;
    this.overlay = overlay;
    this.ctx = overlay.getContext('2d');
    this.statusEl = statusEl;
    this.mode = 'none';
    this.landmarker = null;
    this.lastVideoTime = -1;
    this.lastSeen = 0;
    this.state = { present: false, x: 0.5, y: 0.5, open: false, fist: false };
  }

  setStatus(text) {
    if (this.statusEl) this.statusEl.textContent = text;
  }

  async startCamera() {
    this.setStatus('Abriendo cámara…');
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false,
    });
    this.video.srcObject = stream;
    await this.video.play();

    this.setStatus('Cargando MediaPipe…');
    const { FilesetResolver, HandLandmarker } = await import(`${TASKS_URL}/vision_bundle.mjs`);
    const fileset = await FilesetResolver.forVisionTasks(`${TASKS_URL}/wasm`);
    const options = (delegate) => ({
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });
    try {
      this.landmarker = await HandLandmarker.createFromOptions(fileset, options('GPU'));
    } catch (e) {
      console.warn('GPU no disponible, usando CPU', e);
      this.landmarker = await HandLandmarker.createFromOptions(fileset, options('CPU'));
    }
    this.overlay.width = this.video.videoWidth || 640;
    this.overlay.height = this.video.videoHeight || 480;
    this.mode = 'hand';
    this.setStatus('Mano: buscando…');
  }

  useMouse() {
    this.mode = 'mouse';
    const s = this.state;
    s.present = true;
    s.open = true;
    s.fist = false;
    const move = (e) => {
      s.x = e.clientX / innerWidth;
      s.y = e.clientY / innerHeight;
    };
    addEventListener('pointermove', move);
    addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      move(e);
      s.fist = true;
      s.open = false;
    });
    addEventListener('pointerup', () => {
      s.fist = false;
      s.open = true;
    });
    this.setStatus('Modo mouse: clic = puño');
  }

  update() {
    if (this.mode !== 'hand' || !this.landmarker) return this.state;
    const v = this.video;
    if (v.readyState < 2 || v.currentTime === this.lastVideoTime) return this.state;
    this.lastVideoTime = v.currentTime;

    const now = performance.now();
    const res = this.landmarker.detectForVideo(v, now);
    const lm = res.landmarks && res.landmarks[0];
    const s = this.state;

    this.ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);

    if (lm) {
      this.lastSeen = now;
      s.present = true;

      // Posición: centro de la palma (landmark 9), espejado y ampliado para llegar a los bordes
      const tx = clamp01((1 - lm[9].x - 0.15) / 0.7);
      const ty = clamp01((lm[9].y - 0.15) / 0.7);
      s.x += (tx - s.x) * 0.4;
      s.y += (ty - s.y) * 0.4;

      // Gesto: cuántos dedos están extendidos (punta más lejos de la muñeca que la articulación)
      const wrist = lm[0];
      let extended = 0;
      for (const [tip, pip] of FINGERS) {
        if (dist(lm[tip], wrist) > dist(lm[pip], wrist) * 1.1) extended++;
      }
      if (extended >= 3) { s.open = true; s.fist = false; }
      else if (extended <= 1) { s.open = false; s.fist = true; }
      // con 2 dedos se mantiene el gesto anterior (evita parpadeos)

      this.drawHand(lm, s.fist);
      this.setStatus(s.fist ? 'Mano: puño ✊' : s.open ? 'Mano: abierta ✋' : 'Mano detectada');
    } else if (now - this.lastSeen > 300) {
      s.present = false;
      this.setStatus('Mano: buscando…');
    }
    return s;
  }

  drawHand(lm, fist) {
    const { ctx } = this;
    const w = this.overlay.width;
    const h = this.overlay.height;
    ctx.lineWidth = 3;
    ctx.strokeStyle = fist ? '#3d8fd1' : '#ffffff';
    ctx.beginPath();
    for (const [a, b] of CONNECTIONS) {
      ctx.moveTo(lm[a].x * w, lm[a].y * h);
      ctx.lineTo(lm[b].x * w, lm[b].y * h);
    }
    ctx.stroke();
    ctx.fillStyle = '#b5562e';
    for (const p of lm) {
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
