import RAPIER from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.19.3/rapier.mjs';

// One rigid ball, measured in metres. Shot flight is never steered after release.
// Moving dribbles may carry their horizontal support frame; gravity and floor
// rebound stay in Rapier. This explicit control assist does not apply to shots.
const FIXED_DT = 1 / 120;
const GRAVITY = 9.81;
const RIM_RADIUS = 0.225;
const RIM_TUBE = 0.009;
const FLIGHT_LINEAR_DAMPING = 0.025;
const FLIGHT_ANGULAR_DAMPING = 0.2;
const BALL_RESTITUTION = 0.82;
// Post-outcome settling: shots and missed dribbles, after a real floor bounce.
// It dissipates energy through Rapier; it never changes position or steers flight.
const SETTLE_LINEAR_DAMPING = 6;
const SETTLE_ANGULAR_DAMPING = 5;
const SETTLE_RESTITUTION = 0.18;
const ZERO = { x: 0, y: 0, z: 0 };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
let rapierReady;

// Analytic one-bounce starting point, in positive downward metres/second.
// Rapier still decides the actual bounce and catch; damping/discrete contact can
// introduce a small difference. Preserve the original launch when unreachable.
export function solveDribbleDownSpeed(releaseY, catchY, duration, {
  radius = 0.12, gravity = GRAVITY, restitution = BALL_RESTITUTION,
} = {}) {
  const fallback = 1.3;
  if (![releaseY, catchY, duration, radius, gravity, restitution].every(Number.isFinite)
    || radius <= 0 || gravity <= 0 || restitution <= 0 || restitution > 1
    || releaseY <= radius || catchY <= radius || duration <= 0) return fallback;
  function predict(speed) {
    const impactSpeed = Math.sqrt(speed * speed + 2 * gravity * (releaseY - radius));
    const bounceTime = (impactSpeed - speed) / gravity;
    const riseTime = duration - bounceTime;
    return {
      error: radius + restitution * impactSpeed * riseTime - 0.5 * gravity * riseTime * riseTime - catchY,
      valid: riseTime > 0 && restitution * impactSpeed - gravity * riseTime > 0,
    };
  }
  // Bracket within 0..6 first, so a descending or not-yet-bounced root cannot
  // mask the physically useful upward root of the one-bounce equation.
  let low = 0;
  let lower = predict(low);
  for (let i = 1; i <= 60; i++) {
    const high = i / 10;
    const upper = predict(high);
    if (lower.valid && Math.abs(lower.error) < 1e-7) return low;
    if (lower.error * upper.error <= 0) {
      let left = low;
      let right = high;
      let leftError = lower.error;
      for (let iteration = 0; iteration < 40; iteration++) {
        const mid = (left + right) / 2;
        const middle = predict(mid);
        if (leftError * middle.error <= 0) right = mid;
        else { left = mid; leftError = middle.error; }
      }
      const result = (left + right) / 2;
      const solved = predict(result);
      if (solved.valid && Math.abs(solved.error) < 1e-6) return result;
    }
    low = high;
    lower = upper;
  }
  return lower.valid && Math.abs(lower.error) < 1e-7 ? 6 : fallback;
}

