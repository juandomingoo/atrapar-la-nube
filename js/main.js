// Atrapar la nube — escena principal (Three.js) y lógica de la experiencia.
import * as THREE from 'three';
import { HandInput } from './hand.js';
import { Sound } from './audio.js';

// ---------------------------------------------------------------------------
// Parámetros
// ---------------------------------------------------------------------------
const NET_W = 10;          // ancho de la malla
const NET_H = 6;           // alto de la malla
const NET_BASE = 1.2;      // altura del borde inferior de la malla sobre el suelo
const MAX_DROPS = 180;     // gotas que caben en la malla antes de vaciarla
const TANK_CAP = 300;      // gotas para llenar el estanque
const FOG_COUNT = 2000;    // partículas de niebla
const CAPTURE_P = 0.8;     // probabilidad de que una gota que cruza la malla quede atrapada
const BLOOM_TIME = 9;      // segundos que tarda el desierto en florecer
const WIND_SHIFT = 1.0;    // giro del viento (radianes) cuando el estanque llega a la mitad

// ---------------------------------------------------------------------------
// Render, cámara, cielo
// ---------------------------------------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const HORIZON = new THREE.Color('#e6ddcd');
scene.fog = new THREE.Fog(HORIZON, 45, 170);

const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 600);
const CAM_START = new THREE.Vector3(30, 24, 27);
const LOOK_START = new THREE.Vector3(-3, 15, -2);
const camPos = CAM_START.clone();
const camLook = LOOK_START.clone();
const camPosTarget = camPos.clone();
const camLookTarget = camLook.clone();
camera.position.copy(camPos);

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(400, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color('#86aac2') },
      bottom: { value: HORIZON.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 bottom;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos - cameraPosition).y;
        gl_FragColor = vec4(mix(bottom, top, smoothstep(0.0, 0.45, h)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
);
scene.add(sky);

scene.add(new THREE.HemisphereLight('#fdf3e1', '#8a6f52', 1.2));
const sun = new THREE.DirectionalLight('#fff1d6', 2.2);
sun.position.set(30, 50, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 150 });
scene.add(sun);

// ---------------------------------------------------------------------------
// Terreno: costa, cerro y desierto
// ---------------------------------------------------------------------------
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

function heightAt(x, z) {
  const coast = smooth(-38, -22, x);                       // 0 = mar, 1 = tierra
  const hill = 12 * Math.exp(-(x * x / (2 * 9 * 9) + z * z / (2 * 14 * 14)));
  const ridge = 3 * Math.exp(-(z * z) / (2 * 30 * 30));
  const noise = Math.sin(x * 0.35) * Math.cos(z * 0.27) * 0.6 + Math.sin(x * 0.11 + z * 0.17) * 1.2;
  return -4 + coast * (7 + noise + ridge) + hill;
}

const terrainGeo = new THREE.PlaneGeometry(240, 180, 200, 150);
terrainGeo.rotateX(-Math.PI / 2);
terrainGeo.translate(30, 0, -20);
const tPos = terrainGeo.attributes.position;
const sandColors = new Float32Array(tPos.count * 3);
const greenColors = new Float32Array(tPos.count * 3);
const vertexDist = new Float32Array(tPos.count);
const SAND = [new THREE.Color('#d2b48a'), new THREE.Color('#b98f62'), new THREE.Color('#a87a52')];
const GREEN = [new THREE.Color('#7fa356'), new THREE.Color('#5d8a45'), new THREE.Color('#9db463')];
const tmpC = new THREE.Color();

const NET_POS = new THREE.Vector3(0, heightAt(0, 0) - 0.15, 0);
const TANK_POS = new THREE.Vector3(7, 0, -5);
TANK_POS.y = heightAt(TANK_POS.x, TANK_POS.z) - 0.2;

