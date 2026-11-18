// Pure floor-plane routing around the modeled studio furniture. These are
// character-centre limits; the room's rear cove is deliberately excluded.
export const CHARACTER_CLEARANCE = .315; // .28 m body + .035 m breathing room
export const ROOM_BOUNDS = Object.freeze({ minX: -4.65, maxX: 4.65, minZ: -3.10, maxZ: 3.15 });
export const ROOM_WALLS = Object.freeze([
  { id: 'room-back', minX: -4.65, maxX: -.65, minZ: -3.41, maxZ: -3.29 },
  { id: 'room-left', minX: -4.71, maxX: -4.59, minZ: -3.35, maxZ: 3.5 },
].map(Object.freeze));
export const ROOM_DIVIDER = Object.freeze({ x: -.65, halfThickness: .06, bottomY: 0,
  openingZ: Object.freeze([-.705, .745]), openingHeight: 2.5, wallHeight: 3.2,
  rangeZ: Object.freeze([-3.35, 3.5]), walls: ROOM_WALLS });
export const FOOTPRINTS = Object.freeze([
  Object.freeze({ id: 'hoop-base', type: 'circle', x: 2.7, z: -2.87, radius: .375 }),
  Object.freeze({ id: 'plant-pot', type: 'circle', x: 4.17, z: -2.25, radius: .37 }),
  Object.freeze({ id: 'desk', type: 'rect', minX: -2.975, maxX: -1.025, minZ: .37, maxZ: 1.23 }),
  Object.freeze({ id: 'chair', type: 'circle', x: -2, z: 0, radius: .34 }),
  ...ROOM_WALLS.map(wall => Object.freeze({ type: 'rect', ...wall })),
  ...[[ROOM_DIVIDER.rangeZ[0], ROOM_DIVIDER.openingZ[0]], [ROOM_DIVIDER.openingZ[1], ROOM_DIVIDER.rangeZ[1]]]
    .map(([minZ, maxZ], i) => Object.freeze({ id: `room-divider-${i}`, type: 'rect',
      minX: ROOM_DIVIDER.x - ROOM_DIVIDER.halfThickness, maxX: ROOM_DIVIDER.x + ROOM_DIVIDER.halfThickness, minZ, maxZ })),
]);
const EPS = 1e-8, NODE_MARGIN = .01, CIRCLE_SIDES = 24;
const cache = new Map();
const point = value => value && Number.isFinite(value.x) && Number.isFinite(value.z)
  ? { x: value.x, z: value.z } : null;
const validClearance = value => Number.isFinite(value) && value >= 0 && value <= 2;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const insideRoom = p => p.x >= ROOM_BOUNDS.minX - EPS && p.x <= ROOM_BOUNDS.maxX + EPS
  && p.z >= ROOM_BOUNDS.minZ - EPS && p.z <= ROOM_BOUNDS.maxZ + EPS;

function contains(p, obstacle, clearance) {
  if (obstacle.type === 'circle') return distance(p, obstacle) < obstacle.radius + clearance - EPS;
  return p.x > obstacle.minX - clearance + EPS && p.x < obstacle.maxX + clearance - EPS
    && p.z > obstacle.minZ - clearance + EPS && p.z < obstacle.maxZ + clearance - EPS;
}

function clearPoint(p, clearance, ignoreChair) {
  return insideRoom(p) && FOOTPRINTS.every(o => ignoreChair && o.id === 'chair' || !contains(p, o, clearance));
}

export function isCourtPositionClear(value, { clearance = CHARACTER_CLEARANCE, ignoreChair = false } = {}) {
  const p = point(value);
  return !!p && validClearance(clearance) && clearPoint(p, clearance, ignoreChair);
}

