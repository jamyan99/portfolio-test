// Aurora lab: what the northern-lights hero prototypes share.
// - AURORA_GLSL: a hand-written aurora, star field, mountains and night-to-dawn sky, as GLSL.
// - Uniforms and helpers that let the cursor bend the curtains, clicks send pulses through
//   them, and scrolling turn night into morning.
// - Project data (existing titles, subtitles and screens only), hero copy and the lab bar.
import { THREE, mountHeroCopy, reducedMotion, coverTexture, ASSETS, PROJECTS, spring, damp } from '../hero-lab/lab.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export { THREE, reducedMotion, coverTexture, ASSETS, PROJECTS, spring, damp, RoundedBoxGeometry };

export const CONCEPTS = [
  { file: 'a-constellations.html', name: 'Constellations' },
  { file: 'b-frozen-lake.html', name: 'Frozen Lake' },
];

// Existing project titles and subtitles (from the site and the hero lab); screens are real
// case-study images. FINRA shows only the summary image already public on the site (NDA).
export const IMG = ASSETS + 'img/';
export const WORK = [
  {
    id: 'liminal', title: 'Liminal', sub: 'Wellness App for Anxiety Support', href: 'liminal.html',
    shape: 'phone', aspect: 804 / 1748, body: 0xE4DFF0, glow: '#B9A8FF',
    screens: ['liminal/screens/onboarding-welcome.jpg', 'liminal/screens/meditation.jpg', 'liminal/screens/meditation-player.jpg', 'liminal/screens/meditation-finished.jpg'],
  },
  {
    id: 'content-plus', title: 'Content Plus', sub: 'Educational Screen Time for Kids', href: 'content-plus.html',
    shape: 'phone', aspect: 780 / 1688, body: 0xF5C542, glow: '#FFD84A',
    screens: ['content-plus/screens/onboarding-welcome.jpg', 'content-plus/screens/videos-home.jpg', 'content-plus/screens/videos-playing.jpg', 'content-plus/screens/coplay-game.jpg'],
  },
  {
    id: 'hmi', title: 'Motorcycle Dashboard HMI', sub: 'Embedded UI, prototyped in code with AI', href: 'vibe-coding.html',
    shape: 'round', aspect: 1, body: 0x1E2024, glow: '#6EE7F9',
    screens: ['vibe-coding/screens/settings.png'],
  },
  {
    id: 'finra', title: 'FINRA x SCADpro', sub: 'Role-based login and dashboard · NDA summary', href: 'finra-scadpro.html',
    shape: 'laptop', aspect: 1024 / 520, body: 0xDCDDE0, glow: '#8FB8FF',
    screens: ['framer/j90JLu2USyq46GRLYCzX1TgsCc-1024.webp'],
  },
];
// The court lives on the Playground page ("Room to explore." is that page's existing heading).
export const PLAYGROUND = { title: 'Playground', sub: 'Room to explore.', href: '../../playground.html' };
export const workHref = (w) => (w.href.startsWith('http') || w.href.startsWith('../') ? w.href : PROJECTS + w.href);