for (let i = 0; i < tPos.count; i++) {
  const x = tPos.getX(i);
  const z = tPos.getZ(i);
  const y = heightAt(x, z);
  tPos.setY(i, y);
  const r = Math.random();
  tmpC.copy(SAND[r < 0.6 ? 0 : r < 0.9 ? 1 : 2]);
  if (y < 0.4) tmpC.lerp(new THREE.Color('#e3cfa8'), 0.6); // playa
  tmpC.toArray(sandColors, i * 3);
  tmpC.copy(GREEN[Math.floor(Math.random() * 3)]);
  if (y < 0.4) tmpC.copy(new THREE.Color('#e3cfa8'));
  tmpC.toArray(greenColors, i * 3);
  vertexDist[i] = Math.hypot(x - TANK_POS.x, z - TANK_POS.z);
}
terrainGeo.setAttribute('color', new THREE.BufferAttribute(sandColors.slice(), 3));
terrainGeo.computeVertexNormals();
const terrain = new THREE.Mesh(
  terrainGeo,
  new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 })
);
terrain.receiveShadow = true;
scene.add(terrain);

const ocean = new THREE.Mesh(
  new THREE.PlaneGeometry(700, 700),
  new THREE.MeshStandardMaterial({ color: '#4f7f96', roughness: 0.35, metalness: 0.1 })
);
ocean.rotation.x = -Math.PI / 2;
ocean.position.y = 0;
scene.add(ocean);

// ---------------------------------------------------------------------------
// Atrapanieblas: postes, malla, canaleta, tubo y estanque
// ---------------------------------------------------------------------------
const netGroup = new THREE.Group();
netGroup.position.copy(NET_POS);
scene.add(netGroup);

const woodMat = new THREE.MeshStandardMaterial({ color: '#5b4636', roughness: 0.9 });
for (const side of [-1, 1]) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, NET_BASE + NET_H + 0.6, 8), woodMat);
  post.position.set(side * NET_W / 2, (NET_BASE + NET_H + 0.6) / 2, 0);
  post.castShadow = true;
  netGroup.add(post);
}

const meshPivot = new THREE.Group();
meshPivot.position.y = NET_BASE;
meshPivot.scale.y = 0.001;
netGroup.add(meshPivot);

const netPlaneGeo = new THREE.PlaneGeometry(NET_W, NET_H);
netPlaneGeo.translate(0, NET_H / 2, 0);
const netPlane = new THREE.Mesh(
  netPlaneGeo,
  new THREE.MeshStandardMaterial({
    color: '#22302a', transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false,
  })
);
netPlane.castShadow = true;
meshPivot.add(netPlane);

const gridPts = [];
const STEP = 0.4;
for (let x = -NET_W / 2; x <= NET_W / 2 + 1e-6; x += STEP) gridPts.push(x, 0, 0, x, NET_H, 0);
for (let y = 0; y <= NET_H + 1e-6; y += STEP) gridPts.push(-NET_W / 2, y, 0, NET_W / 2, y, 0);
const gridGeo = new THREE.BufferGeometry();
gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3));
meshPivot.add(new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: '#1a2420', transparent: true, opacity: 0.7 })));

const gutter = new THREE.Mesh(
  new THREE.BoxGeometry(NET_W, 0.22, 0.45),
  new THREE.MeshStandardMaterial({ color: '#9aa3a8', metalness: 0.4, roughness: 0.5 })
);
gutter.position.y = NET_BASE - 0.12;
gutter.castShadow = true;
netGroup.add(gutter);