function segmentHits(a, b, obstacle, clearance) {
  const dx = b.x - a.x, dz = b.z - a.z;
  if (obstacle.type === 'circle') {
    const squared = dx * dx + dz * dz;
    const t = squared > EPS * EPS
      ? Math.max(0, Math.min(1, ((obstacle.x - a.x) * dx + (obstacle.z - a.z) * dz) / squared)) : 0;
    return Math.hypot(a.x + t * dx - obstacle.x, a.z + t * dz - obstacle.z) < obstacle.radius + clearance - EPS;
  }
  // Clip against the strict interior of the expanded rectangle. Exact tangency
  // is valid, while graph nodes retain an additional centimetre of clearance.
  let low = 0, high = 1;
  for (const [origin, delta, minimum, maximum] of [
    [a.x, dx, obstacle.minX - clearance + EPS, obstacle.maxX + clearance - EPS],
    [a.z, dz, obstacle.minZ - clearance + EPS, obstacle.maxZ + clearance - EPS],
  ]) {
    if (Math.abs(delta) < EPS) { if (origin < minimum || origin > maximum) return false; }
    else {
      let enter = (minimum - origin) / delta, leave = (maximum - origin) / delta;
      if (enter > leave) [enter, leave] = [leave, enter];
      low = Math.max(low, enter); high = Math.min(high, leave);
      if (low > high) return false;
    }
  }
  return high >= 0 && low <= 1;
}

function clearSegment(a, b, clearance, ignoreChair) {
  return FOOTPRINTS.every(o => ignoreChair && o.id === 'chair' || !segmentHits(a, b, o, clearance));
}

function prepare(clearance, ignoreChair) {
  const key = `${clearance}:${ignoreChair}`;
  if (cache.has(key)) return cache.get(key);
  const nodes = [];
  for (const obstacle of FOOTPRINTS) {
    if (ignoreChair && obstacle.id === 'chair') continue;
    if (obstacle.type === 'circle') {
      // Circumscribed polygon: every adjacent chord clears the true circle.
      const radius = (obstacle.radius + clearance) / Math.cos(Math.PI / CIRCLE_SIDES) + NODE_MARGIN;
      for (let i = 0; i < CIRCLE_SIDES; i++) {
        const angle = i * Math.PI * 2 / CIRCLE_SIDES;
        nodes.push({ x: obstacle.x + radius * Math.cos(angle), z: obstacle.z + radius * Math.sin(angle) });
      }
    } else {
      for (const x of [obstacle.minX - clearance - NODE_MARGIN, obstacle.maxX + clearance + NODE_MARGIN]) {
        for (const z of [obstacle.minZ - clearance - NODE_MARGIN, obstacle.maxZ + clearance + NODE_MARGIN]) nodes.push({ x, z });
      }
    }
  }
  const vertices = nodes.filter(p => clearPoint(p, clearance, ignoreChair));
  const edges = vertices.map(() => []);
  for (let i = 0; i < vertices.length; i++) for (let j = i + 1; j < vertices.length; j++) {
    if (!clearSegment(vertices[i], vertices[j], clearance, ignoreChair)) continue;
    const cost = distance(vertices[i], vertices[j]);
    edges[i].push({ to: j, cost }); edges[j].push({ to: i, cost });
  }
  const graph = { vertices, edges };
  cache.set(key, graph);
  return graph;
}