// ---------- GLSL ----------
// Directions are world-space with +Y up; the curtains hang in front of the viewer (−Z),
// AURORA_NEAR / AURORA_FAR units away, between 1 and 2.6 units up.
export const AURORA_GLSL = /* glsl */ `
uniform float uTime;
uniform float uDawn;    // 0 night → 1 morning (scroll)
uniform float uFlare;   // extra brightness for a moment (clicks, collisions)
uniform vec3 uCursor;   // xy: cursor on the aurora layer (x, z); z: how present it is
uniform vec4 uPulse;    // xy: where a pulse started on the layer, z: its age in s, w: strength

#define AURORA_NEAR 3.6
#define AURORA_FAR 6.5
// Layers per view ray: more is smoother but slower. A page can define its own before this.
#ifndef SLICES
#define SLICES 24
#endif

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm3(vec2 p) {
  float v = 0., a = .5;
  for (int i = 0; i < 3; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; }
  return v;
}

// Where a curtain stands (its z) at a given x: slow folds, a wandering drift, and small quick
// folds that ripple along it.
float curtainZ(float x, float seed, float t) {
  return .9 * sin(x * .23 + seed + t * .05) + .45 * sin(x * .57 - t * .08 + seed * 2.1)
       + 1.1 * (fbm3(vec2(x * .11 + t * .012, seed)) - .5)
       + .16 * sin(x * 1.7 - t * .45 + seed * 3.) + .06 * sin(x * 4.1 + t * .8);
}

// Colour by height in the curtain, varied along it: green with drifting teal patches, violet
// tops, and a pink lower fringe that comes and goes.
vec3 auroraColor(float h, float x, float t) {
  float teal = smoothstep(.45, .8, vnoise(vec2(x * .16 + t * .02, 3.)));
  float pink = smoothstep(.6, .9, vnoise(vec2(x * .22 - t * .03, 8.)));
  vec3 c = mix(mix(vec3(.12, .95, .5), vec3(.1, .86, .78), teal), vec3(.1, .72, .8), smoothstep(.2, .6, h));
  c = mix(c, vec3(.58, .3, .98), smoothstep(.5, 1., h));
  float fringe = 1. - smoothstep(0., .04 + .08 * pink, h);
  return mix(c, vec3(1., .32, .62), fringe * (.5 + .5 * pink));
}

// Aurora light along a view direction: march up through thin horizontal layers; each layer
// glows where the view ray crosses one of the two curtains. Each pixel starts the march at a
// random offset, which trades the layers' banding for fine grain.
vec3 aurora(vec3 rd, vec2 seed) {
  if (rd.y < .015) return vec3(0.);
  float t = uTime;
  float jitter = hash12(seed);
  vec3 col = vec3(0.);
  for (int i = 0; i < SLICES; i++) {
    float h = (float(i) + jitter) / float(SLICES);
    float H = 1. + h * 1.6;
    vec2 p = rd.xz / rd.y * H;
    float fade = exp(-length(p) * .05);
    if (fade < .02) break;
    // The cursor pulls the nearest curtain toward it and brightens it a little.
    float w = uCursor.z * exp(-pow(p.x - uCursor.x, 2.) * .15);
    float z1 = mix(-AURORA_NEAR + curtainZ(p.x, 1.3, t), uCursor.y, w * .45);
    float z2 = -AURORA_FAR + curtainZ(p.x * .8 + 17., 4.7, t * 1.1);
    float band = exp(-abs(p.y - z1) * 4.5) * (1. + .7 * w) + .5 * exp(-abs(p.y - z2) * 4.);
    // Vertical rays: brightness varies along the curtain, not with height. Three scales drift
    // at different speeds: broad bands, rays, and a fine flicker.
    float n = .5 * vnoise(vec2(p.x * 2.1 + t * .07, 1.)) + .32 * vnoise(vec2(p.x * 7. - t * .22, 5.))
            + .18 * vnoise(vec2(p.x * 23. + t * .9, 9.));
    float rays = .06 + 1.7 * n * n;
    // Surges: bright patches that travel along the curtains on their own.
    float surge = 1. + .9 * pow(.5 + .5 * sin(p.x * .32 - t * .7), 8.) + .5 * pow(.5 + .5 * sin(p.x * .19 + t * .45 + 2.), 10.);
    // Brightest just above a crisp lower edge, fading up into the violet tops.
    float hem = smoothstep(0., .035, h) * (.22 + 1.3 * exp(-h * 9.)) * pow(1. - h, 1.1);
    // A click sends a wave of light sideways along the curtains.
    float ring = abs(p.x - uPulse.x) - uPulse.z * 5.5;
    float pulse = uPulse.w * exp(-ring * ring * .35) * exp(-uPulse.z * 1.1);
    col += auroraColor(h, p.x, t) * band * rays * hem * fade * surge * (1. + 2.2 * pulse);
  }
  float strength = 12. / float(SLICES) * (1. + uFlare);
  return col * strength * smoothstep(.015, .12, rd.y) * (1. - smoothstep(0., .55, uDawn));
}
vec3 aurora(vec3 rd) { return aurora(rd, gl_FragCoord.xy); }

vec3 stars(vec3 rd) {
  vec2 g = vec2(atan(rd.x, -rd.z), asin(clamp(rd.y, -1., 1.))) * 95.;
  vec2 cell = floor(g);
  float r = hash12(cell);
  vec2 o = vec2(hash12(cell + 1.3), hash12(cell + 7.1)) - .5;
  float d = length(fract(g) - .5 - o * .7);
  float twinkle = .55 + .45 * sin(uTime * (1. + r * 3.) + r * 40.);
  float s = smoothstep(.1, 0., d) * step(.87, r) * twinkle * (.4 + 1.6 * fract(r * 13.));
  return vec3(.85, .9, 1.) * s * smoothstep(0., .1, rd.y) * (1. - smoothstep(0., .45, uDawn));
}

// Night → sunrise (accent orange at the horizon) → the site's warm paper white.
vec3 skyBase(vec3 rd) {
  float k1 = smoothstep(0., .55, uDawn), k2 = smoothstep(.45, 1., uDawn);
  vec3 top = mix(mix(vec3(.006, .01, .03), vec3(.27, .29, .5), k1), vec3(.93, .93, .95), k2);
  vec3 hor = mix(mix(vec3(.03, .075, .11), vec3(.97, .44, .22), k1), vec3(.99, .95, .9), k2);
  float y = clamp(rd.y, 0., 1.);
  vec3 c = mix(hor, top, pow(y, .55));
  // faint green airglow low in the night sky
  c += vec3(0., .05, .035) * exp(-y * 9.) * (1. - k1);
  // the sun coming up, slightly right of centre
  float sun = max(dot(rd, normalize(vec3(.35, .02, -1.))), 0.);
  c += vec3(1., .55, .25) * pow(sun, 12.) * .6 * k1 * (1. - k2 * .6);
  return c;
}

// Mountain silhouettes on the horizon, lit faintly by the aurora (or the sunrise).
vec3 mountains(vec3 rd, vec3 sky, out float mask) {
  float az = atan(rd.x, -rd.z);
  float far = .035 + .07 * fbm3(vec2(az * 2.6, 3.));
  float near = .01 + .055 * pow(fbm3(vec2(az * 4.1 + 9., 7.)), 1.4);
  float k1 = smoothstep(0., .55, uDawn), k2 = smoothstep(.45, 1., uDawn);
  // Snow on the ridges catches the aurora's green at night and the sunrise later.
  vec3 snow = mix(vec3(.16, .3, .3), vec3(1., .66, .55), k1);
  vec3 farCol = mix(mix(vec3(.035, .06, .09), vec3(.36, .3, .42), k1), vec3(.78, .8, .86), k2);
  vec3 nearCol = mix(mix(vec3(.012, .02, .035), vec3(.2, .16, .26), k1), vec3(.62, .64, .72), k2);
  vec3 c = sky;
  mask = 0.;
  float cap = .5 + .5 * vnoise(vec2(az * 40., 1.));
  if (rd.y < 0.) return c; // below the horizon is ground, in front of the mountains
  if (rd.y < far) { c = mix(farCol, snow * .7, smoothstep(far - .035, far, rd.y) * cap * (1. - k2)); mask = 1.; }
  if (rd.y < near) { c = mix(nearCol, snow, smoothstep(near - .022, near, rd.y) * cap * .8 * (1. - k2)); mask = 1.; }
  return c;
}

// Full sky: base, stars, aurora, mountains in front. A scene whose camera looks down at the
// ground can define SKY_STRETCH / SKY_RAISE first to pull the curtains down into view.
#ifndef SKY_STRETCH
#define SKY_STRETCH 1.
#define SKY_RAISE 0.
#endif
vec3 nightSky(vec3 rd) {
  rd = normalize(vec3(rd.x, rd.y * SKY_STRETCH + SKY_RAISE, rd.z));
  vec3 c = skyBase(rd) + stars(rd) + aurora(rd);
  float m;
  return mountains(rd, c, m);
}
`;