// Estanque
const TANK_R = 1.7;
const TANK_H = 3.2;
const tankGroup = new THREE.Group();
tankGroup.position.copy(TANK_POS);
scene.add(tankGroup);
const tankShell = new THREE.Mesh(
  new THREE.CylinderGeometry(TANK_R, TANK_R, TANK_H, 32, 1, true),
  new THREE.MeshStandardMaterial({
    color: '#e8eef0', transparent: true, opacity: 0.35, side: THREE.DoubleSide, roughness: 0.2, depthWrite: false,
  })
);
tankShell.position.y = TANK_H / 2;
tankGroup.add(tankShell);
const tankRim = new THREE.Mesh(
  new THREE.TorusGeometry(TANK_R, 0.07, 8, 40),
  new THREE.MeshStandardMaterial({ color: '#7f8a90', metalness: 0.5, roughness: 0.4 })
);
tankRim.rotation.x = Math.PI / 2;
tankRim.position.y = TANK_H;
tankGroup.add(tankRim);
const tankBase = tankRim.clone();
tankBase.position.y = 0.05;
tankGroup.add(tankBase);
const waterGeo = new THREE.CylinderGeometry(TANK_R - 0.08, TANK_R - 0.08, 1, 32);
waterGeo.translate(0, 0.5, 0);
const water = new THREE.Mesh(
  waterGeo,
  new THREE.MeshStandardMaterial({ color: '#3d8fd1', roughness: 0.15, transparent: true, opacity: 0.85 })
);
water.scale.y = 0.001;
water.position.y = 0.08;
tankGroup.add(water);

// Tubo desde la canaleta (centro de la malla, que gira sobre sí misma) hasta el estanque
const pipeStart = NET_POS.clone().add(new THREE.Vector3(0, NET_BASE - 0.2, 0));
const pipeEnd = TANK_POS.clone().add(new THREE.Vector3(0, TANK_H + 0.4, 0));
const pipeMid = pipeStart.clone().lerp(pipeEnd, 0.5);
pipeMid.y = Math.max(heightAt(pipeMid.x, pipeMid.z) + 0.4, (pipeStart.y + pipeEnd.y) / 2 - 1);
const pipeCurve = new THREE.CatmullRomCurve3([
  pipeStart,
  pipeStart.clone().add(new THREE.Vector3(0, -0.6, 0.3)),
  pipeMid,
  pipeEnd.clone().add(new THREE.Vector3(0, 0.6, 0)),
  pipeEnd,
]);
const pipe = new THREE.Mesh(
  new THREE.TubeGeometry(pipeCurve, 60, 0.14, 8),
  new THREE.MeshStandardMaterial({ color: '#cfd8dc', transparent: true, opacity: 0.45, roughness: 0.3, depthWrite: false })
);
scene.add(pipe);

// ---------------------------------------------------------------------------
// Partículas: niebla, gotas en la malla, agua bajando por el tubo
// ---------------------------------------------------------------------------
function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const DOT = softDot();

const FOG_X0 = -80;
const FOG_X1 = 22;
const FOG_Y0 = NET_POS.y + NET_BASE - 1.5;
const FOG_Y1 = NET_POS.y + NET_BASE + NET_H + 2.5;
const FOG_Z = 18;
const fogPos = new Float32Array(FOG_COUNT * 3);
const fogSpeed = new Float32Array(FOG_COUNT);
const fogSide = new Int8Array(FOG_COUNT);
const fogPhase = new Float32Array(FOG_COUNT);

function spawnFog(i, anywhere) {
  fogPos[i * 3] = anywhere ? FOG_X0 + Math.random() * (FOG_X1 - FOG_X0) : FOG_X0 - Math.random() * 10;
  fogPos[i * 3 + 1] = FOG_Y0 + Math.pow(Math.random(), 1.3) * (FOG_Y1 - FOG_Y0);
  fogPos[i * 3 + 2] = (Math.random() * 2 - 1) * FOG_Z;
  fogSpeed[i] = 5 + Math.random() * 2.5;
  fogPhase[i] = Math.random() * Math.PI * 2;
  fogSide[i] = 0;
}
for (let i = 0; i < FOG_COUNT; i++) spawnFog(i, true);

