// Ball handling, re-authored on the same skeleton: the ready hold, the dribble and the finger spin.
//
// The clips that shipped with the stand-in kept the ball on a socket on the BACK of the right
// hand (it floated beside the hand instead of sitting in the palm), dribbled as an upright
// two-bounce crossover with locked arms, and parked the spin in front of the face with both
// forearms crossed and frozen. Their timing and physics hooks were sound; the poses were not.
//
// This builds replacement clips at load, in code, from the hands outward: where the ball is,
// which way each palm faces it, and an arm solved to reach that (two-bone IK), under a torso that
// leans and gives with the work. The result is ordinary keyframed clips on the existing bones, so
// the mixer, the court layers, the contact events and the ball physics all run unchanged.
//
// Spaces: everything here is in the character's own frame, metres: +Y up, +Z ahead of him, -X
// to his right. Angles in degrees.
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const G = 9.81, FPS = 60;
const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = t => { t = clamp01(t); return t * t * (3 - 2 * t); };
const smoother = t => { t = clamp01(t); return t * t * t * (t * (t * 6 - 15) + 10); };
const lerp = (a, b, t) => a + (b - a) * t;
const span = (t, a, b) => clamp01((t - a) / (b - a));
// One cubic between two (time, value, slope) keys: position and speed both meet at the joins.
function hermite(t, t0, y0, v0, t1, y1, v1) {
  const T = t1 - t0, s = clamp01((t - t0) / T), s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * y0 + (s3 - 2 * s2 + s) * T * v0 + (-2 * s3 + 3 * s2) * y1 + (s3 - s2) * T * v1;
}
// A value eased through [time, value] keys (it rests at each key).
const through = keys => t => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], smooth(span(t, keys[i - 1][0], keys[i][0])));
  return keys.at(-1)[1];
};