/** Waypoints exclude start and include goal; null means no safe floor route. */
export function planCourtRoute(startValue, goalValue, { clearance = CHARACTER_CLEARANCE } = {}) {
  const start = point(startValue), goal = point(goalValue);
  if (!start || !goal || !validClearance(clearance)) return null;
  const chair = FOOTPRINTS.find(o => o.id === 'chair');
  // Sitting/standing begins or ends inside the chair. Only that obstacle is
  // exempted; the desk, hoop, plant and room limits remain enforced.
  const ignoreChair = contains(start, chair, clearance) || contains(goal, chair, clearance);
  if (!clearPoint(start, clearance, ignoreChair) || !clearPoint(goal, clearance, ignoreChair)) return null;
  if (clearSegment(start, goal, clearance, ignoreChair)) return [goal];

  const base = prepare(clearance, ignoreChair);
  const vertices = [...base.vertices, start, goal], begin = vertices.length - 2, end = vertices.length - 1;
  const edges = [...base.edges.map(list => [...list]), [], []];
  for (const from of [begin, end]) for (let to = 0; to < base.vertices.length; to++) {
    if (!clearSegment(vertices[from], vertices[to], clearance, ignoreChair)) continue;
    const cost = distance(vertices[from], vertices[to]);
    edges[from].push({ to, cost }); edges[to].push({ to: from, cost });
  }
  const costs = vertices.map(() => Infinity), previous = vertices.map(() => -1), visited = new Set();
  costs[begin] = 0;
  for (;;) {
    let current = -1;
    for (let i = 0; i < costs.length; i++) if (!visited.has(i) && (current < 0 || costs[i] < costs[current])) current = i;
    if (current < 0 || !Number.isFinite(costs[current])) return null;
    if (current === end) break;
    visited.add(current);
    for (const edge of edges[current]) {
      const next = costs[current] + edge.cost;
      if (next < costs[edge.to]) { costs[edge.to] = next; previous[edge.to] = current; }
    }
  }
  const waypoints = [];
  for (let i = end; i !== begin; i = previous[i]) {
    if (i < 0) return null;
    waypoints.push({ ...vertices[i] });
  }
  return waypoints.reverse();
}

/** Solve an actual pickup root from the authored local socket offset. */
export function findPickupApproach(ballValue, startValue, localOffset, { clearance = CHARACTER_CLEARANCE } = {}) {
  const ball = point(ballValue), start = point(startValue);
  const local = point(Array.isArray(localOffset) ? { x: localOffset[0], z: localOffset[2] } : localOffset);
  if (!ball || !start || !local || !validClearance(clearance) || Math.hypot(local.x, local.z) < .01) return null;
  // A floor ball under the desk/in a pot is not an ordinary reachable pickup.
  if (FOOTPRINTS.some(o => contains(ball, o, 0))) return null;
  const heading = Math.atan2(ball.x - start.x, ball.z - start.z);
  let best = null, shortest = Infinity;
  for (let i = 0; i < 48; i++) {
    const yaw = heading + i * Math.PI * 2 / 48, c = Math.cos(yaw), s = Math.sin(yaw);
    const position = { x: ball.x - c * local.x - s * local.z, z: ball.z + s * local.x - c * local.z };
    if (!isCourtPositionClear(position, { clearance })) continue;
    const waypoints = planCourtRoute(start, position, { clearance });
    if (!waypoints) continue;
    let length = 0, prior = start;
    for (const p of waypoints) { length += distance(prior, p); prior = p; }
    if (length < shortest) { shortest = length; best = { position, yaw, waypoints }; }
  }
  return best;
}

function sweepCircle(p, d, obstacle, clearance) {
  const x = p.x - obstacle.x, z = p.z - obstacle.z, radius = obstacle.radius + clearance;
  const a = d.x * d.x + d.z * d.z;
  if (a < EPS * EPS) return null;
  const b = 2 * (x * d.x + z * d.z), c = x * x + z * z - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const entry = (-b - Math.sqrt(discriminant)) / (2 * a);
  if (entry < -EPS || entry > 1 + EPS) return null;
  const t = Math.max(0, Math.min(1, entry));
  const nx = x + t * d.x, nz = z + t * d.z, length = Math.hypot(nx, nz);
  if (length < EPS) return null;
  const normal = { x: nx / length, z: nz / length };
  return d.x * normal.x + d.z * normal.z < -EPS ? { t, normal } : null;
}