// fogPos está en el marco del viento (u = dirección del viento); fogWorld es lo que se dibuja
const fogWorld = new Float32Array(FOG_COUNT * 3);
const fogGeo = new THREE.BufferGeometry();
fogGeo.setAttribute('position', new THREE.BufferAttribute(fogWorld, 3));
const fogMat = new THREE.PointsMaterial({
  map: DOT, size: 3.2, color: '#ffffff', transparent: true, opacity: 0.42, depthWrite: false,
});
const fog = new THREE.Points(fogGeo, fogMat);
fog.frustumCulled = false;
scene.add(fog);

// Gotas atrapadas: coordenadas locales de la malla (no se escalan con el despliegue)
const dropLocal = new Float32Array(MAX_DROPS * 3);
const dropVy = new Float32Array(MAX_DROPS);
let dropCount = 0;
const dropGeo = new THREE.BufferGeometry();
dropGeo.setAttribute('position', new THREE.BufferAttribute(dropLocal, 3));
dropGeo.setDrawRange(0, 0);
const drops = new THREE.Points(
  dropGeo,
  new THREE.PointsMaterial({ map: DOT, size: 0.8, color: '#d6f1ff', transparent: true, depthWrite: false })
);
drops.frustumCulled = false;
netGroup.add(drops);

// Agua en el tubo
const STREAM_MAX = 120;
const streamT = new Float32Array(STREAM_MAX).fill(-1);
const streamPos = new Float32Array(STREAM_MAX * 3);
const streamGeo = new THREE.BufferGeometry();
streamGeo.setAttribute('position', new THREE.BufferAttribute(streamPos, 3));
const stream = new THREE.Points(
  streamGeo,
  new THREE.PointsMaterial({ map: DOT, size: 0.5, color: '#4fa3e6', transparent: true, depthWrite: false })
);
stream.frustumCulled = false;
scene.add(stream);
let streamQueue = 0;

// ---------------------------------------------------------------------------
// Vegetación para el final (desierto florido)
// ---------------------------------------------------------------------------
function makePlants(geo, colors, count, minR, maxR, yOffset, scaleRange) {
  const mat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.8 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.castShadow = true;
  const items = [];
  const c = new THREE.Color();
  let n = 0;
  let guard = 0;
  while (n < count && guard++ < count * 40) {
    const a = Math.random() * Math.PI * 2;
    const r = minR + Math.pow(Math.random(), 0.7) * (maxR - minR);
    const x = TANK_POS.x + Math.cos(a) * r;
    const z = TANK_POS.z + Math.sin(a) * r;
    const y = heightAt(x, z);
    if (y < 0.8) continue;                                   // nada en el mar ni la playa
    if (Math.hypot(x - TANK_POS.x, z - TANK_POS.z) < TANK_R + 0.6) continue;
    items.push({
      pos: new THREE.Vector3(x, y + yOffset, z),
      dist: Math.hypot(x - TANK_POS.x, z - TANK_POS.z),
      size: scaleRange[0] + Math.random() * (scaleRange[1] - scaleRange[0]),
      rot: Math.random() * Math.PI,
    });
    mesh.setColorAt(n, c.set(colors[Math.floor(Math.random() * colors.length)]));
    n++;
  }
  mesh.count = n;
  mesh.userData.items = items;
  scene.add(mesh);
  return mesh;
}
const shrubs = makePlants(new THREE.IcosahedronGeometry(0.7, 0), ['#4f7d3a', '#6a9a48', '#3f6b33'], 320, 2, 60, 0.15, [0.6, 1.5]);
const flowers = makePlants(new THREE.IcosahedronGeometry(0.22, 0), ['#d9539a', '#b35bc9', '#f2c94c', '#f28c6a', '#ffffff'], 900, 2, 60, 0.18, [0.7, 1.4]);

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function updatePlants(mesh, radius) {
  const items = mesh.userData.items;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const k = smooth(it.dist, it.dist + 6, radius);          // 0 → 1 cuando pasa el frente verde
    tmpQ.setFromAxisAngle(UP, it.rot);
    tmpS.setScalar(Math.max(0.0001, k * it.size));
    tmpM.compose(it.pos, tmpQ, tmpS);
    mesh.setMatrixAt(i, tmpM);
  }
  mesh.instanceMatrix.needsUpdate = true;
}
updatePlants(shrubs, -10);
updatePlants(flowers, -10);

