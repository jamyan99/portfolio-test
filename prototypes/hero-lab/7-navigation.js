// Camera-relative input and bounded court movement. This controller only moves
// the character root; the scene owns animation, hand contacts and ball physics.
const DEFAULT_CENTER = Object.freeze({ x: 1.5, z: -.1 });
const DEFAULT_RADIUS = Object.freeze({ x: 1.65, z: 1.6 });
const MOVE_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);
const STOP_SPEED = .005;
// Nearing the court's edge, the outward speed is limited to what this deceleration (m/s2) can
// still stop in the room left, so he slows to the line instead of stopping dead on it.
const EDGE_DECELERATION = 8;
const ARRIVAL_DISTANCE = .025;

function point(value, label = 'point') {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.z)) throw new TypeError(`${label} must have finite x/z coordinates.`);
  return { x: value.x, z: value.z };
}

function dimensions(center, radius) {
  center = point(center, 'Court center'); radius = point(radius, 'Court radius');
  if (!(radius.x > 0 && radius.z > 0)) throw new RangeError('Court radii must be positive.');
  return { center, radius };
}

/** Clamp radially to the court ellipse; never mutates the supplied point. */
export function clampCourt(value, center = DEFAULT_CENTER, radius = DEFAULT_RADIUS) {
  const p = point(value), bounds = dimensions(center, radius);
  const x = p.x - bounds.center.x, z = p.z - bounds.center.z;
  const length = Math.hypot(x / bounds.radius.x, z / bounds.radius.z);
  return length > 1 ? { x: bounds.center.x + x / length, z: bounds.center.z + z / length } : p;
}

/** Horizontal/right and vertical/down input, rotated by the camera's ground yaw. */
export function screenDirection(horizontal, vertical, yaw = 0) {
  if (![horizontal, vertical, yaw].every(Number.isFinite)) throw new TypeError('Direction inputs must be finite.');
  const length = Math.hypot(horizontal, vertical);
  if (!length) return { x: 0, z: 0 };
  const h = horizontal / Math.max(1, length), v = vertical / Math.max(1, length);
  return { x: h * Math.cos(yaw) + v * Math.sin(yaw), z: -h * Math.sin(yaw) + v * Math.cos(yaw) };
}