export function bakeHandles({ THREE, character, clips, meta, radius = .12, restitution = .82 }) {
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const UP = V(0, 1, 0);
  const original = new Map(clips.map(clip => [clip.name, clip]));
  const rig = cloneSkeleton(character); rig.removeFromParent(); rig.updateMatrixWorld(true);
  const canonical = name => String(name ?? '').replace(/^mixamorig[:_]?/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const find = name => { let match; rig.traverse(node => { if (!match && canonical(node.name) === canonical(name)) match = node; }); if (!match) throw Error(`Ball handling needs the ${name} bone`); return match; };
  const arm = side => ({ shoulder: find(`${side}Shoulder`), arm: find(`${side}Arm`), fore: find(`${side}ForeArm`), hand: find(`${side}Hand`), socket: find(`${side}HandSocket`),
    fingers: ['Index', 'Middle', 'Ring', 'Pinky'].map(finger => [1, 2, 3].map(joint => find(`${side}Hand${finger}${joint}`))),
    thumb: [1, 2, 3].map(joint => find(`${side}HandThumb${joint}`)), sign: side === 'Right' ? -1 : 1 });
  const B = { hips: find('Hips'), spine: find('Spine'), spine1: find('Spine1'), spine2: find('Spine2'), neck: find('Neck'), head: find('Head'),
    R: arm('Right'), L: arm('Left'), tip: find('RightIndexTipSocket'), indexEnd: find('RightHandIndex4'), footR: find('RightFoot') };
  const upper = []; B.spine.traverse(node => upper.push(node));
  const upperSet = new Set(upper);
  const everything = []; rig.traverse(node => { if (node.isBone) everything.push(node); });
  const lower = everything.filter(node => !upperSet.has(node));
  const torsoBones = [B.spine, B.spine1, B.spine2, B.neck, B.head];

  // The bind pose, for turning "which way this bone should point" into a rotation.
  const bind = new Map(); let unit = 1;
  rig.traverse(node => {
    if (!node.isSkinnedMesh) return;
    node.skeleton.bones.forEach((bone, i) => {
      if (bind.has(bone)) return;
      const p = V(), q = new THREE.Quaternion(), s = V();
      new THREE.Matrix4().copy(node.skeleton.boneInverses[i]).invert().decompose(p, q, s); bind.set(bone, q);
    });
  });
  unit = B.R.hand.getWorldScale(V()).x; // bone-space units per metre (the model is in centimetres)
  const rest = bone => (bind.has(bone.parent) ? bind.get(bone.parent).clone().invert() : new THREE.Quaternion()).multiply(bind.get(bone));
  const worldQ = node => node.getWorldQuaternion(new THREE.Quaternion());
  const worldP = node => node.getWorldPosition(V());
  function setWorld(bone, q) { bone.quaternion.copy(worldQ(bone.parent).invert()).multiply(q); bone.updateMatrixWorld(true); }
  const basis = (x, y) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, x.clone().cross(y)));
  const euler = (pitch, yaw = 0, roll = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch * Math.PI / 180, yaw * Math.PI / 180, roll * Math.PI / 180, 'YXZ'));
  // Turn a bone by a rotation given in the bind pose's own axes (fingers curl about one of them).
  function turn(bone, axis, degrees) {
    const b = bind.get(bone), r = new THREE.Quaternion().setFromAxisAngle(axis, degrees * Math.PI / 180);
    bone.quaternion.copy(rest(bone)).multiply(b.clone().invert().multiply(r).multiply(b));
  }

  // ---- Sampling the shipped clips onto the rig ----
  const prepared = new Map();
  function tracksOf(clip) {
    if (!prepared.has(clip)) prepared.set(clip, clip.tracks.map(track => {
      const parsed = THREE.PropertyBinding.parseTrackName(track.name), node = rig.getObjectByName(parsed.nodeName);
      return node && ['quaternion', 'position', 'scale'].includes(parsed.propertyName) ? { node, property: parsed.propertyName, interpolant: track.createInterpolant() } : null;
    }).filter(Boolean));
    return prepared.get(clip);
  }
  function applyClip(name, time = 0, only = null) {
    const clip = original.get(name); if (!clip) throw Error(`Ball handling needs the ${name} clip`);
    for (const item of tracksOf(clip)) if (!only || only.has(item.node)) item.node[item.property].fromArray(item.interpolant.evaluate(time));
    rig.updateMatrixWorld(true);
  }
  const snapshot = bones => bones.map(bone => ({ bone, q: bone.quaternion.clone(), p: bone.position.clone() }));
  const blendTo = (from, to, amount) => from.forEach((a, i) => { a.bone.quaternion.copy(a.q).slerp(to[i].q, amount); a.bone.position.copy(a.p).lerp(to[i].p, amount); });
  const lowerSet = new Set(lower);

  // ---- Arms and hands ----
  const forearm = B.R.hand.position.length() * unit, upperArm = B.R.fore.position.length() * unit;
  // Shoulder to a wrist position, the elbow swung toward `pole`; then the hand's own orientation.
  function solveArm(A, wrist, pole, handQ) {
    const s = A.sign, shoulder = worldP(A.arm), d = wrist.clone().sub(shoulder);
    const reach = Math.min(d.length(), (upperArm + forearm) * .985), dir = d.normalize();
    const a = (upperArm * upperArm - forearm * forearm + reach * reach) / (2 * reach), h = Math.sqrt(Math.max(1e-6, upperArm * upperArm - a * a));
    const swing = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
    const elbow = shoulder.clone().addScaledVector(dir, a).addScaledVector(swing, h), target = shoulder.clone().addScaledVector(dir, reach);
    const u = elbow.clone().sub(shoulder).normalize(), f = target.clone().sub(elbow).normalize();
    const hinge = u.clone().cross(f).normalize().multiplyScalar(-s); // the elbow's axis, as the bind pose has it
    setWorld(A.arm, basis(u.clone().multiplyScalar(s), hinge).multiply(bind.get(A.arm)));
    setWorld(A.fore, basis(f.clone().multiplyScalar(s), hinge).multiply(bind.get(A.fore)));
    setWorld(A.hand, handQ);
  }
  // palm: the way the palm faces; fingers: the way they point (made square to the palm).
  function handQuaternion(A, palm, fingers) {
    const p = palm.clone().normalize(), f = fingers.clone().addScaledVector(p, -fingers.dot(p)).normalize();
    return { q: basis(f.clone().multiplyScalar(A.sign), p.clone().negate()).multiply(bind.get(A.hand)), p, f };
  }
  // Fingers: curl per finger (index, middle, ring, little), how far they spread, the thumb's swing in.
  // (In the bind pose both hands lie flat, fingers along X: a curl is a turn about Z, a spread
  // or the thumb's swing a turn about Y; the sign flips with the side.)
  function setFingers(A, curl, spread = 0, thumb = 0) {
    const s = A.sign, z = V(0, 0, 1), y = V(0, 1, 0), about = (axis, degrees) => new THREE.Quaternion().setFromAxisAngle(axis, degrees * Math.PI / 180);
    A.fingers.forEach((joints, i) => joints.forEach((bone, j) => {
      const r = about(z, -s * curl[i] * [.8, 1, .75][j]);
      if (!j && spread) r.premultiply(about(y, -s * spread * (1.5 - i) / 1.5));
      const b = bind.get(bone);
      bone.quaternion.copy(rest(bone)).multiply(b.clone().invert().multiply(r).multiply(b));
    }));
    A.thumb.forEach((bone, j) => turn(bone, y, s * thumb * [1, .5, .3][j]));
    A.hand.updateMatrixWorld(true);
  }
  // Where the ball's centre sits when it is in the palm: a palm's thickness off the bone, just
  // behind the knuckles. (The shipped socket was the same distance off the BACK of the hand.)
  const PALM = { along: .085, off: radius + .014 };
  const palmPoint = (A, palm, fingers) => worldP(A.hand).addScaledVector(fingers, PALM.along).addScaledVector(palm, PALM.off);
  // Place a hand on a ball: the palm faces the centre from `palm`'s side, fingers along `fingers`.
  function holdBall(A, centre, palm, fingers, pole) {
    const { q, p, f } = handQuaternion(A, palm, fingers);
    solveArm(A, centre.clone().addScaledVector(f, -PALM.along).addScaledVector(p, -PALM.off), pole, q);
    return { p, f };
  }
  const setSocket = (A, point) => { A.socket.position.copy(A.hand.worldToLocal(point.clone())); A.socket.updateMatrixWorld(true); };
  const mix = (a, b, k) => a.clone().lerp(b, k);
  const mixDir = (a, b, k) => a.clone().lerp(b, k).normalize();
  // Along the arc between two directions at an even rate (a straight blend races through the
  // middle when they are far apart); arcVia goes round by way of a third direction.
  function arcDir(a, b, k) {
    const from = a.clone().normalize(), to = b.clone().normalize(), angle = Math.acos(Math.max(-1, Math.min(1, from.dot(to))));
    if (angle < 1e-4) return from;
    return from.multiplyScalar(Math.sin((1 - k) * angle)).addScaledVector(to, Math.sin(k * angle)).normalize();
  }
  const arcVia = (a, via, b, k) => k < .5 ? arcDir(a, via, k * 2) : arcDir(via, b, k * 2 - 1);

  // ---- The ready hold: two hands on the ball at the waist, defined once against the chest ----
  // so it rides the torso through idle, walk and run, and every move starts and ends in it.
  applyClip('Idle_Ball', 0);
  const chestInverse = new THREE.Matrix4().copy(B.spine2.matrixWorld).invert(), chestQ = worldQ(B.spine2).invert();
  const toChest = point => point.clone().applyMatrix4(chestInverse), dirToChest = dir => dir.clone().applyQuaternion(chestQ);
  const READY = {
    centre: toChest(V(-.07, 1.05, .285)),
    R: { palm: dirToChest(V(.58, .74, .34)), fingers: dirToChest(V(.5, -.38, .78)), pole: dirToChest(V(-.75, -.45, -.5)) },
    L: { palm: dirToChest(V(-.9, -.12, -.42)), fingers: dirToChest(V(-.25, -.42, .87)), pole: dirToChest(V(.8, -.45, -.4)) },
  };
  const fromChest = () => {
    const m = B.spine2.matrixWorld, q = worldQ(B.spine2), out = point => point.clone().applyMatrix4(m), dir = d => d.clone().applyQuaternion(q);
    return { centre: out(READY.centre), R: { palm: dir(READY.R.palm), fingers: dir(READY.R.fingers), pole: dir(READY.R.pole) }, L: { palm: dir(READY.L.palm), fingers: dir(READY.L.fingers), pole: dir(READY.L.pole) } };
  };
  const GRIP = [26, 30, 34, 40]; // fingers wrapped on the ball
  function poseReady(lift = 0) {
    const ready = fromChest(); ready.centre.y += lift;
    holdBall(B.R, ready.centre, ready.R.palm, ready.R.fingers, ready.R.pole); setFingers(B.R, GRIP, 9, 12);
    holdBall(B.L, ready.centre, ready.L.palm, ready.L.fingers, ready.L.pole); setFingers(B.L, GRIP, 9, 12);
    setSocket(B.R, ready.centre); setSocket(B.L, ready.centre);
    return ready;
  }

  // ---- Baking a pose function into a clip ----
  function bake(name, duration, pose) {
    const count = Math.max(2, Math.round(duration * FPS) + 1), times = new Float32Array(count);
    const rotations = upper.map(() => new Float32Array(count * 4)), sockets = [B.R.socket, B.L.socket].map(() => new Float32Array(count * 3));
    const previous = upper.map(() => new THREE.Quaternion());
    for (let i = 0; i < count; i++) {
      const t = times[i] = Math.min(duration, i / FPS);
      pose(t); rig.updateMatrixWorld(true);
      upper.forEach((bone, n) => {
        const q = bone.quaternion.clone().normalize();
        if (i && previous[n].dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w); // keep neighbouring keys on the same side
        previous[n].copy(q); q.toArray(rotations[n], i * 4);
      });
      [B.R.socket, B.L.socket].forEach((socket, n) => socket.position.toArray(sockets[n], i * 3));
    }
    return new THREE.AnimationClip(name, duration, [
      ...upper.map((bone, n) => new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, rotations[n])),
      ...[B.R.socket, B.L.socket].map((socket, n) => new THREE.VectorKeyframeTrack(`${socket.name}.position`, times, sockets[n])),
    ]);
  }
  // A shipped clip with its legs and torso kept and its arms re-posed on the ready hold.
  function rebuildCarry(name, lift = () => 0) {
    const source = original.get(name);
    const arms = bake(name, source.duration, t => { applyClip(name, t); poseReady(lift(t / source.duration)); });
    const kept = source.tracks.filter(track => { const node = rig.getObjectByName(THREE.PropertyBinding.parseTrackName(track.name).nodeName); return !node || !upperSet.has(node) || torsoBones.includes(node); });
    const mine = arms.tracks.filter(track => !torsoBones.includes(rig.getObjectByName(THREE.PropertyBinding.parseTrackName(track.name).nodeName)));
    return new THREE.AnimationClip(name, source.duration, [...kept, ...mine]);
  }

  // A shipped ball clip kept exactly as it moves the ball, with each hand turned over so its PALM
  // faces the ball where the back of the hand did. The ball's path through the clip (and so every
  // grip, release and shot) is unchanged; the wrist shifts the few centimetres that takes.
  function reface(name, wholeBody = false) {
    const source = original.get(name); if (!source) return null;
    const X = V(1, 0, 0), Y = V(0, 1, 0);
    const turned = bake(name, source.duration, t => {
      applyClip('Idle_Ball', 0); applyClip(name, t);
      for (const A of [B.R, B.L]) {
        const ball = worldP(A.socket), shoulder = worldP(A.arm), elbow = worldP(A.fore);
        const from = worldQ(A.hand).multiply(bind.get(A.hand).clone().invert());
        const hand = handQuaternion(A, Y.clone().applyQuaternion(from), X.clone().multiplyScalar(A.sign).applyQuaternion(from));
        solveArm(A, ball.clone().addScaledVector(hand.f, -PALM.along).addScaledVector(hand.p, -PALM.off), elbow.sub(shoulder), hand.q);
        setSocket(A, ball);
      }
    });
    if (!wholeBody) return turned;
    const kept = source.tracks.filter(track => { const node = rig.getObjectByName(THREE.PropertyBinding.parseTrackName(track.name).nodeName); return !node || !upperSet.has(node); });
    return new THREE.AnimationClip(name, source.duration, [...kept, ...turned.tracks]);
  }

  // ---- The torso, set in the world and blended against the idle torso ----
  function setTorso({ pitch = 0, yaw = 0, roll = 0, headYaw = 0, headPitch = 0 }) {
    for (const [bone, k] of [[B.spine, .4], [B.spine1, .72], [B.spine2, 1]]) setWorld(bone, euler(pitch * k, yaw * k, roll * k).multiply(bind.get(bone)));
    setWorld(B.neck, euler(pitch * .45 + headPitch * .5, yaw * .5 + headYaw * .5, roll * .3).multiply(bind.get(B.neck)));
    setWorld(B.head, euler(headPitch, headYaw, 0).multiply(bind.get(B.head)));
  }

  // =====================================================================================
  // The dribble: a relaxed right-hand pound dribble, three bounces, from and back to the hold.
  // =====================================================================================
  const D = (() => {
    // The ball's own numbers come first; the hand is built around them. From a release at yRelease
    // going down at v0, the floor returns it (restitution) to yCatch on the way up after `flight`.
    const yTop = .87, yRelease = .71, yCatch = .775, v0 = 3.05, push = .135, cushion = .16, follow = .07, lead = .44, out = .46, bounces = 3;
    const impact = Math.sqrt(v0 * v0 + 2 * G * (yRelease - radius)), bounce = restitution * impact;
    const rising = Math.sqrt(bounce * bounce - 2 * G * (yCatch - radius));
    const flight = (impact - v0) / G + (bounce - rising) / G, period = push + flight + cushion;
    const meet = rising * .75, yLow = yRelease - .07; // the ball lifts the hand as it arrives
    const beats = Array.from({ length: bounces }, (_, i) => ({ release: lead + i * period + push, catch: lead + i * period + push + flight }));
    const last = lead + bounces * period; // the hand is back on top after the last catch
    // How high the palm's ball point is through one cycle (s from the top of a push).
    const cycle = s => s <= push ? hermite(s, 0, yTop, 0, push, yRelease, -v0)
      : s <= push + follow ? hermite(s, push, yRelease, -v0, push + follow, yLow, 0)
      // (free of the ball: follow through, come back up early and wait where it will arrive; the
      // runtime's short reach then takes the hand down onto the rising ball)
      : s <= push + flight * .62 ? hermite(s, push + follow, yLow, 0, push + flight * .62, yCatch, 0)
      : s <= push + flight ? yCatch
      : hermite(s, push + flight, yCatch, meet, period, yTop, 0);
    // The wrist: cocked back to receive, flexed through the push, loose on the way back up.
    const flex = through([[0, 6], [push, -30], [push + follow, -40], [push + flight * .62, 4], [push + flight, 16], [period, 6]]);
    return { yTop, lead, out, bounces, period, push, flight, cushion, beats, last, duration: last + out, cycle, flex };
  })();

  function poseDribble(t) {
    // Legs: the shipped dribble stance, coming in and going out as the court layers will blend it.
    applyClip('Idle_Ball', 0);
    const stance = span(t, 0, .26) < 1 ? smooth(span(t, 0, .26)) : 1 - smooth(span(t, D.duration - .3, D.duration));
    const standing = snapshot(lower);
    applyClip('Dribble_Idle_Lower', 0, lowerSet);
    blendTo(standing, snapshot(lower), stance); rig.updateMatrixWorld(true);
    const foot = worldP(B.footR), hips = worldP(B.hips);
    // In time with the ball: s runs through one bounce, `work` is how hard the push is on.
    const live = t >= D.lead && t < D.last, s = live ? (t - D.lead) % D.period : 0;
    const work = live ? Math.sin(Math.PI * span(s, -.02, D.push + .1)) ** 2 : 0;
    const into = smooth(span(t, .02, D.lead)), away = smooth(span(t, D.last, D.duration - .05)), active = into * (1 - away);
    // Torso: a forward lean over bent knees, right shoulder a little lower and giving with each push.
    const idleTorso = snapshot(torsoBones);
    setTorso({ pitch: 19 + 2.6 * work, yaw: -7 - 1.5 * work, roll: 4 + 3.2 * work, headPitch: 3, headYaw: 3 });
    blendTo(idleTorso, snapshot(torsoBones), active); rig.updateMatrixWorld(true);
    const ready = fromChest();
    // The ball's line: beside and a little ahead of the right foot, clear of the knee.
    const line = V(Math.min(foot.x - .2, -.33), 0, foot.z + .2);
    const height = live ? D.cycle(s) : D.yTop, angle = (live ? D.flex(s) : 6) * Math.PI / 180;
    const heading = V(Math.sin(.2), 0, Math.cos(.2)); // fingers ahead, turned slightly in
    const dribble = { centre: V(line.x, height, line.z), palm: UP.clone().multiplyScalar(-Math.cos(angle)).addScaledVector(heading, Math.sin(angle)),
      fingers: heading.clone().multiplyScalar(Math.cos(angle)).addScaledVector(UP, Math.sin(angle)), pole: V(-.72, .1, -.68) };
    // Right hand: from the hold, over the top of the ball and down to the dribble line, and back.
    const k = active, arc = Math.sin(Math.PI * k) * .05;
    const centre = mix(ready.centre, dribble.centre, k); centre.y += arc * .4; centre.x -= arc;
    // (from under the ball to on top of it the palm rolls round the ball's outer side)
    const roll = smooth(span(k, .04, .9));
    const palm = arcVia(ready.R.palm, V(.92, .1, .38), dribble.palm, roll), fingers = arcDir(ready.R.fingers, dribble.fingers, roll);
    const held = holdBall(B.R, centre, palm, fingers, mixDir(ready.R.pole, dribble.pole, k));
    setSocket(B.R, palmPoint(B.R, held.p, held.f));
    // Fingers: spread on the ball, opening a touch as it leaves.
    const open = live ? smooth(span(s, D.push - .02, D.push + .08)) * (1 - smooth(span(s, D.push + D.flight - .1, D.push + D.flight))) : 0;
    setFingers(B.R, GRIP.map(c => lerp(c, c * .45, open)), lerp(9, 13, k), 12);
    // Left arm: lets go as the ball leaves the hold, then rides loose at the ribs, moving against the push.
    const guard = { wrist: V(.235 + .01 * work, hips.y + .03 + .03 * work, .15 + .04 * work), palm: V(-.8, -.55, -.2), fingers: V(-.18, -.6, .78), pole: V(.34, -.35, -.87) };
    const leave = smoother(span(t, .1, D.lead - .02)) * (1 - smoother(span(t, D.last + .06, D.duration - .08)));
    const onBall = handQuaternion(B.L, ready.L.palm, ready.L.fingers);
    const leftWrist = mix(ready.centre.clone().addScaledVector(onBall.f, -PALM.along).addScaledVector(onBall.p, -PALM.off), guard.wrist, leave);
    const left = handQuaternion(B.L, mixDir(ready.L.palm, guard.palm, leave), mixDir(ready.L.fingers, guard.fingers, leave));
    solveArm(B.L, leftWrist, mixDir(ready.L.pole, guard.pole, leave), left.q);
    setFingers(B.L, GRIP.map(c => lerp(c, 22, leave)), 9, 12);
    setSocket(B.L, palmPoint(B.L, left.p, left.f));
  }

  // =====================================================================================
  // The finger spin: lift, set it turning with the left hand, balance it on the index, catch.
  // =====================================================================================
  const S = { lift: .46, flick: .5, support: .84, hold: 2.2, caught: 2.58, duration: 3.08 };
  function poseSpin(t) {
    applyClip('Idle_Ball', 0);
    const up = smoother(span(t, .03, S.lift)), on = smooth(span(t, S.flick - .04, S.support)), off = smooth(span(t, S.hold, S.caught)), down = smoother(span(t, S.caught - .04, S.duration - .04));
    const finger = on * (1 - off), raised = up * (1 - down); // on the fingertip; up off the hold
    // Torso: opens a little toward the ball; the head follows it.
    const idleTorso = snapshot(torsoBones);
    setTorso({ pitch: 1.5, yaw: -9, roll: -1.5, headYaw: -27, headPitch: -7 });
    blendTo(idleTorso, snapshot(torsoBones), raised * (1 - .35 * off)); rig.updateMatrixWorld(true);
    const ready = fromChest(), shoulder = worldP(B.R.arm);
    // Balance: the supporting finger never quite stops, two slow drifts a few millimetres wide.
    const sway = V(Math.sin(t * 5.1) * .006 + Math.sin(t * 8.3 + 1) * .003, Math.sin(t * 6.7 + .5) * .003, Math.cos(t * 4.4 + .7) * .006 + Math.sin(t * 9.1) * .003).multiplyScalar(finger);
    const cradle = V(shoulder.x - .1, shoulder.y - .12, shoulder.z + .4), perch = V(shoulder.x - .22, shoulder.y + .18, shoulder.z + .3).add(sway);
    const centre = mix(mix(ready.centre, cradle, raised), perch, finger);
    // Right hand: under the ball in the hold, flat beneath it for the lift, then the index straight up.
    const flat = { palm: V(.12, 1, -.05), fingers: V(.3, .08, .95) };
    const upright = { palm: V(.7, .05, -.71), fingers: V(.03 + sway.x * 2.2, 1, -.04 + sway.z * 2.2) };
    const palm = mixDir(mixDir(ready.R.palm, flat.palm, raised), upright.palm, finger), fingers = mixDir(mixDir(ready.R.fingers, flat.fingers, raised), upright.fingers, finger);
    const pole = mixDir(mixDir(ready.R.pole, V(-.6, -.75, -.3), raised), V(-.4, -.9, -.1), finger);
    const { q, p, f } = handQuaternion(B.R, palm, fingers);
    // The index stays long; the others fold away as the ball goes up onto it.
    setFingers(B.R, [lerp(GRIP[0], 0, smooth(span(finger, 0, .6))), lerp(GRIP[1], 78, finger), lerp(GRIP[2], 84, finger), lerp(GRIP[3], 88, finger)], lerp(9, 2, finger), lerp(12, 34, finger));
    // Where the ball rests against this hand: in the palm, or a radius above the fingertip along
    // the finger. Solve once to measure that point, then shift the wrist so it lands on `centre`.
    const contact = () => {
      const tip = worldP(B.indexEnd), along = tip.clone().sub(worldP(B.R.fingers[0][2])).normalize();
      return mix(palmPoint(B.R, p, f), tip.addScaledVector(along, radius), finger);
    };
    let wrist = centre.clone().addScaledVector(f, -PALM.along).addScaledVector(p, -PALM.off);
    for (let pass = 0; pass < 3; pass++) { solveArm(B.R, wrist, pole, q); wrist = wrist.add(centre).sub(contact()); }
    solveArm(B.R, wrist, pole, q);
    setSocket(B.R, contact());
    // Left hand: helps the lift, strokes back along the ball's side to set it turning, drifts
    // down out of the way, and comes back under the ball to take it off the finger.
    const hips = worldP(B.hips);
    const rest = { wrist: V(.27, hips.y - .02, .1), palm: V(-.8, -.5, -.2), fingers: V(-.15, -.72, .68), pole: V(.6, -.2, -.78) };
    const stroke = smooth(span(t, S.flick - .02, S.flick + .15));
    const side = { palm: V(-1, -.08, lerp(-.3, .25, stroke)), fingers: V(-.15, lerp(.25, .5, stroke), lerp(.95, .85, stroke)), pole: V(.8, -.5, -.3) };
    const sideCentre = centre.clone().add(V(0, lerp(-.01, .03, stroke), lerp(.05, -.11, stroke)));
    const gone = smoother(span(t, S.flick + .13, S.flick + .5)) * (1 - smoother(span(t, S.hold + .04, S.caught)));
    const help = raised * (1 - gone); // on the ball's side while it is up
    const onSide = handQuaternion(B.L, mixDir(ready.L.palm, side.palm, raised), mixDir(ready.L.fingers, side.fingers, raised));
    const sideWrist = mix(ready.centre, sideCentre, raised).addScaledVector(onSide.f, -PALM.along).addScaledVector(onSide.p, -PALM.off);
    const left = handQuaternion(B.L, mixDir(onSide.p, rest.palm, gone), mixDir(onSide.f, rest.fingers, gone));
    solveArm(B.L, mix(sideWrist, rest.wrist, gone), mixDir(mixDir(ready.L.pole, side.pole, raised), rest.pole, gone), left.q);
    setFingers(B.L, GRIP.map(c => lerp(c, 20, gone)), 9, 12);
    setSocket(B.L, palmPoint(B.L, left.p, left.f));
  }

  // ---- Build, and swap the clips and their event times in ----
  const built = new Map();
  built.set('Idle_Ball', rebuildCarry('Idle_Ball', k => Math.sin(k * Math.PI * 2) * .004));
  built.set('Walk_Ball', rebuildCarry('Walk_Ball'));
  if (original.has('Run_Ball_Upper')) built.set('Run_Ball_Upper', rebuildCarry('Run_Ball_Upper', k => .015 + Math.sin(k * Math.PI * 4) * .006));
  // The shot and the pickups keep their own motion; their hands are turned palm-to-ball so they
  // meet the new hold without the ball passing round the hand.
  if (original.has('Jump_Shot_Upper')) built.set('Jump_Shot_Upper', reface('Jump_Shot_Upper'));
  for (const name of ['Pick_Up_Ball', 'Retrieve_Ball', 'Put_Down_Ball']) if (original.has(name)) built.set(name, reface(name, true));
  const dribble = bake('Dribble_Upper', D.duration, poseDribble), spin = bake('Ball_Spin_Upper', S.duration, poseSpin);
  built.set('Dribble_Upper', dribble); built.set('Dribble', new THREE.AnimationClip('Dribble', D.duration, dribble.tracks));
  built.set('Ball_Spin_Upper', spin); built.set('Ball_Spin', new THREE.AnimationClip('Ball_Spin', S.duration, spin.tracks));
  for (let i = 0; i < clips.length; i++) if (built.has(clips[i].name)) clips[i] = built.get(clips[i].name);
  for (const [name, clip] of built) if (!clips.includes(clip)) clips.push(clip);

  meta.clips ??= {};
  const dribbleEvents = {};
  D.beats.forEach((beat, i) => { dribbleEvents[i ? `release_${i + 1}` : 'release'] = beat.release; dribbleEvents[i ? `catch_${i + 1}` : 'catch'] = beat.catch; });
  meta.clips.Dribble = { ...meta.clips.Dribble, duration: D.duration, events: dribbleEvents };
  meta.clips.Ball_Spin = { ...meta.clips.Ball_Spin, duration: S.duration, events: { spin_start: S.flick, support: S.support, spin_end: S.hold, catch: S.caught } };
  meta.dribble = { ...meta.dribble, catchTolerance: .05,
    // The hand reaches down onto the rising ball and rides up with it for a moment before it
    // counts as caught (catchEarly), so the two are already moving together at the hand-over.
    beats: D.beats.map(beat => ({ ...beat, hand: 'right', receiveHand: 'right', initialVelocity: [0, -3, 0], catchEarly: .04, catchLate: .12 })) };
  return { dribble: { ...D, cycle: undefined, flex: undefined }, spin: S, radius };
}