function updateGround(radius) {
  const col = terrainGeo.attributes.color;
  for (let i = 0; i < tPos.count; i++) {
    const k = smooth(vertexDist[i], vertexDist[i] + 8, radius) * 0.85;
    const j = i * 3;
    col.array[j] = sandColors[j] + (greenColors[j] - sandColors[j]) * k;
    col.array[j + 1] = sandColors[j + 1] + (greenColors[j + 1] - sandColors[j + 1]) * k;
    col.array[j + 2] = sandColors[j + 2] + (greenColors[j + 2] - sandColors[j + 2]) * k;
  }
  col.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// Interfaz
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const ui = {
  hud: $('hud'), cursor: $('cursor'), hint: $('hint'), step: $('stepLabel'), text: $('storyText'),
  story: $('story'), eff: $('effBar'), net: $('netBar'), tank: $('tankBar'), tankPct: $('tankPct'),
  intro: $('intro'), finale: $('finale'), camBox: $('camBox'), introError: $('introError'), wind: $('wind'),
};

const STORY = {
  mostrar: ['1 · La camanchaca',
    'Cada mañana, una niebla espesa llega desde el Pacífico y cubre los cerros del norte de Chile. Sus gotas son tan livianas que nunca caen como lluvia.',
    '✋ Muestra tu mano abierta para tender la malla'],
  orientar: ['2 · La idea de Espinosa',
    'En 1956, en plena sequía en Antofagasta, el físico Carlos Espinosa Arancibia pensó: si la niebla no cae, hay que salir a atraparla.',
    '↔️ Mueve la mano hasta poner la malla de frente al viento'],
  recoger: ['2 · La idea de Espinosa',
    'Su primer prototipo usaba finos hilos de perlón: las gotas chocan con los hilos, se juntan y escurren hacia un estanque.',
    '✊ Cierra el puño para llevar el agua al estanque'],
  llena: ['2 · La idea de Espinosa',
    'La malla está cargada de agua. Cuando las gotas pesan lo suficiente, bajan por la canaleta.',
    '✊ ¡Malla llena! Cierra el puño para vaciarla'],
  mitad: ['3 · Agua del aire',
    'Un atrapanieblas no necesita bombas ni electricidad: solo viento, niebla y una malla en el lugar correcto.',
    '↔️ Sigue atrapando niebla · ✊ puño para vaciar'],
  viento: ['3 · El viento cambia',
    'La camanchaca no siempre llega por el mismo lado. Por eso, antes de instalar un atrapanieblas, se estudia por dónde sopla el viento en cada cerro.',
    '🌬️ ¡Cambió el viento! Vuelve a orientar la malla'],
  florecer: ['4 · El desierto florece',
    'Con agua, el cerro vuelve a la vida. Hoy hay atrapanieblas que entregan agua a comunidades, riegan huertos y hasta se usan para hacer cerveza en Chile.',
    ''],
};

let storyKey = '';
function setStory(key) {
  if (storyKey === key) return;
  storyKey = key;
  const [step, text, hint] = STORY[key];
  ui.step.textContent = step;
  ui.text.textContent = text;
  ui.hint.textContent = hint;
  ui.hint.classList.toggle('pulse', key === 'llena' || key === 'recoger' || key === 'viento');
}

// ---------------------------------------------------------------------------
// Estado de la experiencia
// ---------------------------------------------------------------------------
const S = {
  phase: 'intro',     // intro → mostrar → orientar → florecer → fin
  deploy: 0,
  rotY: 0,
  eff: 0,
  tank: 0,
  captured: 0,
  openTime: 0,
  bloomT: 0,
  finTimer: 0,
  wind: 0,            // dirección actual del viento (radianes)
  windTarget: 0,
  windShifted: false,
  windLock: 0,        // segundos que se mantiene el mensaje del cambio de viento
  aligned: 0,
};

const input = new HandInput($('video'), $('camOverlay'), $('camStatus'));
const sound = new Sound();

function begin() {
  ui.intro.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  ui.cursor.classList.remove('hidden');
  S.phase = 'mostrar';
  setStory('mostrar');
}

$('btnCam').addEventListener('click', async () => {
  sound.start();
  $('btnCam').disabled = true;
  $('btnCam').textContent = 'Cargando…';
  ui.introError.textContent = '';
  try {
    await input.startCamera();
    begin();
  } catch (err) {
    console.error(err);
    ui.introError.textContent =
      'No se pudo usar la cámara (' + (err.name || 'error') + '). Revisa los permisos o usa el mouse.';
    $('btnCam').disabled = false;
    $('btnCam').textContent = 'Reintentar cámara';
  }
});

$('btnMouse').addEventListener('click', () => {
  sound.start();
  input.useMouse();
  ui.camBox.classList.add('hidden');
  begin();
});

$('btnRestart').addEventListener('click', reset);

function reset() {
  S.phase = 'mostrar';
  S.deploy = 0;
  S.tank = 0;
  S.captured = 0;
  S.openTime = 0;
  S.bloomT = 0;
  S.finTimer = 0;
  S.wind = 0;
  S.windTarget = 0;
  S.windShifted = false;
  S.windLock = 0;
  S.aligned = 0;
  ui.wind.innerHTML = 'La niebla llega desde el mar <span>↘</span>';
  ui.wind.classList.remove('alert');
  dropCount = 0;
  streamQueue = 0;
  streamT.fill(-1);
  updateGround(-10);
  updatePlants(shrubs, -10);
  updatePlants(flowers, -10);
  camPosTarget.copy(CAM_START);
  camLookTarget.copy(LOOK_START);
  ui.finale.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  ui.cursor.classList.remove('hidden');
  ui.story.style.opacity = 1;
  storyKey = '';
  setStory('mostrar');
  sound.setWind(0.12);
}

// Atajos útiles para grabar el video y presentar
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'r') reset();
  if (k === 'm') sound.toggleMute();
  if (k === 'h') ui.camBox.classList.toggle('hidden');
  if (k === 'f' && S.phase === 'orientar') S.tank = TANK_CAP; // salto al final (ensayos)
});

