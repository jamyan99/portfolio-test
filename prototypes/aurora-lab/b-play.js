// The playground room, on the frozen lake's south shore (b-rooms.js pans the view down to it).
// The lake slides up until only its bottom edge is left, as the dock, and the room below it IS
// the playground: the 3D studio from the Playground page (prototypes/hero-lab/7-character.js),
// mounted here, inside this room's own container, with no page of its own in between. The way in
// is the basketball under the ice (#/playground). The crawler frozen in the ice has the same
// shore to itself (#/playground/crawler): only the notes it climbs out onto and reads
// (prototypes/crawler/crawler.js); that text is J's to write, so every block is a marked TODO.
// The room shows one or the other, never both: the playground has no crawler in it, and the
// crawler's notes have no studio (room.dataset.view, b-play.css).
//
// The scene loads once, the first time the room is reached, and is then only rested and woken:
// leaving stops its frames, physics and input, and coming back finds everything where it was.
import { mountCrawler } from '../crawler/crawler.js';

const ROOT = '../../';
const SCENE = '../hero-lab/7-character.js?v=lake2';
// What the scene will ask for, fetched quietly while the visitor is still on the lake.
const WARM = ['studio.glb?v=10', 'character.glb?v=8', 'ball.glb?v=9', 'character-events.json?v=8'];
const icon = (path, size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true">${path}</svg>`;
// What J might write in each block (prompts only; the boxes say they're J's to write).
const TODO = (what, tag = 'p') => `<!-- TODO: J to write --><${tag} class="todo play-todo">J to write · ${what}</${tag}>`;

// The studio's parts are found by data-pg (the scene module looks them up inside this room only).
// Heading and intro are the Playground page's own.
const ROOM = `
<div class="play-room__field shore">
  <div class="play-scroll" tabindex="-1">
    <section class="pg" data-pg="hero" data-theme="dark" tabindex="-1" aria-labelledby="play-title" aria-describedby="pg-hint">
      <div class="pg-stage" data-pg="stage">
        <button class="pg-play" data-pg="play" type="button" aria-label="Play interactive scene" hidden><span aria-hidden="true">▶</span> Play</button>
        <button class="pg-hit pg-hit--character" data-pg="character-hit" type="button" aria-label="Take a play break" hidden></button>
        <button class="pg-hit pg-hit--ball" data-pg="ball-hit" type="button" aria-label="Drag to aim a shot, or press Space to shoot" hidden></button>
        <button class="pg-hit pg-hit--laptop" data-pg="laptop-hit" type="button" aria-label="Show the next real project on the laptop" hidden></button>
        <button class="pg-hit pg-lamp" data-pg="lamp-hit" type="button" role="switch" aria-checked="true" aria-label="Switch the studio to daylight" hidden><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6m-5 3h4M8 14c-4-5-1-11 4-11s8 6 4 11l-1 2H9z"/></svg></button>
        <div class="pg-status" data-pg="status" role="status" aria-live="polite">Preparing the playground</div>
        <div class="pg-controls" data-pg="controls" hidden>
          <div class="pg-moves" role="group" aria-label="Scene controls">
            <button class="pg-primary" type="button" data-pg="take-break">Take a break ${icon('<path d="M3 10h13m-5-5 5 5-5 5"/>')}</button>
            <div class="pg-court" data-pg="court-moves" role="group" aria-label="Playground actions" hidden>
              <button type="button" data-action="Dribble" aria-keyshortcuts="E">Dribble</button>
              <button type="button" data-action="Ball_Spin" aria-keyshortcuts="Q">Spin</button>
              <button class="pg-primary" type="button" data-action="Jump_Shot" aria-keyshortcuts="Space">Shoot ${icon('<path d="M4 15 15 4M5 4h10v10"/>', 15)}</button>
              <button class="pg-icon" type="button" data-pg="return-desk" aria-label="Return to the desk">${icon('<path d="m8 4-5 5 5 5M4 9h8a4 4 0 0 1 0 8"/>', 17)}</button>
            </div>
            <button class="pg-icon" type="button" data-pg="pause" aria-label="Pause scene" aria-pressed="false">${icon('<path d="M7 4v12M13 4v12"/>', 18)}</button>
          </div>
          <p class="pg-hint" data-pg="control-hint" id="pg-hint">WASD/arrows run · tap floor · E/Q/Space · Shift+arrows aim</p>
        </div>
        <div class="pg-pad" data-pg="direction-pad" role="group" aria-label="Move the character" aria-describedby="pg-hint" hidden>
          <button type="button" data-move="ArrowUp" aria-label="Move forward" aria-keyshortcuts="W ArrowUp" aria-pressed="false">${icon('<path d="M10 16V4m-5 5 5-5 5 5"/>', 20)}</button>
          <button type="button" data-move="ArrowLeft" aria-label="Move left" aria-keyshortcuts="A ArrowLeft" aria-pressed="false">${icon('<path d="M16 10H4m5 5-5-5 5-5"/>', 20)}</button>
          <button type="button" data-move="ArrowDown" aria-label="Move back" aria-keyshortcuts="S ArrowDown" aria-pressed="false">${icon('<path d="M10 4v12m-5-5 5 5 5-5"/>', 20)}</button>
          <button type="button" data-move="ArrowRight" aria-label="Move right" aria-keyshortcuts="D ArrowRight" aria-pressed="false">${icon('<path d="M4 10h12m-5-5 5 5-5 5"/>', 20)}</button>
        </div>
        <div class="pg-aim" data-pg="aim-indicator" hidden aria-hidden="true"><i></i></div>
      </div>
      <header class="pg-copy">
        <p class="work-eyebrow">Playground</p>
        <h2 id="play-title">Room to <em>explore.</em></h2>
        <p class="pg-intro">An interactive corner of my portfolio. Explore the studio, try a move, and follow your curiosity.</p>
      </header>
    </section>
    <article class="play-article" id="play-notes" aria-labelledby="play-notes-title">
      <p class="work-eyebrow">Crawler</p>
      <!-- TODO: J to write --><h2 class="todo play-todo play-todo--title" id="play-notes-title" tabindex="-1">J to write · title</h2>
      ${TODO('intro: two or three sentences on what this corner of the lake is for and what to try in it')}
      <div class="play-cols">
        <section>${TODO('heading', 'h3')}${TODO('about the crawler: what it is, where the idea came from, and how it moves, in a short paragraph')}</section>
        <section>${TODO('heading', 'h3')}${TODO('how you built it: the tools, the tricky part, and what you would change, in a short paragraph')}</section>
        <section>${TODO('heading', 'h3')}${TODO('what you learned making it, in a short paragraph')}</section>
        <section>${TODO('heading', 'h3')}${TODO('other experiments you want to show here, as a short list or paragraph')}</section>
      </div>
    </article>
  </div>
</div>
<nav class="play-dock" aria-label="Playground">
  <button class="room-back" type="button" data-back><svg class="room-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>Back to the lake</button>
  <button class="room-back play-crawler" type="button" aria-pressed="false"><span class="crawler-toggle__glyph" aria-hidden="true"><i></i><i></i><i></i></span><span>Release a crawler</span></button>
</nav>`;

export function playRoom({ reduced, home }) {
  const root = document.documentElement;
  const sideways = matchMedia('(min-width: 761px) and (min-height: 560px)');
  const room = document.createElement('div');
  room.className = 'play-room'; room.id = 'play-room'; room.hidden = true; room.inert = true;
  room.setAttribute('aria-label', 'Playground');
  room.innerHTML = ROOM;
  document.body.append(room);
  const scroller = room.querySelector('.play-scroll');
  const pg = room.querySelector('.pg'), stage = room.querySelector('.pg-stage');
  const notes = room.querySelector('#play-notes'), notesTitle = room.querySelector('#play-notes-title');
  const status = room.querySelector('[data-pg="status"]'), playButton = room.querySelector('[data-pg="play"]');
  room.querySelector('[data-back]').addEventListener('click', home);

  // Where the room is: open (shown), settled (the view has stopped on it), and which of its two
  // faces the address asked for: 'studio' (the playground) or 'notes' (the crawler).
  let open = false, settled = false, view = 'studio', timers = [];

  // ---- The studio ----
  let scene = null, mounting = null, module = null, unavailable = false;
  const fetchScene = () => (module ??= import(SCENE));
  function mountScene(explicit = false) {
    if (scene || mounting || unavailable) return mounting;
    playButton.hidden = true;
    pg.classList.add('is-loading');
    mounting = fetchScene()
      .then((m) => m.mount({ container: room, embedded: true, explicit }))
      .then((api) => {
        scene = api; pg.classList.remove('is-loading');
        // Reached while the room was already being left again (or showing the crawler): it
        // starts out resting.
        if (!open || view !== 'studio') scene.setActive(false);
      })
      .catch((error) => {
        console.error('Playground load:', error);
        unavailable = true; pg.classList.remove('is-loading'); pg.classList.add('is-unavailable');
        status.textContent = '3D unavailable · Play opens the original video';
        playButton.hidden = false;
      });
    return mounting;
  }
  // Motion off: nothing starts by itself; Play does. No 3D: Play shows the studio's video instead.
  playButton.addEventListener('click', async () => {
    if (!unavailable) { mountScene(true); return; }
    const video = document.createElement('video');
    video.src = `${ROOT}assets/video/hero-loop.mp4`; video.poster = `${ROOT}assets/img/hero-poster.webp`;
    video.muted = true; video.playsInline = true; video.controls = true; video.loop = true; video.className = 'pg-video';
    stage.append(video); playButton.hidden = true;
    await video.play().catch(() => { playButton.hidden = false; });
    document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); });
    new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) video.pause(); }).observe(video);
  });
  function startScene() {
    if (scene || mounting || unavailable) return;
    if (reduced.matches) { status.textContent = 'Motion is off · Play to explore'; playButton.hidden = false; return; }
    mountScene(false);
  }
  // While the visitor is still on the lake and the page is idle: fetch what the studio needs, so
  // the first trip down finds it in the cache. (Not on a data-saving connection.)
  function warm() {
    if (navigator.connection?.saveData || reduced.matches) return;
    const add = (rel, href, as) => { const link = document.createElement('link'); link.rel = rel; link.href = href; if (as) link.as = as; document.head.append(link); };
    add('modulepreload', new URL(SCENE, import.meta.url).href);
    for (const file of WARM) add('prefetch', new URL(`../hero-lab/7-assets/${file}`, import.meta.url).href, 'fetch');
  }
  if (document.readyState === 'complete') setTimeout(warm, 2500);
  else addEventListener('load', () => (window.requestIdleCallback ?? ((run) => setTimeout(run, 2500)))(warm, { timeout: 6000 }), { once: true });

  // ---- The crawler: only in its own view, on its notes ----
  const crawler = mountCrawler({
    root: notes,
    area: () => { const s = scroller.getBoundingClientRect(); return { x: s.left, y: s.top + 56, w: s.width, h: s.height - 56 }; },
    toggle: false,
  });
  const toggle = room.querySelector('.play-crawler');
  let wanted = true; // it comes out by itself on arriving; the button puts it away and lets it out again
  const setToggle = (out) => { toggle.setAttribute('aria-pressed', String(out)); toggle.lastElementChild.textContent = out ? 'Put it away' : 'Release a crawler'; };
  function syncCrawler() {
    const out = wanted && view === 'notes' && settled;
    if (out) crawler.release({ from: 'top' }); // (does nothing if it is already out; turns it round if it was leaving)
    else if (crawler.active) crawler.stop();
    setToggle(out); // the button says what is true on screen: it is out, or it can be let out
  }
  toggle.addEventListener('click', () => {
    if (wanted && crawler.active) { wanted = false; crawler.recall(); setToggle(false); return; }
    wanted = true; syncCrawler();
  });

  // Which face the room shows. The other one is not in the layout at all (b-play.css), so the
  // playground never has the crawler under it, and the crawler's notes never have the studio.
  function face(next) {
    view = next;
    room.dataset.view = view;
    room.setAttribute('aria-label', view === 'notes' ? 'Crawler' : 'Playground');
    scroller.scrollTop = 0;
    // The studio only runs while it is the face on show; otherwise it rests where it was left.
    scene?.setActive(view === 'studio');
    if (view !== 'notes' && crawler.active) crawler.stop();
  }

  // The view has stopped on the room (or the address changed while already in it).
  function settle() {
    settled = true;
    if (view === 'notes') {
      notesTitle.focus({ preventScroll: true });
      wanted = true;
      timers.push(setTimeout(syncCrawler, reduced.matches ? 0 : 250));
    } else {
      // Keys go to the studio straight away.
      pg.focus({ preventScroll: true });
      startScene();
    }
  }

  return {
    root: room,
    // How far the view pans: everything but the dock's strip of lake.
    fit() {
      const dock = sideways.matches ? 112 : 70;
      root.style.setProperty('--play-dock', dock + 'px');
      root.style.setProperty('--play-pan', (innerHeight - dock) + 'px');
    },
    // same: already in this room, and the address moved between the playground and the crawler
    // (Back/Forward, or a typed address): the room swaps its face where it stands.
    show(route, quick, same) {
      timers.forEach(clearTimeout); timers = [];
      room.hidden = false; room.inert = false; open = true;
      // Already loaded, the studio is live again as the view comes down. Not yet: it is fetched
      // (from the cache warmed earlier) and built once the view has stopped, so the pan itself
      // stays smooth; starting it during the pan cost a couple of dropped frames.
      face(route.id === 'crawler' ? 'notes' : 'studio');
      if (same) { settle(); return; }
      settled = false;
    },
    arrived() { settle(); },
    // Leaving: nothing in the room takes input (it is inert), and the crawler goes. The studio
    // keeps drawing while the view pans away, then rests (park).
    hide() { timers.forEach(clearTimeout); timers = []; room.inert = true; open = false; settled = false; syncCrawler(); },
    park() { if (room.inert) { room.hidden = true; scene?.setActive(false); } },
    returnFocus() { document.querySelector(`.under a[href="${view === 'notes' ? '#/playground/crawler' : '#/playground'}"]`)?.focus({ preventScroll: true }); },
  };
}
