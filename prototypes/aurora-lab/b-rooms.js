// The rooms around the frozen lake, after kiabai.me: the page stays one place, and the view pans
// off the lake onto its snowy shores. About is on the north shore (b-about.js); the projects are on
// the east shore (b-work.js). Each room has its own address (#/about, #/work/<id>), so Back,
// reloads and shared links work, and the lake rests while the view is up on a shore. The
// playground (b-play.js) is on the south shore: the 3D studio itself (#/playground, through the
// basketball under the ice) with the crawler's notes below it (#/playground/crawler, through the
// crawler frozen in the ice).
import { aboutRoom } from './b-about.js';
import { workRoom, WORK_IDS } from './b-work.js';
import { playRoom } from './b-play.js';

export const TRAVEL = 800; // ms: the pan. It sets --mo-travel, which every room's CSS moves by.

// hero: the lake page's hero (it moves with the lake). lake: what the lake does as the view leaves
// it (leaving), once it's up on a shore (arrived) and as it starts back (returning); leaving and
// returning are told whether the move is instant.
export function mountLakeRooms(hero, lake = {}) {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  root.style.setProperty('--mo-travel', TRAVEL + 'ms');
  const ctx = { hero, reduced, travel: TRAVEL, home: () => backHome() };
  const rooms = { north: aboutRoom(ctx), east: workRoom(ctx), south: playRoom(ctx) };
  let current = null, timer = 0;

  const parse = (hash) => {
    if (hash === '#/about') return { side: 'north' };
    if (hash === '#/playground') return { side: 'south' };
    if (hash === '#/playground/crawler') return { side: 'south', id: 'crawler' };
    const m = hash.match(/^#\/work\/([\w-]+)$/);
    return m && WORK_IDS.includes(m[1]) ? { side: 'east', id: m[1] } : null;
  };
  const fit = () => Object.values(rooms).forEach((r) => r.fit());

  function go(route, instant = false) {
    const quick = instant || reduced.matches;
    clearTimeout(timer);
    root.classList.toggle('lake-room-instant', quick);
    if (!route) {
      if (!current) return;
      const was = rooms[current.side];
      current = null;
      delete root.dataset.room; hero.inert = false;
      was.hide();
      lake.returning?.(quick);
      timer = setTimeout(() => {
        Object.values(rooms).forEach((r) => r.park());
        root.classList.remove('in-lake-room');
        was.returnFocus();
      }, quick ? 0 : TRAVEL);
      return;
    }
    const room = rooms[route.side];
    // Another project on the same shore: no pan, the room swaps what it shows.
    if (current && current.side === route.side) { current = route; room.show(route, quick, true); return; }
    const from = current;
    if (!from) {
      if (scrollY > 0) scrollTo(0, 0);
      root.classList.add('in-lake-room'); hero.inert = true;
      lake.leaving?.(quick);
    } else rooms[from.side].hide();
    current = route;
    fit();
    room.show(route, quick, false);
    room.root.getBoundingClientRect(); // let the shore start out of view before it moves
    root.dataset.room = route.side;
    timer = setTimeout(() => {
      if (!from) lake.arrived?.();
      for (const side in rooms) if (side !== route.side) rooms[side].park();
      room.arrived();
    }, quick ? 0 : TRAVEL);
  }

  // How many room entries this page has stacked on top of the lake, kept in each entry's history
  // state so Back and Forward know it too. "Back to the lake" unwinds them, so Back then doesn't
  // land you on a shore again.
  // (If the page was opened straight into a room, the bottom entry is itself a room; unwinding to
  // it then clears its address too.)
  function depth() { return history.state?.roomDepth ?? 0; }
  let homing = false;
  function backHome() {
    const d = depth();
    if (d > 0) { homing = true; history.go(-d); return; }
    history.replaceState(null, '', location.pathname + location.search);
    go(null);
  }
  let known = depth();
  addEventListener('hashchange', () => {
    const route = parse(location.hash);
    if (homing && history.state?.roomDepth === 0) {
      homing = false;
      if (route) { history.replaceState(null, '', location.pathname + location.search); known = 0; go(null); return; }
    }
    if (history.state?.roomDepth == null) {
      // A new entry: one deeper than where it came from (or none, off the shores).
      known = route ? known + 1 : 0;
      history.replaceState({ ...history.state, roomDepth: known }, '');
    } else known = history.state.roomDepth;
    go(route);
  });
  document.addEventListener('keydown', (e) => { if (current && e.key === 'Escape') { e.preventDefault(); backHome(); } });
  addEventListener('resize', () => { if (current) fit(); });

  fit();
  const first = parse(location.hash);
  if (first) { history.replaceState({ ...history.state, roomDepth: 0 }, ''); known = 0; go(first, true); }
}