// ---------------------------------------------------------------------------
// Bucle principal
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();

function updateFog(dt, t, capturing) {
  const c = Math.cos(S.rotY);
  const s = Math.sin(S.rotY);
  const gx = NET_POS.x;
  const gy = NET_POS.y;
  const gz = NET_POS.z;
  const top = NET_BASE + NET_H * S.deploy;
  const ca = Math.cos(S.wind);
  const sa = Math.sin(S.wind);

  for (let i = 0; i < FOG_COUNT; i++) {
    const j = i * 3;
    let x = fogPos[j] + fogSpeed[i] * dt;
    const y = fogPos[j + 1] + Math.sin(t * 0.8 + fogPhase[i]) * 0.01;
    let z = fogPos[j + 2] + Math.cos(t * 0.6 + fogPhase[i]) * 0.012;
    if (x > FOG_X1) { spawnFog(i, false); continue; }
    fogPos[j] = x; fogPos[j + 1] = y; fogPos[j + 2] = z;

    // Del marco del viento al mundo (el viento gira en torno a la malla)
    const wx = gx + x * ca - z * sa;
    const wz = gz + x * sa + z * ca;
    fogWorld[j] = wx; fogWorld[j + 1] = y; fogWorld[j + 2] = wz;

    // Coordenadas locales de la malla (que gira en torno al eje Y)
    const dx = wx - gx;
    const dz = wz - gz;
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    const ly = y - gy;
    const side = lz >= 0 ? 1 : -1;

    if (capturing && fogSide[i] !== 0 && side !== fogSide[i] &&
        Math.abs(lx) < NET_W / 2 && ly > NET_BASE && ly < top) {
      if (Math.random() < CAPTURE_P && dropCount < MAX_DROPS) {
        const d = dropCount++;
        dropLocal[d * 3] = lx;
        dropLocal[d * 3 + 1] = ly;
        dropLocal[d * 3 + 2] = 0.06;
        dropVy[d] = 0;
        S.captured++;
        spawnFog(i, false);
        continue;
      }
    }
    fogSide[i] = side;
  }
  fogGeo.attributes.position.needsUpdate = true;
}