export async function createBallPhysics({ THREE, radius = 0.12, hoop = [2.7, 3.05, -2.4], onMake, roomDivider = null } = {}) {
  if (!THREE?.Vector3 || !THREE?.Quaternion) throw new TypeError('THREE math classes are required.');
  if (!(radius > 0 && radius < RIM_RADIUS - RIM_TUBE)) throw new RangeError('Invalid ball radius.');
  rapierReady ??= RAPIER.init();
  await rapierReady;
  const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
  world.timestep = FIXED_DT;
  world.integrationParameters.maxCcdSubsteps = 4;
  const [hx, hy, hz] = hoop;
  const q = new THREE.Quaternion();
  const frameRotation = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const segment = new THREE.Vector3();
  const counters = { steps: 0, releases: 0, rejectedReleases: 0, shots: 0, makes: 0, bounces: 0, recoveries: 0, coveredResets: 0 };

  function box(sx, sy, sz, x, y, z, restitution = 0.58, friction = 0.62) {
    return world.createCollider(RAPIER.ColliderDesc.cuboid(sx, sy, sz)
      .setTranslation(x, y, z).setRestitution(restitution).setFriction(friction));
  }
  box(5.2, 0.1, 4, 0, -0.1, -0.25, 0.82);
  // The scene's white room boundary keeps a missed ball available for retrieval.
  box(0.08, 2.5, 3.83, -5.08, 2.5, -0.25, 0.46);
  box(0.08, 2.5, 3.83, 5.08, 2.5, -0.25, 0.46);
  box(5.08, 2.5, 0.08, 0, 2.5, -4.08, 0.46);
  box(5.08, 2.5, 0.08, 0, 2.5, 3.58, 0.46);
  box(0.675, 0.45, 0.025, hx, hy + 0.45, hz - 0.25, 0.7, 0.3);
  // Coarse collision shells match the modeled working furniture.
  box(.975, .0275, .43, -2, .75, .8, .45);
  box(.27, .0525, .25, -2, .49, 0, .4);
  // The workroom has two solid jamb panels and a lintel; the doorway is empty.
  if (roomDivider) {
    const { x, halfThickness: t, bottomY: y, openingZ: [a, b], openingHeight: h, wallHeight: height, rangeZ: [lo, hi] } = roomDivider;
    for (const [start, end] of [[lo, a], [b, hi]]) box(t, height / 2, (end - start) / 2, x, y + height / 2, (start + end) / 2, .46);
    box(t, (height - h) / 2, (b - a) / 2, x, y + (height + h) / 2, (a + b) / 2, .46);
    for (const w of roomDivider.walls ?? []) box((w.maxX - w.minX) / 2, height / 2, (w.maxZ - w.minZ) / 2,
      (w.minX + w.maxX) / 2, y + height / 2, (w.minZ + w.maxZ) / 2, .46);
  }

  // Solid shells match the visible hoop stand and ceramic planter.
  world.createCollider(RAPIER.ColliderDesc.cylinder(.06, .375)
    .setTranslation(2.7, .07, -2.87).setRestitution(.45).setFriction(.7));
  box(.0525, 1.735, .0525, 2.7, 1.76, -2.82, .45);
  const braceStart = new THREE.Vector3(2.7, 2.65, -2.82), braceEnd = new THREE.Vector3(2.7, 3.38, -2.68);
  segment.copy(braceEnd).sub(braceStart); q.setFromUnitVectors(up, segment.clone().normalize());
  world.createCollider(RAPIER.ColliderDesc.capsule(segment.length() / 2, .035)
    .setTranslation(2.7, 3.015, -2.75).setRotation(q).setRestitution(.45));
  world.createCollider(RAPIER.ColliderDesc.cylinder(.285, .37)
    .setTranslation(4.17, .285, -2.25).setRestitution(.4).setFriction(.7));
  // The curved rear floor is visible geometry, rather than open space under a
  // flat back wall. A matching static strip stops balls rolling through it.
  const coveVertices = [], coveFaces = [], coveSegments = 18;
  for (let i = 0; i <= coveSegments; i++) {
    const a = i / coveSegments * Math.PI / 2;
    const y = .65 * (1 - Math.cos(a)), z = -3.35 - .65 * Math.sin(a);
    coveVertices.push(-5.08, y, z, 5.08, y, z);
    if (i < coveSegments) { const k = i * 2; coveFaces.push(k, k + 1, k + 3, k, k + 3, k + 2); }
  }
  world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(coveVertices), new Uint32Array(coveFaces))
    .setRestitution(.46).setFriction(.62));

  // Capsules form a closed torus without concave/trimesh collision assumptions.
  // Their shared fixed body is a compound rim collider, with tube centres on RIM_RADIUS.
  const rimBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  for (let i = 0; i < 48; i++) {
    const a = i * Math.PI * 2 / 48;
    const b = (i + 1) * Math.PI * 2 / 48;
    const ax = hx + Math.cos(a) * RIM_RADIUS;
    const az = hz + Math.sin(a) * RIM_RADIUS;
    const bx = hx + Math.cos(b) * RIM_RADIUS;
    const bz = hz + Math.sin(b) * RIM_RADIUS;
    segment.set(bx - ax, 0, bz - az);
    const length = segment.length();
    q.setFromUnitVectors(up, segment.normalize());
    world.createCollider(RAPIER.ColliderDesc.capsule(length / 2, RIM_TUBE)
      .setTranslation((ax + bx) / 2, hy, (az + bz) / 2)
      .setRotation(q).setRestitution(0.56).setFriction(0.28), rimBody);
  }

  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(0, radius, 0).setCcdEnabled(true)
    .setLinearDamping(FLIGHT_LINEAR_DAMPING).setAngularDamping(FLIGHT_ANGULAR_DAMPING).setCanSleep(true));
  const ballCollider = world.createCollider(RAPIER.ColliderDesc.ball(radius).setMass(0.62)
    .setRestitution(BALL_RESTITUTION).setFriction(0.62), body);
  const characterBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(-100, .9, -100));
  const characterCollider = world.createCollider(RAPIER.ColliderDesc.capsule(.62, .26)
    .setRestitution(.45).setFriction(.5), characterBody);
  // Explicitly remove solver interaction while attached to a hand. This pinned
  // compatibility runtime can retain contacts after setEnabled(false).
  characterCollider.setSensor(true); characterCollider.setCollisionGroups(0);
  let characterPresent = false, characterEnabled = false;
  const characterPosition = new THREE.Vector3(-100, .9, -100);
  const position = new THREE.Vector3(0, radius, 0);
  const quaternion = new THREE.Quaternion();
  const velocity = new THREE.Vector3();
  const previous = new THREE.Vector3();
  let mode = 'held';
  let kind = 'drop';
  let dribbleControlled = false;
  let accumulator = 0;
  let flightTime = 0;
  let quietTime = 0;
  let floorBounceCount = 0;
  let postFloorSettling = false;
  let settleStartedAt = null;
  let made = false;
  let passage = null;
  let disposed = false;

  function setCharacterPose(position, { lift = 0 } = {}) {
    if (disposed || ![position?.x, position?.y, position?.z, lift].every(Number.isFinite)) return false;
    characterPosition.set(position.x, position.y + .9 + Math.max(0, lift), position.z);
    if (!characterPresent) characterBody.setTranslation(characterPosition, true);
    characterPresent = true;
    characterBody.setNextKinematicTranslation(characterPosition);
    return true;
  }

  function sync() {
    position.copy(body.translation());
    quaternion.copy(body.rotation());
    velocity.copy(body.linvel());
  }

  function restoreFlightResponse() {
    body.setLinearDamping(FLIGHT_LINEAR_DAMPING);
    body.setAngularDamping(FLIGHT_ANGULAR_DAMPING);
    ballCollider.setRestitution(BALL_RESTITUTION);
    postFloorSettling = false;
    settleStartedAt = null;
  }

  function settleAfterFloorBounce() {
    if ((kind !== 'shot' && !(kind === 'dribble' && !dribbleControlled)) || postFloorSettling) return;
    body.setLinearDamping(SETTLE_LINEAR_DAMPING);
    body.setAngularDamping(SETTLE_ANGULAR_DAMPING);
    // The floor retains .82. Rapier's default average combine rule produces
    // .50 on subsequent impacts; the first bounce has already used .82.
    ballCollider.setRestitution(SETTLE_RESTITUTION);
    postFloorSettling = true;
    settleStartedAt = flightTime;
  }

  function resetShot() {
    if (mode === 'flight' && kind === 'shot') return false;
    made = false;
    passage = null;
    return true;
  }

  function floorReachable() {
    return [position.x, position.y, position.z, velocity.x, velocity.y, velocity.z].every(Number.isFinite)
      && position.y >= radius - 0.035 && position.y <= radius + 0.035
      && Math.abs(position.x) <= 5.1 && position.z >= -4.1 && position.z <= 3.6
      && velocity.lengthSq() <= 1;
  }

  function canRecover() {
    return (mode === 'settled' || mode === 'recoverable') && floorReachable();
  }

  function recoveryReason() {
    if (mode === 'held') return null;
    if (![position.x, position.y, position.z, velocity.x, velocity.y, velocity.z].every(Number.isFinite)) return 'invalid-physics-state';
    if (position.y < -0.5 || Math.abs(position.x) > 5.5 || position.z < -4.5 || position.z > 4) return 'escaped-room';
    if (flightTime >= 10 && !floorReachable() && (mode === 'settled' || body.isSleeping() || velocity.lengthSq() < 0.045)) return 'elevated-or-unreachable';
    if (flightTime >= 14 && !canRecover()) return 'recovery-timeout';
    return null;
  }

  function setHeld(nextPosition, nextQuaternion) {
    if (disposed || (mode === 'flight' && kind === 'shot')) return false;
    if (recoveryReason() || ((mode === 'settled' || mode === 'recoverable') && !canRecover())) return false;
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    body.setLinvel(ZERO, false);
    body.setAngvel(ZERO, false);
    body.setTranslation(nextPosition, false);
    body.setNextKinematicTranslation(nextPosition);
    if (nextQuaternion) {
      body.setRotation(nextQuaternion, false);
      body.setNextKinematicRotation(nextQuaternion);
    }
    if (mode !== 'held') counters.recoveries++;
    mode = 'held';
    dribbleControlled = false;
    accumulator = 0;
    passage = null;
    sync();
    return true;
  }

  // A recovery from an unreachable location is allowed only behind the caller's
  // poster while paused. Ordinary visible pickup must use the real floor ball.
  function resetCovered(nextPosition, nextQuaternion) {
    if (disposed || !api.paused || ![nextPosition.x, nextPosition.y, nextPosition.z].every(Number.isFinite)) return false;
    mode = 'held';
    flightTime = 0;
    quietTime = 0;
    made = false;
    passage = null;
    floorBounceCount = 0;
    restoreFlightResponse();
    counters.coveredResets++;
    return setHeld(nextPosition, nextQuaternion);
  }

  function release(nextPosition, launchVelocity, angularVelocity = { x: -3, y: 0, z: 0 }, options = {}) {
    if (disposed || mode === 'flight' || recoveryReason() || ((mode === 'settled' || mode === 'recoverable') && !canRecover())) {
      counters.rejectedReleases++;
      return false;
    }
    if (![nextPosition.x, nextPosition.y, nextPosition.z, launchVelocity.x, launchVelocity.y, launchVelocity.z].every(Number.isFinite)) {
      throw new TypeError('Release vectors must contain finite coordinates.');
    }
    kind = options.kind ?? 'shot';
    dribbleControlled = kind === 'dribble';
    made = false;
    passage = null;
    quietTime = 0;
    flightTime = 0;
    floorBounceCount = 0;
    accumulator = 0;
    restoreFlightResponse();
    body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    body.setTranslation(nextPosition, true);
    body.setLinvel(launchVelocity, true);
    body.setAngvel(angularVelocity ?? ZERO, true);
    body.enableCcd(true);
    mode = 'flight';
    counters.releases++;
    if (kind === 'shot') counters.shots++;
    sync();
    return true;
  }

  // A single-dribble handoff must occur near the physical ball after its bounce.
  function catchBall(handPosition, handQuaternion, tolerance = 0.06) {
    if (mode !== 'flight' || kind !== 'dribble' || !dribbleControlled || floorBounceCount < 1) return false;
    if (velocity.y < 0 || position.distanceTo(handPosition) > tolerance) return false;
    return setHeld(handPosition, handQuaternion);
  }

  function transportDribbleFrame(previousRoot, currentRoot, deltaYaw = 0) {
    if (disposed || api.paused || mode !== 'flight' || kind !== 'dribble' || !dribbleControlled) return false;
    if (![previousRoot?.x, previousRoot?.z, currentRoot?.x, currentRoot?.z, deltaYaw].every(Number.isFinite)) return false;
    const cosine = Math.cos(deltaYaw);
    const sine = Math.sin(deltaYaw);
    const p = body.translation();
    const v = body.linvel();
    const w = body.angvel();
    const dx = p.x - previousRoot.x;
    const dz = p.z - previousRoot.z;
    // These are support-frame deltas, not added root launch velocity. Combining
    // both would count controller travel twice. Never change vertical motion.
    body.setTranslation({ x: currentRoot.x + cosine * dx + sine * dz, y: p.y,
      z: currentRoot.z - sine * dx + cosine * dz }, true);
    body.setLinvel({ x: cosine * v.x + sine * v.z, y: v.y, z: -sine * v.x + cosine * v.z }, true);
    body.setAngvel({ x: cosine * w.x + sine * w.z, y: w.y, z: -sine * w.x + cosine * w.z }, true);
    frameRotation.setFromAxisAngle(up, deltaYaw);
    q.copy(body.rotation()).premultiply(frameRotation);
    body.setRotation(q, true);
    sync();
    return true;
  }

  // A missed receiving window ends possession. It becomes an ordinary loose
  // rigid ball; continuing support-frame transport made it follow the player.
  function endDribbleControl() {
    if (disposed || kind !== 'dribble' || !dribbleControlled) return false;
    dribbleControlled = false;
    if (floorBounceCount > 0) settleAfterFloorBounce();
    return true;
  }

  function radialAtY(y) {
    const t = clamp((previous.y - y) / (previous.y - position.y), 0, 1);
    const x = previous.x + (position.x - previous.x) * t;
    const z = previous.z + (position.z - previous.z) * t;
    return Math.hypot(x - hx, z - hz);
  }

  function scoreCrossing() {
    if (kind !== 'shot' || made) return;
    const innerRadius = RIM_RADIUS - RIM_TUBE;
    if (velocity.y >= 0) {
      if (position.y >= hy) passage = null;
      return;
    }
    // A rim contact can precede a legitimate make. Arm from a new, physically
    // clear centre crossing rather than permanently rejecting that earlier contact.
    // The small allowance matches the solver's sub-centimetre contact tolerance.
    if (previous.y >= hy && position.y < hy) {
      passage = radialAtY(hy) + radius <= innerRadius + 0.006 ? { crossedCenter: true } : null;
    }
    const clearBelow = hy - radius - RIM_TUBE;
    if (passage && previous.y >= clearBelow && position.y < clearBelow) {
      if (radialAtY(clearBelow) < innerRadius) {
        made = true;
        counters.makes++;
        api.onMake?.({ shot: counters.shots, position: position.clone() });
      }
      passage = null;
    }
  }

  function step(dt) {
    if (disposed || !Number.isFinite(dt) || dt <= 0 || api.paused) return;
    // No catch-up after a hidden tab; the caller pauses rather than simulating elapsed wall time.
    accumulator += Math.min(dt, 0.1);
    while (accumulator >= FIXED_DT) {
      previous.copy(position);
      const oldVy = velocity.y;
      // Held/controlled balls already have explicit hand contact. A short
      // release clearance avoids the shooter's own capsule hitting the wrist.
      const enableCharacter = characterPresent && mode !== 'held' && !dribbleControlled
        && (kind !== 'shot' || flightTime >= .08);
      if (enableCharacter !== characterEnabled) {
        characterEnabled = enableCharacter;
        characterCollider.setSensor(!enableCharacter);
        characterCollider.setCollisionGroups(enableCharacter ? 0xffffffff : 0);
      }
      world.step();
      sync();
      accumulator -= FIXED_DT;
      counters.steps++;
      if (mode === 'held') continue;
      flightTime += FIXED_DT;
      if (oldVy < -0.35 && velocity.y > 0.2 && position.y < radius + 0.055) {
        floorBounceCount++;
        counters.bounces++;
        settleAfterFloorBounce();
      }
      scoreCrossing();
      const slow = velocity.lengthSq() < 0.045 && position.y < radius + 0.04;
      quietTime = slow ? quietTime + FIXED_DT : 0;
      if (body.isSleeping() || quietTime > 0.45) mode = 'settled';
      // Finite recovery: expose only a reachable floor location for ordinary
      // pickup. Elevated/escaped faults require the covered, paused reset path.
      if (mode === 'flight' && (flightTime > 10 || position.y < -0.5 || Math.abs(position.x) > 5.5 || position.z < -4.5 || position.z > 4)) mode = 'recoverable';
    }
  }

  function getLaunchVelocity(releasePosition, aim = {}) {
    const dx = hx - releasePosition.x;
    const dz = hz - releasePosition.z;
    const distance = Math.hypot(dx, dz);
    const time = clamp(0.82 + distance * 0.085, 0.92, 1.3);
    const yaw = clamp(Number(aim.yaw) || 0, -0.55, 0.55);
    const power = clamp(Number.isFinite(aim.power) ? aim.power : 0.5, 0, 1);
    const multiplier = 0.72 + power * 0.56;
    const vx = dx / time;
    const vz = dz / time;
    return new THREE.Vector3(
      (vx * Math.cos(yaw) - vz * Math.sin(yaw)) * multiplier,
      ((hy - releasePosition.y) / time + GRAVITY * time / 2) * multiplier,
      (vx * Math.sin(yaw) + vz * Math.cos(yaw)) * multiplier,
    );
  }

  const api = {
    position, quaternion, velocity, radius, hoop: new THREE.Vector3(hx, hy, hz),
    onMake, paused: false, step, setHeld, release, catchBall, resetShot, resetCovered, getLaunchVelocity, transportDribbleFrame, endDribbleControl, setCharacterPose,
    get mode() { return mode; },
    get kind() { return kind; },
    get made() { return made; },
    get isSettled() { return mode === 'settled'; },
    get canRecover() { return canRecover(); },
    get needsRecovery() { return recoveryReason() !== null; },
    get recoveryReason() { return recoveryReason(); },
    get bounceCount() { return floorBounceCount; },
    pause() { api.paused = true; accumulator = 0; },
    resume() { api.paused = false; accumulator = 0; },
    snapshot() {
      return { ...counters, mode, kind, made, flightTime, bounceCount: floorBounceCount, canRecover: canRecover(), needsRecovery: recoveryReason() !== null, recoveryReason: recoveryReason(),
        dribbleControlled, postShotSettling: kind === 'shot' && postFloorSettling,
        looseDribbleSettling: kind === 'dribble' && postFloorSettling,
        character: { present: characterPresent, enabled: characterEnabled, position: characterPosition.toArray(), radius: .26, height: 1.76 },
        solidProps: ['hoop-base', 'hoop-upright', 'hoop-brace', 'plant-pot', 'rear-cove', ...(roomDivider ? ['room-divider-0', 'room-divider-1', 'room-divider-lintel', ...(roomDivider.walls ?? []).map(w => w.id)] : [])],
        settleStartedAt, linearDamping: body.linearDamping(), angularDamping: body.angularDamping(), restitution: ballCollider.restitution(),
        position: position.toArray(), velocity: velocity.toArray(), ccd: body.isCcdEnabled(),
        fixedDt: FIXED_DT, rapierVersion: RAPIER.version(), bodies: world.bodies.len(), colliders: world.colliders.len() };
    },
    dispose() { if (!disposed) { world.free(); disposed = true; } },
  };
  return api;
}