export function auroraUniforms() {
  return {
    uTime: { value: 0 },
    uDawn: { value: 0 },
    uFlare: { value: 0 },
    uCursor: { value: new THREE.Vector3(0, -4, 0) },
    uPulse: { value: new THREE.Vector4(0, 0, 99, 0) },
  };
}

// Point on the aurora layer (x, z) seen along a world-space direction, or null near the horizon.
export function auroraPoint(rd) {
  if (rd.y < 0.03) return null;
  const H = 1.8;
  return new THREE.Vector2((rd.x / rd.y) * H, (rd.z / rd.y) * H);
}

// The same upward stretch as SKY_STRETCH / SKY_RAISE, for mapping the pointer onto the sky.
export const stretchDir = (d, stretch, raise) => new THREE.Vector3(d.x, d.y * stretch + raise, d.z).normalize();

// Live state behind the uniforms: the cursor eases in and out, pulses age, flares fade.
export function auroraController(u) {
  const cursor = new THREE.Vector2(0, -4);
  let present = 0;
  let want = 0;
  return {
    point(p) {
      if (p) { cursor.copy(p); want = 1; } else want = 0;
    },
    pulse(p, strength = 1) {
      if (!p) return;
      u.uPulse.value.set(p.x, p.y, 0, strength);
    },
    flare(amount) { u.uFlare.value = Math.min(2.5, u.uFlare.value + amount); },
    update(dt, t) {
      u.uTime.value = t;
      present = damp(present, want, 4, dt);
      const c = u.uCursor.value;
      c.x = damp(c.x, cursor.x, 6, dt);
      c.y = damp(c.y, cursor.y, 6, dt);
      c.z = present;
      u.uPulse.value.z += dt;
      u.uFlare.value = damp(u.uFlare.value, 0, 2.2, dt);
    },
  };
}

