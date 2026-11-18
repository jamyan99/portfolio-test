// A frost crawler: a little segmented ice creature that wanders over the page, in the spirit of
// the "Crawlers" reel but our own creature. Its feet land on the words it passes, which light up
// mint; now and then it stops to read one (it lifts the word, carries it about, and puts it back
// exactly where it was); it comes over to look at your cursor, and scurries off if you poke it.
// It's drawn on a canvas over the page that never takes a click, and the page's text is only
// ever borrowed. On a page of its own it's opt-in (a button releases it and puts it away); a host
// like the frozen lake's playground room can keep it to one area and let it out itself.
//
// How it moves: the head steers toward a target and every segment behind it follows at a fixed
// distance (follow-the-leader). Each leg keeps its foot planted until the body has moved on far
// enough, then steps to a new spot ahead of where it rests, but only while its neighbours are
// planted, so the legs ripple in a gait. The knee comes from two-bone inverse kinematics.

const MINT = '158,240,214';
const N = 13;          // body segments, head first
const GAP = 11;        // px between segment centres
const SPEED = { wander: 85, read: 95, carry: 70, curious: 140, flee: 260, leave: 160, enter: 120 };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (t) => t * t * (3 - 2 * t);
const width = (i) => (i === 0 ? 15 : Math.max(5, 17 - Math.max(0, i - 3) * 1.3));

// ---------- The creature ----------
function makeBody() {
  const seg = Array.from({ length: N }, () => ({ x: 0, y: 0, a: 0 }));
  const legs = [];
  for (let i = 1; i <= 9; i++) for (const side of [-1, 1]) {
    const reach = 22 - i * 0.9;
    legs.push({ i, side, reach, l1: reach * 0.64, l2: reach * 0.64, foot: { x: 0, y: 0 }, from: null, to: null, t: 1 });
  }
  return { seg, legs };
}
// Where a leg's foot rests: out to its side and a little ahead of its hip.
function restOf(leg, seg) {
  const s = seg[leg.i];
  const fx = Math.cos(s.a), fy = Math.sin(s.a), nx = -fy, ny = fx;
  const out = width(leg.i) * 0.45 * leg.side + leg.side * leg.reach * 0.82;
  return { x: s.x + nx * out + fx * leg.reach * 0.32, y: s.y + ny * out + fy * leg.reach * 0.32 };
}
function knee(h, f, l1, l2, bend) {
  const dx = f.x - h.x, dy = f.y - h.y;
  const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.5, l1 + l2 - 0.5);
  const off = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const a = Math.atan2(dy, dx) + bend * off;
  return { x: h.x + Math.cos(a) * l1, y: h.y + Math.sin(a) * l1 };
}
function box(ctx, x, y, a, w, h, r) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, r); ctx.restore();
}
// Legs, body plates and head, at the given time; look: where the eyes point.
function drawCreature(ctx, seg, legs, { time, look, curious = false }) {
  // Legs: thigh and shin, a knee joint, a foot that's a dot when planted and a ring mid-step.
  ctx.lineWidth = 1.15; ctx.lineCap = 'round';
  for (const leg of legs) {
    const s = seg[leg.i];
    const nx = -Math.sin(s.a), ny = Math.cos(s.a);
    const hip = { x: s.x + nx * width(leg.i) * 0.45 * leg.side, y: s.y + ny * width(leg.i) * 0.45 * leg.side };
    const k = knee(hip, leg.foot, leg.l1, leg.l2, -leg.side);
    ctx.strokeStyle = `rgba(${MINT},.78)`;
    ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(k.x, k.y); ctx.lineTo(leg.foot.x, leg.foot.y); ctx.stroke();
    ctx.beginPath(); ctx.arc(k.x, k.y, 1.5, 0, Math.PI * 2); ctx.fillStyle = '#0B1A1F'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(leg.foot.x, leg.foot.y, leg.t < 1 ? 2.4 : 1.8, 0, Math.PI * 2);
    if (leg.t < 1) ctx.stroke(); else { ctx.fillStyle = `rgba(${MINT},.95)`; ctx.fill(); }
  }
  // Body, tail first: dark glassy plates with a mint rim, and a core light that pulses down the
  // body like a heartbeat.
  for (let i = N - 1; i >= 0; i--) {
    const s = seg[i], w = width(i), len = i === 0 ? 17 : 10;
    box(ctx, s.x, s.y, s.a, len, w, i === 0 ? 6 : 3.5);
    ctx.fillStyle = 'rgba(11,26,31,.82)'; ctx.fill();
    ctx.strokeStyle = `rgba(${MINT},.95)`; ctx.lineWidth = 1.2; ctx.stroke();
    const beat = 0.35 + 0.65 * Math.max(0, Math.sin(time * 5 - i * 0.7));
    box(ctx, s.x, s.y, s.a, i === 0 ? 5 : 3.4, i === 0 ? 5 : 3.4, 1);
    ctx.fillStyle = `rgba(${MINT},${beat})`; ctx.fill();
  }
  // Head: eyes that look where it's going, and two antennae that sway (faster when curious).
  const head = seg[0], fx = Math.cos(head.a), fy = Math.sin(head.a);
  for (const side of [-1, 1]) {
    const ex = head.x + fx * 4 - fy * side * 3.8, ey = head.y + fy * 4 + fx * side * 3.8;
    ctx.beginPath(); ctx.arc(ex, ey, 1.9, 0, Math.PI * 2); ctx.fillStyle = '#F3FFFB'; ctx.fill();
    ctx.beginPath(); ctx.arc(ex + Math.cos(look) * 0.8, ey + Math.sin(look) * 0.8, 0.9, 0, Math.PI * 2); ctx.fillStyle = '#0B1A1F'; ctx.fill();
    const sway = Math.sin(time * (curious ? 11 : 3.2) + side) * 0.35;
    const base = { x: head.x + fx * 8 - fy * side * 3, y: head.y + fy * 8 + fx * side * 3 };
    const aa = head.a + side * 0.42 + sway;
    const tip = { x: base.x + Math.cos(aa) * 20, y: base.y + Math.sin(aa) * 20 };
    const mid = { x: base.x + Math.cos(head.a + side * 0.15) * 11, y: base.y + Math.sin(head.a + side * 0.15) * 11 };
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.quadraticCurveTo(mid.x, mid.y, tip.x, tip.y);
    ctx.strokeStyle = `rgba(${MINT},.8)`; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(tip.x, tip.y, 1.6, 0, Math.PI * 2); ctx.fillStyle = `rgba(${MINT},1)`; ctx.fill();
  }
}