function updateDrops(dt, draining) {
  let w = 0;
  for (let i = 0; i < dropCount; i++) {
    let y = dropLocal[i * 3 + 1];
    if (draining) {
      dropVy[i] = Math.min(dropVy[i] + 25 * dt, 9);
      y -= dropVy[i] * dt;
    } else {
      y -= 0.05 * dt;                                         // se deslizan muy lento
    }
    if (y <= NET_BASE) { streamQueue++; continue; }          // cae a la canaleta
    dropLocal[w * 3] = dropLocal[i * 3];
    dropLocal[w * 3 + 1] = y;
    dropLocal[w * 3 + 2] = dropLocal[i * 3 + 2];
    dropVy[w] = dropVy[i];
    w++;
  }
  dropCount = w;
  dropGeo.setDrawRange(0, dropCount);
  dropGeo.attributes.position.needsUpdate = true;
}

const tmpV = new THREE.Vector3();
function updateStream(dt) {
  for (let i = 0; i < STREAM_MAX; i++) {
    if (streamT[i] < 0 && streamQueue > 0) {
      streamT[i] = Math.random() * 0.03;
      streamQueue--;
    }
    if (streamT[i] < 0) {
      streamPos[i * 3 + 1] = -999;
      continue;
    }
    streamT[i] += dt * 0.9;
    if (streamT[i] >= 1) {
      streamT[i] = -1;
      S.tank = Math.min(TANK_CAP, S.tank + 1);
      sound.drip();
      streamPos[i * 3 + 1] = -999;
      continue;
    }
    pipeCurve.getPointAt(streamT[i], tmpV);
    streamPos[i * 3] = tmpV.x;
    streamPos[i * 3 + 1] = tmpV.y;
    streamPos[i * 3 + 2] = tmpV.z;
  }
  streamGeo.attributes.position.needsUpdate = true;
}

function updateHud(hand) {
  ui.eff.style.width = `${Math.round(S.eff * 100)}%`;
  ui.net.style.width = `${Math.round((dropCount / MAX_DROPS) * 100)}%`;
  const pct = Math.round((S.tank / TANK_CAP) * 100);
  ui.tank.style.width = `${pct}%`;
  ui.tankPct.textContent = `${pct}%`;

  ui.cursor.style.transform = `translate(${hand.x * innerWidth}px, ${hand.y * innerHeight}px)`;
  ui.cursor.classList.toggle('fist', hand.present && hand.fist);
  ui.cursor.classList.toggle('lost', !hand.present);
}