// Rough average colour of the aurora right now, for lighting a room or a lake with it.
export function auroraTint(t, dawn, flare = 0, out = new THREE.Color()) {
  const k = 0.5 + 0.5 * Math.sin(t * 0.07);
  out.setRGB(0.1 + 0.25 * k, 0.95 - 0.2 * k, 0.6 + 0.3 * k);
  const night = 1 - THREE.MathUtils.smoothstep(dawn, 0, 0.55);
  return out.multiplyScalar(night * (1 + flare));
}

// ---------- Page ----------
// Hero copy on the dark sky, a lab bar, and a light section below so scrolling shows the
// sunrise handing over to the site's existing (unchanged) sections.
export function mountPage(hint) {
  document.documentElement.dataset.theme = 'dark';
  const hero = document.createElement('section');
  hero.className = 'aurora-hero';
  document.body.prepend(hero);
  const copy = mountHeroCopy({ onDark: true });
  hero.append(copy);
  const after = document.createElement('section');
  after.className = 'aurora-after';
  after.innerHTML = `<p>Scrolling turns the night into morning, then the site’s existing sections continue here, unchanged.</p>`;
  document.body.append(after);

  // Earlier versions kept for comparison aren't in CONCEPTS; they keep their own title.
  const here = location.pathname.split('/').pop();
  const found = CONCEPTS.findIndex((c) => c.file === here);
  const i = Math.max(0, found);
  const prev = CONCEPTS[(i + CONCEPTS.length - 1) % CONCEPTS.length];
  const next = CONCEPTS[(i + 1) % CONCEPTS.length];
  const name = found >= 0 ? `${String.fromCharCode(65 + i)} · ${CONCEPTS[i].name}` : document.title.split(' · ')[0];
  const bar = document.createElement('nav');
  bar.className = 'labbar';
  bar.setAttribute('aria-label', 'Aurora lab');
  bar.innerHTML = `
    <a href="index.html">All concepts</a>
    <a href="${prev.file}" aria-label="Previous concept">←</a>
    <span>${name}</span>
    <a href="${next.file}" aria-label="Next concept">→</a>
    ${hint ? `<span class="hint">${hint}</span>` : ''}`;
  document.body.append(bar);
  if (found >= 0) document.title = `${CONCEPTS[i].name} · Aurora lab`;
  return { hero, copy };
}

// Scroll position → dawn (0 at the top, 1 once the hero has mostly scrolled away).
export function trackDawn(u, onChange) {
  const update = () => {
    const d = THREE.MathUtils.clamp(scrollY / (innerHeight * 0.85), 0, 1);
    if (d !== u.uDawn.value) { u.uDawn.value = d; onChange?.(d); }
    // The shade that keeps the copy readable is only needed at night.
    document.documentElement.style.setProperty('--night', String(1 - THREE.MathUtils.smoothstep(d, 0.1, 0.6)));
  };
  addEventListener('scroll', update, { passive: true });
  update();
  return update;
}

