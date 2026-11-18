// Hero lab: shared scaffolding for the six homepage-concept prototypes.
// Each concept page imports what it needs; nothing here is concept-specific.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export { THREE };

export const CONCEPTS = [
  { file: '1-quiet.html', name: 'Quiet and Premium' },
  { file: '2-playground.html', name: 'UI Playground' },
  { file: '3-sketch.html', name: 'Sketch to Ship' },
  { file: '4-canvas.html', name: 'Infinite Canvas' },
  { file: '5-desk.html', name: 'Studio Desk' },
  { file: '6-prototypes.html', name: 'Living Prototypes' },
];

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const ASSETS = '../../assets/';
export const PROJECTS = '../../projects/';

// Existing homepage copy only. The headline is J's to write, so it stays a marked TODO.
export function mountHeroCopy({ onDark = false } = {}) {
  const el = document.createElement('div');
  el.className = 'hero-copy' + (onDark ? ' hero-copy--onDark' : '');
  el.innerHTML = `
    <p class="eyebrow">B.F.A. UX Design · SCAD</p>
    <h1 class="name">Jamiyan Batnyam</h1>
    <!-- TODO: J to write the headline -->
    <p class="todo">Headline: J to write</p>
    <p class="intro">I’m Jamiyan Batnyam. I graduate in June 2027 and I’m looking for new-grad product design roles. Open to relocating.</p>
    <div class="actions">
      <a class="pill" href="../../index.html#projects">See case studies →</a>
      <a class="pill pill--ghost" href="../../Jamiyan_Batnyam_Resume.pdf" target="_blank" rel="noopener">Résumé ↗</a>
    </div>`;
  document.body.append(el);
  return el;
}

// Bottom pill: back to the hub, prev/next concept, and a one-line "try this" hint.
export function mountLabBar(hint) {
  const here = location.pathname.split('/').pop();
  const i = CONCEPTS.findIndex(c => c.file === here);
  const prev = CONCEPTS[(i + CONCEPTS.length - 1) % CONCEPTS.length];
  const next = CONCEPTS[(i + 1) % CONCEPTS.length];
  const bar = document.createElement('nav');
  bar.className = 'labbar';
  bar.setAttribute('aria-label', 'Hero lab');
  bar.innerHTML = `
    <a href="index.html">All concepts</a>
    <a href="${prev.file}" aria-label="Previous concept">←</a>
    <span>${i + 1}/6 · ${CONCEPTS[i].name}</span>
    <a href="${next.file}" aria-label="Next concept">→</a>
    ${hint ? `<span class="hint">${hint}</span>` : ''}`;
  document.body.append(bar);
  document.title = `${CONCEPTS[i].name} · Hero lab`;
}

// Renderer + scene + camera sized to a container, with a pausing animation loop.
export function createStage(container, {
  fov = 35, position = [0, 4, 10], target = [0, 0, 0],
  shadows = true, environment = true, toneMapping = THREE.NeutralToneMapping, exposure = 1,
  alpha = true,
} = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha, powerPreference: 'high-performance' });
  } catch (err) {
    document.documentElement.classList.add('no-webgl');
    throw err;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = toneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  if (environment) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.6;
    pmrem.dispose();
  }

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 200);
  camera.position.set(...position);
  const lookTarget = new THREE.Vector3(...target);
  camera.lookAt(lookTarget);

  const size = { w: 1, h: 1 };
  const resizeHandlers = [];
  const resize = () => {
    size.w = Math.max(1, container.clientWidth);
    size.h = Math.max(1, container.clientHeight);
    renderer.setSize(size.w, size.h, false);
    camera.aspect = size.w / size.h;
    camera.updateProjectionMatrix();
    resizeHandlers.forEach(fn => fn(size));
  };
  new ResizeObserver(resize).observe(container);
  resize();

  // Pointer in normalized device coords; listeners stay on the canvas so the copy keeps its clicks.
  const pointer = { x: 0, y: 0, px: 0, py: 0, down: false, inside: false };
  const canvas = renderer.domElement;
  const setPointer = e => {
    const r = canvas.getBoundingClientRect();
    pointer.px = e.clientX - r.left;
    pointer.py = e.clientY - r.top;
    pointer.x = (pointer.px / r.width) * 2 - 1;
    pointer.y = -(pointer.py / r.height) * 2 + 1;
  };
  canvas.addEventListener('pointermove', e => { setPointer(e); pointer.inside = true; });
  canvas.addEventListener('pointerdown', e => { setPointer(e); pointer.down = true; });
  addEventListener('pointerup', () => { pointer.down = false; });
  canvas.addEventListener('pointerleave', () => { pointer.inside = false; });

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const raycast = (objects, recursive = true) => {
    ndc.set(pointer.x, pointer.y);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects(objects, recursive);
  };
  // World point under the pointer on a plane (for dragging things across a floor or desk).
  const planeHit = (plane, out = new THREE.Vector3()) => {
    ndc.set(pointer.x, pointer.y);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray.intersectPlane(plane, out);
  };

  const frameHandlers = [];
  const clock = new THREE.Clock();
  let running = false;
  const loop = () => {
    const dt = Math.min(clock.getDelta(), 1 / 20);
    const t = clock.elapsedTime;
    frameHandlers.forEach(fn => fn(dt, t));
    renderer.render(scene, camera);
  };
  const start = () => { if (!running) { running = true; clock.getDelta(); renderer.setAnimationLoop(loop); } };
  const stop = () => { running = false; renderer.setAnimationLoop(null); };
  // Pause when the tab is hidden; reduced motion renders on demand only.
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : !reducedMotion && start()));

  const textureLoader = new THREE.TextureLoader();
  const loadTexture = (url, onLoad) => {
    const tex = textureLoader.load(url, onLoad);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  };

  return {
    renderer, scene, camera, canvas, pointer, size, lookTarget,
    raycast, planeHit, loadTexture,
    onFrame: fn => frameHandlers.push(fn),
    onResize: fn => { resizeHandlers.push(fn); fn(size); },
    renderOnce: () => loop(),
    start: () => (reducedMotion ? loop() : start()),
    stop,
  };
}

// Warm key light from the right (like the current hero poster) plus a soft sky fill.
export function addStudioLights(scene, { key = 2.4, fill = 0.9, shadowSize = 8 } = {}) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0xe9e4dc, fill);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2c4, key);
  sun.position.set(6, 9, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -shadowSize;
  sun.shadow.camera.right = sun.shadow.camera.top = shadowSize;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 6;
  scene.add(sun);
  return { hemi, sun };
}

// Critically damped spring toward a target; returns the new [value, velocity].
export function spring(value, velocity, target, dt, stiffness = 180, damping = 2 * Math.sqrt(180)) {
  const a = stiffness * (target - value) - damping * velocity;
  velocity += a * dt;
  value += velocity * dt;
  return [value, velocity];
}

export const damp = (a, b, lambda, dt) => THREE.MathUtils.damp(a, b, lambda, dt);

// Crop a loaded texture like CSS object-fit: cover, for a surface of the given width/height ratio.
export function coverTexture(tex, aspect) {
  const ia = tex.image.width / tex.image.height;
  if (ia > aspect) { tex.repeat.set(aspect / ia, 1); tex.offset.set((1 - aspect / ia) / 2, 0); }
  else { tex.repeat.set(1, ia / aspect); tex.offset.set(0, (1 - ia / aspect) / 2); }
}