function tick() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  const t = clock.elapsedTime;
  const hand = input.update();
  const active = S.phase === 'orientar';

  // Fase 1: mostrar la mano abierta para tender la malla
  if (S.phase === 'mostrar') {
    if (hand.present && hand.open) S.openTime += dt; else S.openTime = 0;
    if (S.openTime > 0.5) {
      S.phase = 'orientar';
      setStory('orientar');
      sound.whoosh();
      sound.setWind(0.2);
    }
  }

  // Despliegue de la malla
  const deployTarget = S.phase === 'mostrar' || S.phase === 'intro' ? 0 : 1;
  S.deploy += (deployTarget - S.deploy) * Math.min(1, dt * 2.2);
  meshPivot.scale.y = Math.max(0.001, S.deploy);

  // Orientación: la posición horizontal de la mano gira la malla
  if (active && hand.present) {
    const target = (hand.x - 0.5) * Math.PI * 1.1;
    S.rotY += (target - S.rotY) * Math.min(1, dt * 5);
  }
  netGroup.rotation.y = S.rotY;
  S.wind += (S.windTarget - S.wind) * Math.min(1, dt * 0.8);
  // 1 = la normal de la malla apunta en la dirección del viento
  S.eff = Math.abs(Math.sin(S.rotY + S.wind)) * S.deploy;

  const draining = active && hand.present && hand.fist;
  updateFog(dt, t, active && S.deploy > 0.9);
  updateDrops(dt, draining);
  updateStream(dt);

  // Agua en el estanque
  const level = S.tank / TANK_CAP;
  water.scale.y += (Math.max(0.001, level * (TANK_H - 0.2)) - water.scale.y) * Math.min(1, dt * 4);

  // Relato según el avance
  // A mitad de camino el viento gira y hay que reorientar la malla
  if (active && level >= 0.5 && !S.windShifted) {
    S.windShifted = true;
    S.windTarget = WIND_SHIFT;
    S.windLock = 10;
    S.aligned = 0;
    setStory('viento');
    sound.whoosh();
    sound.setWind(0.3);
    ui.wind.innerHTML = '¡El viento cambió de dirección! <span>↓</span>';
    ui.wind.classList.add('alert');
  }
  if (S.windLock > 0) {
    S.windLock -= dt;
    S.aligned = S.eff > 0.85 && Math.abs(S.windTarget - S.wind) < 0.1 ? S.aligned + dt : 0;
    if (S.aligned > 1.2) S.windLock = 0;          // ya la reorientó: sigue el relato
    if (S.windLock <= 0) {
      ui.wind.innerHTML = 'La niebla llega desde el mar <span>↓</span>';
      ui.wind.classList.remove('alert');
      sound.setWind(0.2);
    }
  }

  if (active && S.windLock <= 0) {
    if (level >= 0.5) setStory(dropCount >= MAX_DROPS ? 'llena' : 'mitad');
    else if (dropCount >= MAX_DROPS) setStory('llena');
    else if (S.captured >= 25) setStory('recoger');
  }
  if (active) {
    if (S.tank >= TANK_CAP) {
      S.windLock = 0;
      ui.wind.classList.remove('alert');
      S.phase = 'florecer';
      S.bloomT = 0;
      setStory('florecer');
      sound.bloom();
      camPosTarget.set(58, 42, 55);
      camLookTarget.set(-2, 6, -4);
    }
  }

  // Final: el verde se expande desde el estanque
  if (S.phase === 'florecer' || S.phase === 'fin') {
    S.bloomT = Math.min(1, S.bloomT + dt / BLOOM_TIME);
    const radius = -8 + smooth(0, 1, S.bloomT) * 75;
    updateGround(radius);
    updatePlants(shrubs, radius);
    updatePlants(flowers, radius);
    if (S.phase === 'florecer' && S.bloomT >= 1) {
      S.phase = 'fin';
      S.finTimer = 0;
    }
  }
  if (S.phase === 'fin') {
    S.finTimer += dt;
    if (S.finTimer > 2 && ui.finale.classList.contains('hidden')) {
      ui.finale.classList.remove('hidden');
      ui.cursor.classList.add('hidden');
      ui.story.style.opacity = 0;
    }
  }

  // Cámara con un leve vaivén
  camPos.lerp(camPosTarget, Math.min(1, dt * 0.6));
  camLook.lerp(camLookTarget, Math.min(1, dt * 0.6));
  camera.position.set(camPos.x + Math.sin(t * 0.15) * 1.2, camPos.y + Math.sin(t * 0.21) * 0.4, camPos.z);
  camera.lookAt(camLook);

  updateHud(hand);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

requestAnimationFrame(tick);