// Floating label for whatever the pointer is over.
export function makeTag() {
  const tag = document.createElement('div');
  tag.className = 'tag';
  document.body.append(tag);
  return {
    show(item, x, y) {
      const html = item.title + (item.sub ? `<span>${item.sub}</span>` : '');
      if (tag.innerHTML !== html) tag.innerHTML = html;
      // Keep the whole label on screen near the edges.
      const half = tag.offsetWidth / 2 + 8;
      tag.style.left = `${Math.min(Math.max(x, half), innerWidth - half)}px`;
      tag.style.top = `${y}px`;
      tag.classList.add('on');
    },
    hide() { tag.classList.remove('on'); },
  };
}

// A basketball texture (seams on orange), for the Playground ball.
export function basketballTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#E8682A';
  g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(255,210,170,.08)';
    g.fillRect(Math.random() * 512, Math.random() * 256, 2, 2);
  }
  g.strokeStyle = '#2A1408';
  g.lineWidth = 6;
  g.beginPath(); g.moveTo(0, 128); g.lineTo(512, 128); g.stroke();
  [128, 384].forEach((x) => { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); });
  [0, 256].forEach((x0) => {
    g.beginPath();
    for (let y = 0; y <= 256; y += 4) g.lineTo(x0 + 128 + Math.sin((y / 256) * Math.PI) * 70 * (x0 ? -1 : 1), y);
    g.stroke();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Devices for B and C, built from simple shapes with a real screen image on each.
export function buildDevice(work, loadTexture, { flat = false } = {}) {
  const g = new THREE.Group();
  const shell = new THREE.MeshPhysicalMaterial({
    color: work.body, metalness: work.shape === 'laptop' ? 0.7 : 0.4, roughness: 0.32, clearcoat: 0.5,
  });
  const screenMat = (aspect) => new THREE.MeshBasicMaterial({
    map: loadTexture(IMG + work.screens[work.shape === 'phone' ? 2 : 0], (tex) => coverTexture(tex, aspect)),
    toneMapped: false,
  });
  let screen;
  if (work.shape === 'phone') {
    const W = 0.95, H = W / work.aspect;
    const body = new THREE.Mesh(new RoundedBoxGeometry(W + 0.08, H + 0.08, 0.1, 5, 0.05), shell);
    screen = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.02, H - 0.02), screenMat((W - 0.02) / (H - 0.02)));
    screen.position.z = 0.052;
    g.add(body, screen);
    g.userData.radius = H * 0.5;
  } else if (work.shape === 'round') {
    const R = 0.85;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.12, R + 0.15, 0.22, 72), shell);
    body.rotation.x = Math.PI / 2;
    screen = new THREE.Mesh(new THREE.CircleGeometry(R, 72), screenMat(1));
    screen.position.z = 0.115;
    g.add(body, screen);
    g.userData.radius = R + 0.15;
  } else {
    // FINRA: a laptop; lying flat (B) it's just the open screen half, like a tablet.
    const W = 2.6, H = 1.6;
    const lidBody = new THREE.Mesh(new RoundedBoxGeometry(W + 0.16, H + 0.16, 0.08, 4, 0.04), shell);
    screen = new THREE.Mesh(new THREE.PlaneGeometry(W, H), screenMat(W / H));
    screen.position.z = 0.042;
    if (flat) {
      g.add(lidBody, screen);
    } else {
      const lid = new THREE.Group();
      lid.add(lidBody, screen);
      lidBody.position.y = screen.position.y = H / 2 + 0.08;
      lid.rotation.x = -0.25;
      lid.position.set(0, 0.12, -0.95);
      const base = new THREE.Mesh(new RoundedBoxGeometry(W + 0.16, 0.12, 1.95, 4, 0.05), shell);
      base.position.y = 0.06;
      const keys = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.3, 0.9), new THREE.MeshStandardMaterial({ color: 0x9A9CA2, roughness: 0.8 }));
      keys.rotation.x = -Math.PI / 2; keys.position.set(0, 0.122, -0.2);
      g.add(base, keys, lid);
    }
    g.userData.radius = W * 0.5;
  }
  g.userData.screen = screen;
  return g;
}