function sweepRect(p, d, obstacle, clearance) {
  let low = -Infinity, high = Infinity, normal = null;
  for (const [origin, delta, minimum, maximum, lowNormal, highNormal] of [
    [p.x, d.x, obstacle.minX - clearance, obstacle.maxX + clearance, { x: -1, z: 0 }, { x: 1, z: 0 }],
    [p.z, d.z, obstacle.minZ - clearance, obstacle.maxZ + clearance, { x: 0, z: -1 }, { x: 0, z: 1 }],
  ]) {
    if (Math.abs(delta) < EPS) { if (origin < minimum || origin > maximum) return null; }
    else {
      let enter = (minimum - origin) / delta, leave = (maximum - origin) / delta;
      let enteredNormal = lowNormal;
      if (enter > leave) { [enter, leave] = [leave, enter]; enteredNormal = highNormal; }
      if (enter > low) { low = enter; normal = enteredNormal; }
      high = Math.min(high, leave);
      if (low > high) return null;
    }
  }
  if (low < -EPS || low > 1 + EPS || !normal) return null;
  return d.x * normal.x + d.z * normal.z < -EPS ? { t: Math.max(0, Math.min(1, low)), normal } : null;
}

function sweepRoom(p, d) {
  let hit = null;
  for (const [origin, delta, minimum, maximum, lowNormal, highNormal] of [
    [p.x, d.x, ROOM_BOUNDS.minX, ROOM_BOUNDS.maxX, { x: 1, z: 0 }, { x: -1, z: 0 }],
    [p.z, d.z, ROOM_BOUNDS.minZ, ROOM_BOUNDS.maxZ, { x: 0, z: 1 }, { x: 0, z: -1 }],
  ]) {
    const boundary = delta < -EPS && origin + delta < minimum ? minimum
      : delta > EPS && origin + delta > maximum ? maximum : null;
    if (boundary === null) continue;
    const t = (boundary - origin) / delta;
    if (!hit || t < hit.t) hit = { t, normal: delta < 0 ? lowNormal : highNormal };
  }
  return hit;
}

/** Swept manual movement with tangent sliding; no chair exception in play. */
export function constrainCourtStep(startValue, desiredValue, { clearance = CHARACTER_CLEARANCE } = {}) {
  const start = point(startValue), desired = point(desiredValue);
  if (!start || !desired) throw TypeError('Court movement requires finite x/z points');
  if (!validClearance(clearance)) throw RangeError('Invalid character clearance');
  if (!clearPoint(start, clearance, false)) return { position: start, blocked: true };
  const total = { x: desired.x - start.x, z: desired.z - start.z }, length = Math.hypot(total.x, total.z);
  if (!Number.isFinite(length) || length > 50) return { position: start, blocked: true };
  const slices = Math.max(1, Math.ceil(length / .13)), step = { x: total.x / slices, z: total.z / slices };
  let position = { ...start }, blocked = false, normal;
  for (let i = 0; i < slices; i++) {
    let remaining = { ...step };
    for (let pass = 0; pass < 3; pass++) {
      let hit = sweepRoom(position, remaining);
      for (const obstacle of FOOTPRINTS) {
        const candidate = obstacle.type === 'circle'
          ? sweepCircle(position, remaining, obstacle, clearance) : sweepRect(position, remaining, obstacle, clearance);
        if (candidate && (!hit || candidate.t < hit.t)) hit = candidate;
      }
      if (!hit) { position.x += remaining.x; position.z += remaining.z; break; }
      blocked = true; normal = hit.normal;
      const moveLength = Math.hypot(remaining.x, remaining.z);
      const beforeContact = Math.max(0, hit.t - .00001 / Math.max(EPS, moveLength));
      position.x += remaining.x * beforeContact; position.z += remaining.z * beforeContact;
      remaining.x *= 1 - hit.t; remaining.z *= 1 - hit.t;
      const inward = remaining.x * normal.x + remaining.z * normal.z;
      if (inward < 0) { remaining.x -= normal.x * inward; remaining.z -= normal.z * inward; }
      if (Math.hypot(remaining.x, remaining.z) < EPS) break;
    }
  }
  return { position, blocked, ...(normal ? { normal } : {}) };
}