export function createNavigation({ center = DEFAULT_CENTER, radius = DEFAULT_RADIUS, speed = 2.6, acceleration = 12, deceleration = 15, constrain = null } = {}) {
  const bounds = dimensions(center, radius);
  if (![speed, acceleration, deceleration].every(value => Number.isFinite(value) && value > 0)) throw new RangeError('Movement speed and response rates must be positive.');
  const keys = new Set(), velocity = { x: 0, z: 0 };
  let target = null, moving = false, actualSpeed = 0, heading = 0;
  const clamp = p => clampCourt(p, bounds.center, bounds.radius);

  function clear() {
    keys.clear(); target = null; velocity.x = velocity.z = 0;
    moving = false; actualSpeed = 0;
  }

  function setTarget(value) {
    target = clamp(value);
    return { ...target };
  }

  function step(value, cameraYaw, delta, enabled = true) {
    const original = point(value), dt = Number.isFinite(delta) ? Math.max(0, Math.min(delta, .05)) : 0;
    const yaw = Number.isFinite(cameraYaw) ? cameraYaw : 0;
    if (!enabled || !dt) {
      // Scripted desk travel, basketball clips and retrieval own their own root.
      // Retain held keys/target through an action lock, but do not coast in it.
      if (!enabled) { velocity.x = velocity.z = 0; moving = false; actualSpeed = 0; }
      return { position: original, moving: enabled && moving, speed: enabled ? actualSpeed : 0, heading, arrived: false, blocked: false };
    }
    const start = clamp(original);
    const keyboard = [...keys].some(code => MOVE_CODES.has(code));
    let direction = { x: 0, z: 0 }, desiredSpeed = 0, distance = Infinity;
    if (keyboard) {
      target = null;
      const h = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      const v = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
      direction = screenDirection(h, v, yaw);
      desiredSpeed = speed;
    } else if (target) {
      const x = target.x - start.x, z = target.z - start.z;
      distance = Math.hypot(x, z);
      if (distance > 0) direction = { x: x / distance, z: z / distance };
      // Reduce speed near a destination. The exact segment arrival check below
      // prevents the final integration slice from overshooting the marker.
      desiredSpeed = Math.min(speed, Math.sqrt(2 * deceleration * distance));
    }
    const commanded = Math.hypot(direction.x, direction.z) > 0;
    const rate = commanded ? acceleration : deceleration;
    const decay = Math.exp(-rate * dt), integral = (1 - decay) / rate;
    const desired = { x: direction.x * desiredSpeed, z: direction.z * desiredSpeed };
    const fromCentre = { x: start.x - bounds.center.x, z: start.z - bounds.center.z };
    const reach = Math.hypot(fromCentre.x / bounds.radius.x, fromCentre.z / bounds.radius.z), radial = Math.hypot(fromCentre.x, fromCentre.z);
    if (reach > 1e-6) {
      // Only the part heading out is held back; running along the line keeps its speed.
      const nx = fromCentre.x / radial, nz = fromCentre.z / radial;
      const limit = Math.sqrt(2 * EDGE_DECELERATION * Math.max(0, radial * (1 / reach - 1)));
      for (const v of [desired, velocity]) {
        const outward = v.x * nx + v.z * nz;
        if (outward > limit) { v.x -= (outward - limit) * nx; v.z -= (outward - limit) * nz; }
      }
    }
    // Integrate exponential response analytically rather than multiplying the
    // end velocity by dt. Straight motion stays consistent at 20/60/120 Hz.
    const displacement = {
      x: desired.x * dt + (velocity.x - desired.x) * integral,
      z: desired.z * dt + (velocity.z - desired.z) * integral,
    };
    velocity.x = desired.x + (velocity.x - desired.x) * decay;
    velocity.z = desired.z + (velocity.z - desired.z) * decay;
    let candidate = { x: start.x + displacement.x, z: start.z + displacement.z }, arrived = false;
    if (target) {
      const projectedTravel = displacement.x * direction.x + displacement.z * direction.z;
      const nextDistance = Math.hypot(target.x - candidate.x, target.z - candidate.z);
      const travel = Math.hypot(displacement.x, displacement.z);
      if (distance < 1e-6 || ((nextDistance <= ARRIVAL_DISTANCE || projectedTravel >= distance) && distance <= travel + 1e-9)) {
        candidate = { ...target }; target = null; velocity.x = velocity.z = 0; arrived = true;
      }
    }
    const ellipsePosition = clamp(candidate);
    const constraint = constrain?.(start, ellipsePosition);
    const position = clamp(constraint?.position ?? ellipsePosition);
    const ellipseBlocked = Math.hypot(ellipsePosition.x - candidate.x, ellipsePosition.z - candidate.z) > 1e-9;
    const blocked = ellipseBlocked || !!constraint?.blocked;
    if (constraint?.normal) {
      const into = velocity.x * constraint.normal.x + velocity.z * constraint.normal.z;
      if (into < 0) { velocity.x -= into * constraint.normal.x; velocity.z -= into * constraint.normal.z; }
    }
    if (ellipseBlocked) {
      // Remove outward velocity while preserving movement along the boundary.
      const gx = (position.x - bounds.center.x) / bounds.radius.x ** 2;
      const gz = (position.z - bounds.center.z) / bounds.radius.z ** 2;
      const normalLength = Math.hypot(gx, gz), nx = gx / normalLength, nz = gz / normalLength;
      const outward = velocity.x * nx + velocity.z * nz;
      if (outward > 0) { velocity.x -= outward * nx; velocity.z -= outward * nz; }
    }
    if (!commanded && Math.hypot(velocity.x, velocity.z) < STOP_SPEED) velocity.x = velocity.z = 0;
    const dx = position.x - original.x, dz = position.z - original.z;
    actualSpeed = Math.hypot(dx, dz) / dt;
    moving = actualSpeed > STOP_SPEED;
    if (moving) heading = Math.atan2(dx, dz);
    return { position, moving, speed: actualSpeed, heading, arrived, blocked };
  }

  return {
    keys, velocity, setTarget, clear, step,
    reset() { clear(); heading = 0; },
    get target() { return target ? { ...target } : null; },
    get moving() { return moving; },
    snapshot() { return { keys: [...keys], target: target ? { ...target } : null, velocity: { ...velocity }, moving, speed: actualSpeed, heading, center: { ...bounds.center }, radius: { ...bounds.radius } }; },
  };
}
