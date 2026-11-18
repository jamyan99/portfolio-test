// A lightweight page-wide sky, sampled by the existing playground clock.
// It has no animation loop of its own and never receives pointer input.
let instance;
export function mountPlaygroundSky() {
  if (instance) return instance;
  const canvas = document.createElement('canvas');
  canvas.id = 'celestial-backdrop';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const context = canvas.getContext('2d');
  if (!context) return (instance = { draw() {}, setTheme() {} });
  let width = 1, height = 1, ratio = 1, lastPaint = -Infinity, lastTime = 12;
  let dark = document.documentElement.dataset.theme === 'dark';
  let seed = 8147;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const stars = Array.from({ length: 170 }, (_, index) => ({
    x: random(), y: random(), radius: index < 8 ? 1.8 + random() * .5 : .45 + random() * .95,
    alpha: .28 + random() * .45, phase: random() * Math.PI * 2,
  }));
  const curtain = document.createElement('canvas');
  curtain.width = 1280; curtain.height = 800;
  const light = curtain.getContext('2d');
  // Cache a continuous curved hem and soft overlapping rays rather than striped columns.
  const hem = x => 490 + Math.sin(x * .006) * 68 + Math.sin(x * .015 + .8) * 31;
  for (let x = 0; x < curtain.width; x += 2) {
    const bottom = hem(x);
    const ray = .72 + .12 * Math.sin(x * .038) + .06 * Math.sin(x * .13);
    const gradient = light.createLinearGradient(0, bottom - 380, 0, bottom + 38);
    gradient.addColorStop(0, 'rgba(167,152,212,0)');
    gradient.addColorStop(.16, `rgba(167,152,212,${.045 * ray})`);
    gradient.addColorStop(.55, `rgba(81,215,193,${.22 * ray})`);
    gradient.addColorStop(.91, `rgba(136,207,167,${.38 * ray})`);
    gradient.addColorStop(1, 'rgba(81,215,193,0)');
    light.fillStyle = gradient;
    light.fillRect(x, 0, 3, curtain.height);
  }
  light.beginPath();
  for (let x = 0; x <= curtain.width; x += 4) {
    if (x === 0) light.moveTo(x, hem(x)); else light.lineTo(x, hem(x));
  }
  light.strokeStyle = '#51D7C1'; light.globalAlpha = .2;
  light.lineWidth = 12; light.shadowColor = '#51D7C1'; light.shadowBlur = 28; light.stroke();
  light.globalAlpha = .14; light.lineWidth = 2; light.shadowBlur = 0; light.stroke();
  light.globalAlpha = 1;

  function draw(time = lastTime, force = false) {
    lastTime = time;
    if (!force && Math.abs(time - lastPaint) < 1 / 24) return;
    lastPaint = time;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const ground = context.createLinearGradient(0, 0, 0, height);
    ground.addColorStop(0, dark ? '#050B18' : '#E4E9ED');
    ground.addColorStop(.55, dark ? '#091C28' : '#D9E7E7');
    ground.addColorStop(1, dark ? '#050B18' : '#F0F0EB');
    context.fillStyle = ground; context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = dark ? 'screen' : 'source-over';
    context.globalAlpha = dark ? .9 : .38;
    context.drawImage(curtain, -width * .12 + Math.sin(time * .035) * width * .035,
      -height * .12 + Math.cos(time * .027) * height * .035, width * 1.24, height * 1.2);
    context.globalAlpha = dark ? .42 : .18;
    context.save(); context.translate(width, height * .12); context.scale(-1, .8);
    context.drawImage(curtain, -width * .08 + Math.sin(time * .023 + 1) * width * .04, 0, width * 1.2, height * 1.15);
    context.restore();
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = dark ? '#DFECFF' : '#516B85';
    for (const star of stars) {
      context.globalAlpha = star.alpha * (.88 + .12 * Math.sin(time * .36 + star.phase));
      context.beginPath(); context.arc(star.x * width, star.y * height, star.radius, 0, Math.PI * 2); context.fill();
    }
    context.globalAlpha = 1;
  }
  function resize() {
    width = innerWidth; height = innerHeight; ratio = Math.min(devicePixelRatio, 1.25);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    draw(lastTime, true);
  }
  addEventListener('resize', resize, { passive: true });
  resize();
  instance = { draw, setTheme(value) { dark = value; draw(lastTime, true); } };
  return instance;
}