// A crawler caught mid-stride on a gentle S, for freezing into the ice (the frozen lake draws it
// under its surface). Paints it to fit a w × h canvas, transparent around it.
export function paintCrawler(ctx, w, h) {
  const { seg, legs } = makeBody();
  const scale = Math.min(w / ((N - 1) * GAP + 70), h / 70);
  ctx.save();
  ctx.translate(w / 2 + ((N - 1) * GAP * scale) / 2 - 12 * scale, h / 2);
  ctx.scale(scale, scale);
  seg.forEach((s, i) => { s.x = -i * GAP; s.y = Math.sin(i * 0.5) * 7; });
  seg.forEach((s, i) => { const p = seg[Math.max(0, i - 1)], q = seg[Math.min(N - 1, i + 1)]; s.a = Math.atan2(p.y - q.y, p.x - q.x); });
  legs.forEach((l) => { const r = restOf(l, seg); const k = (l.i + (l.side > 0 ? 1 : 0)) % 2 ? 4 : -3; l.foot = { x: r.x + Math.cos(seg[l.i].a) * k, y: r.y + Math.sin(seg[l.i].a) * k }; });
  drawCreature(ctx, seg, legs, { time: 0.6, look: 0 });
  ctx.restore();
}

// root: where its words are (default the whole page). area(): the client rect it keeps to
// (default the window). toggle: add the release button (a host that lets it out itself says no).
export function mountCrawler({ root = document.body, area = null, toggle: withToggle = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'crawler-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  const status = document.createElement('p');
  status.className = 'crawler-sr crawler-ui';
  status.setAttribute('role', 'status');
  document.body.append(canvas, status);
  let toggle = null;
  if (withToggle) {
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'crawler-toggle crawler-ui';
    toggle.setAttribute('aria-pressed', 'false');
    toggle.innerHTML = '<span class="crawler-toggle__glyph" aria-hidden="true"><i></i><i></i><i></i></span><span class="crawler-toggle__text">Release a crawler</span>';
    document.body.append(toggle);
  }
  const setToggle = (out) => {
    if (!toggle) return;
    toggle.setAttribute('aria-pressed', String(out));
    toggle.querySelector('.crawler-toggle__text').textContent = out ? 'Put it away' : 'Release a crawler';
  };

  let W = 0, H = 0, raf = 0, last = 0, time = 0, active = false;
  let mode = 'enter', target = { x: 0, y: 0 }, speed = 0, modeAt = 0, nextRead = 0;
  const { seg, legs } = makeBody();
  const legAt = (i, side) => legs.find((l) => l.i === i && l.side === side);
  const prints = [];      // frost footprints
  let words = [];         // the page's words: client rect, text, glow
  let carried = null;     // the word being read
  let label = null;       // the inspector tag beside the head
  const pointer = { x: -999, y: -999, at: -99 };
  const A = () => (area ? area() : { x: 0, y: 0, w: W, h: H });

  // ---------- The page's words ----------
  // Every visible word in its area, measured with ranges (nothing in the page is touched).
  function indexWords() {
    const glowOf = new Map(words.map((w) => [w.node.nodeValue + w.start + w.text, w]));
    const out = [], a = A();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue.trim() && !n.parentElement.closest('script,style,noscript,.crawler-ui,[aria-hidden="true"]') ? 1 : 2),
    });
    const range = document.createRange();
    for (let n; (n = walker.nextNode());) {
      const el = n.parentElement;
      if (getComputedStyle(el).visibility === 'hidden') continue;
      const re = /\S+/g;
      for (let m; (m = re.exec(n.nodeValue));) {
        range.setStart(n, m.index); range.setEnd(n, m.index + m[0].length);
        const r = range.getClientRects()[0];
        if (!r || r.width < 3 || r.height < 6 || r.bottom < a.y - 40 || r.top > a.y + a.h + 40 || r.right < a.x || r.left > a.x + a.w) continue;
        const old = glowOf.get(n.nodeValue + m.index + m[0]);
        out.push({ text: m[0], node: n, start: m.index, el, x: r.left, y: r.top, w: r.width, h: r.height, glow: old?.glow || 0 });
      }
    }
    words = out;
  }
  let indexQueued = false;
  const queueIndex = () => { if (!indexQueued) { indexQueued = true; requestAnimationFrame(() => { indexQueued = false; if (active) indexWords(); }); } };

  // The word nearest a point, if one is close enough to stand on.
  function wordNear(x, y, within) {
    let best = null, bd = within;
    for (const w of words) {
      const dx = Math.max(w.x - x, 0, x - (w.x + w.w)), dy = Math.max(w.y - y, 0, y - (w.y + w.h));
      const d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = w; }
    }
    return best;
  }

  // ---------- Targets ----------
  const inView = (p, m = 48) => { const a = A(); return { x: clamp(p.x, a.x + m, a.x + a.w - m), y: clamp(p.y, a.y + m, a.y + a.h - m) }; };
  function wander() {
    // Mostly toward words it hasn't stood on lately, otherwise somewhere open.
    const near = words.filter((w) => w.glow < 0.05 && Math.hypot(w.x - seg[0].x, w.y - seg[0].y) < 520);
    if (near.length && Math.random() < 0.7) {
      const w = near[(Math.random() * near.length) | 0];
      return inView({ x: w.x + w.w / 2, y: w.y + w.h / 2 });
    }
    return inView({ x: seg[0].x + (Math.random() - 0.5) * 600, y: seg[0].y + (Math.random() - 0.5) * 420 }, 80);
  }
  function setMode(m, t) { mode = m; modeAt = time; if (t) target = t; }

  // ---------- Reading a word ----------
  // The word is wrapped in a span whose text goes transparent (so nothing reflows), and a copy is
  // drawn in the creature's mouth; on the way back it flies home and the span is unwrapped.
  function lift(w) {
    const range = document.createRange();
    try { range.setStart(w.node, w.start); range.setEnd(w.node, w.start + w.text.length); } catch { return false; }
    const hole = document.createElement('span');
    hole.className = 'crawler-hole';
    try { range.surroundContents(hole); } catch { return false; }
    const cs = getComputedStyle(w.el);
    const text = cs.textTransform === 'uppercase' ? w.text.toUpperCase() : w.text;
    carried = { text, hole, font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, color: cs.color, home: { x: w.x, y: w.y + w.h * 0.78 }, w: w.w, h: w.h, t: 0, back: null };
    label = { tag: w.el.tagName.toLowerCase(), text: w.text, life: 1.6 };
    status.textContent = `The crawler picked up “${w.text}”.`;
    return true;
  }
  function putBack(now) {
    if (!carried) return;
    const { hole } = carried;
    if (hole.isConnected) { const parent = hole.parentNode; hole.replaceWith(...hole.childNodes); parent.normalize(); }
    carried = null;
    if (!now) queueIndex();
  }

  // ---------- Input ----------
  addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.at = time; }, { passive: true });
  // Poke it and it scurries off (the click still goes through to the page).
  addEventListener('pointerdown', (e) => {
    if (!active || mode === 'leave') return;
    if (!seg.some((s, i) => Math.hypot(s.x - e.clientX, s.y - e.clientY) < width(i) + 10)) return;
    const a = Math.atan2(seg[0].y - e.clientY, seg[0].x - e.clientX);
    setMode('flee', inView({ x: seg[0].x + Math.cos(a) * 320, y: seg[0].y + Math.sin(a) * 320 }));
  }, { passive: true, capture: true });
  document.addEventListener('scroll', queueIndex, { passive: true, capture: true });   // the page or any box in it
  addEventListener('resize', () => { size(); queueIndex(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && active && !raf) { last = 0; raf = requestAnimationFrame(frame); } });

  // ---------- Simulation ----------
  function steer(dt) {
    const head = seg[0];
    const dx = target.x - head.x, dy = target.y - head.y, dist = Math.hypot(dx, dy);
    const want = SPEED[mode] * (mode === 'curious' ? clamp((dist - 30) / 80, 0, 1) : clamp(dist / 40, 0.15, 1));
    speed += (want - speed) * (1 - Math.exp(-dt * 4));
    const desired = Math.atan2(dy, dx) + Math.sin(time * 5.2) * 0.2 * clamp(speed / 90, 0, 1);
    const turn = mode === 'flee' ? 7 : 4.2;
    head.a += clamp(wrap(desired - head.a), -turn * dt, turn * dt);
    head.x += Math.cos(head.a) * speed * dt;
    head.y += Math.sin(head.a) * speed * dt;
    for (let i = 1; i < N; i++) {
      const p = seg[i - 1], s = seg[i];
      const ax = s.x - p.x, ay = s.y - p.y, d = Math.hypot(ax, ay) || 1;
      s.x = p.x + (ax / d) * GAP; s.y = p.y + (ay / d) * GAP;
      s.a = Math.atan2(p.y - s.y, p.x - s.x);
    }
    return dist;
  }

  function think(dist) {
    const head = seg[0], a = A();
    const pDist = Math.hypot(pointer.x - head.x, pointer.y - head.y);
    const fresh = time - pointer.at < 2;
    const pointerIn = pointer.x > a.x && pointer.x < a.x + a.w && pointer.y > a.y && pointer.y < a.y + a.h;
    if (mode === 'enter' && dist < 60) setMode('wander', wander());
    if ((mode === 'wander' || mode === 'read') && fresh && pointerIn && pDist < 280 && !carried) setMode('curious');
    if (mode === 'curious') {
      const ang = Math.atan2(pointer.y - head.y, pointer.x - head.x);
      target = inView({ x: pointer.x - Math.cos(ang) * 34, y: pointer.y - Math.sin(ang) * 34 }, 20);
      if (!fresh || !pointerIn || pDist > 420) setMode('wander', wander());
    }
    if (mode === 'flee' && (dist < 40 || time - modeAt > 1.4)) setMode('wander', wander());
    if (mode === 'wander') {
      if (dist < 24 || time - modeAt > 7) {
        // Every so often, go and read a word.
        const choices = time > nextRead ? words.filter((w) => w.text.length >= 4 && w.text.length <= 12 && w.y > a.y + 40 && w.y < a.y + a.h - 60 && /[a-z]/i.test(w.text)) : [];
        if (choices.length) {
          const w = choices[(Math.random() * choices.length) | 0];
          setMode('read', { x: w.x + w.w / 2, y: w.y + w.h / 2 });
          target.word = w;
        } else setMode('wander', wander());
      }
    }
    if (mode === 'read') {
      const w = target.word;
      if (dist < 16 && w && lift(w)) { nextRead = time + 9 + Math.random() * 6; setMode('carry', wander()); }
      else if (time - modeAt > 8) setMode('wander', wander());
    }
    if (carried && !carried.back && (mode === 'carry' ? time - modeAt > 2.6 : mode !== 'carry')) {
      // Done reading: the word flies home.
      const m = mouth();
      carried.back = { x: m.x, y: m.y, a: seg[0].a, t: 0 };
      if (mode === 'carry') setMode('wander', wander());
    }
    if (mode === 'carry' && dist < 24) target = wander();
    if (mode === 'leave' && seg.every((s) => s.x < a.x - 40 || s.x > a.x + a.w + 40 || s.y < a.y - 40 || s.y > a.y + a.h + 40)) stopNow();
  }

  function stepLegs(dt) {
    const stepTime = clamp(0.17 - speed * 0.00045, 0.07, 0.17);
    for (const leg of legs) {
      const s = seg[leg.i];
      const fx = Math.cos(s.a), fy = Math.sin(s.a);
      const rest = restOf(leg, seg);
      if (leg.t >= 1) {
        const far = Math.hypot(leg.foot.x - rest.x, leg.foot.y - rest.y) > leg.reach * 0.55;
        const calm = [legAt(leg.i - 1, leg.side), legAt(leg.i + 1, leg.side), legAt(leg.i, -leg.side)].every((n) => !n || n.t >= 1);
        if (far && calm) {
          const aim = { x: rest.x + fx * speed * 0.1, y: rest.y + fy * speed * 0.1 };
          const w = wordNear(aim.x, aim.y, 14);
          leg.to = w ? { x: clamp(aim.x, w.x + 2, w.x + w.w - 2), y: clamp(aim.y, w.y + w.h * 0.3, w.y + w.h * 0.8), word: w } : { ...aim, word: null };
          leg.from = { ...leg.foot }; leg.t = 0;
        }
      } else {
        leg.t = Math.min(1, leg.t + dt / stepTime);
        const k = ease(leg.t);
        leg.foot.x = leg.from.x + (leg.to.x - leg.from.x) * k;
        leg.foot.y = leg.from.y + (leg.to.y - leg.from.y) * k;
        if (leg.t >= 1) {
          // Landed: a word underfoot lights up (and the front feet tell the inspector what it is);
          // anywhere else, a frost print.
          const w = leg.to.word;
          if (w) { w.glow = 1; if (leg.i <= 2 && !carried) label = { tag: w.el.tagName.toLowerCase(), text: w.text, life: 1.2 }; }
          else if (prints.length < 140) prints.push({ x: leg.foot.x, y: leg.foot.y, life: 1 });
        }
      }
    }
  }

  const mouth = () => ({ x: seg[0].x + Math.cos(seg[0].a) * 13, y: seg[0].y + Math.sin(seg[0].a) * 13 });

  // ---------- Drawing ----------
  function draw(dt) {
    ctx.clearRect(0, 0, W, H);
    // Words that have been stood on: a mint highlight that fades.
    for (const w of words) {
      if (w.glow <= 0) continue;
      w.glow = Math.max(0, w.glow - dt / 1.8);
      ctx.beginPath(); ctx.roundRect(w.x - 3, w.y - 1, w.w + 6, w.h + 2, 4);
      ctx.fillStyle = `rgba(${MINT},${0.2 * w.glow})`; ctx.fill();
      ctx.strokeStyle = `rgba(${MINT},${0.75 * w.glow})`; ctx.lineWidth = 1; ctx.stroke();
    }
    // Frost prints.
    for (let i = prints.length - 1; i >= 0; i--) {
      const p = prints[i];
      p.life -= dt / 2.4;
      if (p.life <= 0) { prints.splice(i, 1); continue; }
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(225,248,240,${0.55 * p.life})`; ctx.fill();
    }
    const head = seg[0];
    drawCreature(ctx, seg, legs, { time, look: Math.atan2(target.y - head.y, target.x - head.x), curious: mode === 'curious' });
    // The word it's reading: held in its mouth, then flying home.
    if (carried) {
      let x, y, a, k = 0;
      if (carried.back) {
        carried.back.t = Math.min(1, carried.back.t + dt / 0.7);
        k = ease(carried.back.t);
        x = carried.back.x + (carried.home.x - carried.back.x) * k;
        y = carried.back.y + (carried.home.y - carried.back.y) * k;
        a = carried.back.a * (1 - k);
      } else {
        const m = mouth(); x = m.x; y = m.y; a = head.a + Math.sin(time * 6) * 0.08;
      }
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.font = carried.font;
      const tw = ctx.measureText(carried.text).width;
      const dx = carried.back ? -tw / 2 * (1 - k) : 2;   // held by its first letter; lands left-aligned
      ctx.beginPath(); ctx.roundRect(dx - 4, -carried.h * 0.8, tw + 8, carried.h + 2, 4);
      ctx.fillStyle = `rgba(11,26,31,${0.75 * (1 - k)})`; ctx.fill();
      ctx.strokeStyle = `rgba(${MINT},${0.9 * (1 - k)})`; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = carried.back ? carried.color : `rgb(${MINT})`;
      ctx.fillText(carried.text, dx, 0);
      ctx.restore();
      if (carried.back && carried.back.t >= 1) putBack();
    }
    // The inspector: a little tag beside the head naming what it's standing on, like a DOM
    // inspector reading the page.
    if (label && label.life > 0) {
      label.life -= dt;
      const o = Math.min(1, label.life * 2);
      const fx = Math.cos(head.a), fy = Math.sin(head.a);
      const lx = head.x - fy * 34 + 10, ly = head.y + fx * 34 - 14;
      ctx.strokeStyle = `rgba(${MINT},${0.5 * o})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(head.x, head.y); ctx.lineTo(lx - 4, ly + 4); ctx.stroke();
      ctx.font = '500 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      const t = `<${label.tag}> “${label.text.slice(0, 18)}”`;
      const tw = ctx.measureText(t).width;
      ctx.fillStyle = `rgba(11,26,31,${0.85 * o})`; ctx.beginPath(); ctx.roundRect(lx - 5, ly - 11, tw + 10, 16, 4); ctx.fill();
      ctx.fillStyle = `rgba(${MINT},${o})`; ctx.fillText(t, lx, ly);
    }
  }

  // ---------- Loop ----------
  let indexClock = 0;
  function frame(now) {
    raf = 0;
    if (document.hidden || !active) { last = 0; return; }
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
    last = now; time += dt;
    indexClock -= dt;
    if (indexClock <= 0) { indexWords(); indexClock = 1.2; }   // the page can change under it
    const dist = steer(dt);
    think(dist);
    if (!active) return;
    stepLegs(dt);
    draw(dt);
    raf = requestAnimationFrame(frame);
  }
  function size() {
    W = innerWidth; H = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // In from an edge of its area (the left, two thirds of the way down, or the top, in the
  // middle); out by the nearest edge.
  function release({ from = 'left' } = {}) {
    if (active && mode !== 'leave') return;
    active = true; size();
    const a = A();
    if (from === 'top') {
      const x = a.x + a.w * 0.5;
      seg.forEach((s, i) => { s.x = x; s.y = a.y - 24 - i * GAP; s.a = Math.PI / 2; });
      setMode('enter', { x, y: a.y + Math.min(a.h * 0.3, 220) });
    } else {
      const y = a.y + a.h * 0.66;
      seg.forEach((s, i) => { s.x = a.x - 24 - i * GAP; s.y = y; s.a = 0; });
      setMode('enter', { x: a.x + Math.min(a.w * 0.3, 360), y });
    }
    legs.forEach((l) => { l.foot = restOf(l, seg); l.t = 1; });
    indexWords();
    speed = 0; prints.length = 0; label = null; nextRead = time + 4;
    canvas.classList.add('is-on');
    setToggle(true);
    status.textContent = 'A crawler is exploring the page.';
    last = 0; if (!raf) raf = requestAnimationFrame(frame);
  }
  function recall() {
    if (!active) return;
    const h = seg[0], a = A();
    const exits = [{ x: a.x - 260, y: h.y, d: h.x - a.x }, { x: a.x + a.w + 260, y: h.y, d: a.x + a.w - h.x }, { x: h.x, y: a.y - 260, d: h.y - a.y }, { x: h.x, y: a.y + a.h + 260, d: a.y + a.h - h.y }];
    const out = exits.sort((p, q) => p.d - q.d)[0];
    if (carried && !carried.back) { const m = mouth(); carried.back = { x: m.x, y: m.y, a: h.a, t: 0 }; }
    setMode('leave', out);
    setToggle(false);
  }
  function stopNow() {
    active = false; putBack(true);
    canvas.classList.remove('is-on'); ctx.clearRect(0, 0, W, H);
    words.forEach((w) => (w.glow = 0));
    setToggle(false);
    status.textContent = 'The crawler has gone.';
  }
  toggle?.addEventListener('click', () => {
    if (!active) release();
    else if (mode === 'leave') { setMode('wander', wander()); setToggle(true); }   // changed your mind: it turns around
    else recall();
  });
  size();
  // ?debug exposes its state for testing.
  if (/[?&]debug\b/.test(location.search)) window.__crawler = { seg, get mode() { return mode; }, get target() { return target; }, get carried() { return carried; }, get words() { return words; }, get time() { return time; }, get nextRead() { return nextRead; } };
  return { release, recall, stop: stopNow, get active() { return active; } };
}
