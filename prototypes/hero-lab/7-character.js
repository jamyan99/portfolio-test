import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createBallPhysics, solveDribbleDownSpeed } from './7-physics.js?v=10';
import { createNavigation, screenDirection } from './7-navigation.js?v=9';
import { createCourtMotion } from './7-motion.js?v=10';
import { createReceivingReach } from './7-reach.js?v=5';
import { planCourtRoute, findPickupApproach, constrainCourtStep, ROOM_DIVIDER } from './7-court.js?v=10';
import { mountPlaygroundSky } from './7-celestial.js?v=1';
import { bakeHandles } from './7-handles.js?v=1';

const A = new URL('./7-assets/', import.meta.url);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const DESK = V(-2, 0, 0), COURT = V(.7, 0, .5), HOOP = V(2.7, 3.05, -2.4);
const COURT_YAW = Math.atan2(HOOP.x - COURT.x, HOOP.z - COURT.z);
// Brisk scripted trips are independent of the visitor's controller speed.
const QUICK_TRAVEL = { speed: 2.3 };
// A scripted trip speeds up and slows down at this rate (mean, m/s2), so a short hop never
// reaches full pace and a long one starts and stops like a person, not like a clip being cut.
const TRAVEL_ACCELERATION = 6;
// The body turns at most this fast (rad/s; about 600 degrees a second).
const TURN_SPEED = 10.5;
const ease = t => t * t * (3 - 2 * t);
// C2 continuity removes the little acceleration jerk at either end of the same camera path.
const cameraEase = t => t * t * t * (t * (t * 6 - 15) + 10);
const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
// Critically damped follow, exact in dt: both the value and its speed are continuous, so a turn or
// a camera move starts and ends softly at any frame rate. maxSpeed caps how fast it may go.
function damp(current, target, velocity, smoothTime, dt, maxSpeed = Infinity) {
  const omega = 2 / smoothTime;
  let error = current - target;
  if (Number.isFinite(maxSpeed)) { const limit = maxSpeed * smoothTime / .736; error = Math.max(-limit, Math.min(limit, error)); }
  const goal = current - error, decay = Math.exp(-omega * dt), drift = (velocity + omega * error) * dt;
  return { value: goal + (error + drift) * decay, velocity: (velocity - omega * drift) * decay };
}

// container: the element the playground's own markup lives in. Every lookup, style hook and
// pointer/key listener stays inside it, so the scene can be one room of a larger page (the frozen
// lake's south shore) without touching that page's own stage or hero. Parts are found by
// data-pg="name", or by #name on the standalone Playground page.
// embedded: the scene is a room of another page. It then keeps its light switch to itself (no
// page theme), draws no page-wide sky, and leaves Escape to the page.
export async function mount({ explicit = false, container = document, embedded = false } = {}) {
  const find = name => container.querySelector(`[data-pg="${name}"]`) ?? container.querySelector(`#${name}`);
  const stage = find('stage'), hero = find('hero');
  const status = find('status'), controls = find('controls');
  const charHit = find('character-hit'), lampHit = find('lamp-hit'), ballHit = find('ball-hit');
  const pauseButton = find('pause'), aimIndicator = find('aim-indicator');
  const laptopHit = find('laptop-hit');
  const breakButton = find('take-break'), courtMoves = find('court-moves');
  const returnButton = find('return-desk'), controlHint = find('control-hint');
  const directionPad = find('direction-pad');
  const playButton = find('play'), poster = find('poster');
  const themeRoot = embedded ? hero : document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const celestialSky = embedded ? { draw() {}, setTheme() {} } : mountPlaygroundSky();
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { throw new Error('WebGL unavailable', { cause: e }); }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.id = 'character-canvas';
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(37, 1, .1, 65);
  const cameraWork = V(-4.5, 2.35, -2.6), cameraPlay = V(6, 4, 8.5);
  camera.position.copy(cameraWork);
  const lookWork = V(-1.95, .65, .42), lookPlay = V(1.1, 1.5, -.7), look = lookWork.clone();
  let cameraView = 'working', roomProgress = 0, cameraProgress = 0, cameraVelocity = 0;
  const roomCutaways = [];
  function frameView(view, progress = view === 'working' ? 0 : 1) {
    const phone = stage.clientWidth < 600;
    if (view !== cameraView) log('camera_view', { view });
    cameraView = view;
    roomProgress = THREE.MathUtils.clamp(progress, 0, 1);
    const blend = reduced.matches ? Number(roomProgress >= .5) : cameraEase(roomProgress), arc = Math.sin(Math.PI * blend);
    const workEye = phone ? V(-4.25, 2.4, -2.5) : cameraWork;
    const playLook = phone ? V(1.35, 1.55, -.95) : lookPlay;
    const playEye = (phone ? V(5.2, 3.5, 5.8) : cameraPlay.clone()).sub(playLook)
      .multiplyScalar(phone ? Math.max(1.25, .90 / camera.aspect) : Math.max(1, .87 / camera.aspect)).add(playLook);
    const workFov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(phone ? 47 : 39) / 2)
      * Math.max(1, (phone ? .92 : 1.08) / camera.aspect)));
    camera.position.copy(workEye).lerp(playEye, blend);
    camera.position.x -= 2 * arc; camera.position.y += .9 * arc;
    look.copy(lookWork).lerp(playLook, blend);
    camera.fov = THREE.MathUtils.lerp(workFov, phone ? 47 : 37, blend) + 10 * arc;
    camera.updateProjectionMatrix();
    // Camera-side architecture becomes a cutaway as the view leaves the room.
    // The doorway frame, floor boundary and matching solids remain in place.
    const opacity = 1 - ease(THREE.MathUtils.clamp((camera.position.x + 2.2) / .8, 0, 1));
    for (const mesh of roomCutaways) {
      mesh.visible = opacity > .001; mesh.material.opacity = opacity;
      mesh.material.depthWrite = opacity > .99;
    }
    camera.lookAt(look);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), .04);
  scene.environment = environment.texture;
  scene.environmentIntensity = .48;
  pmrem.dispose();
  const fill = new THREE.HemisphereLight(0xfff8ec, 0xd5d4cc, 1.05); scene.add(fill);
  const key = new THREE.SpotLight(0xffecd4, 700, 0, .34, .3, 2);
  // A distant, focused sunbeam passes through the real opening. The finite
  // beam avoids directional-shadow-frustum light leaking onto the far floor.
  key.position.set(7, 8.5, -10); key.castShadow = true;
  const initialShadowSize = stage.clientWidth < 600 ? 1024 : 1536;
  key.shadow.mapSize.set(initialShadowSize, initialShadowSize);
  Object.assign(key.shadow.camera, { near: .5, far: 40 });
  key.shadow.normalBias = .008; key.shadow.bias = -.00015; key.shadow.radius = 3;
  scene.add(key);
  const lampLight = new THREE.PointLight(0xffcd8e, 0, 4, 2); lampLight.position.set(-2.7, 1.3, .8); scene.add(lampLight);
  const ktx = new KTX2Loader().setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/libs/basis/').detectSupport(renderer);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx);
  status.textContent = 'Preparing the playground';
  const [studioGLTF, characterGLTF, ballGLTF, meta, physics] = await Promise.all([
    loader.loadAsync(new URL('studio.glb?v=10', A).href), loader.loadAsync(new URL('character.glb?v=8', A).href),
    loader.loadAsync(new URL('ball.glb?v=9', A).href), fetch(new URL('character-events.json?v=8', A)).then(r => { if (!r.ok) throw Error('Animation events missing'); return r.json(); }),
    createBallPhysics({ THREE, hoop: HOOP.toArray(), roomDivider: ROOM_DIVIDER }),
  ]);
  const studio = studioGLTF.scene, character = characterGLTF.scene, ball = ballGLTF.scene;
  // The ready hold, the dribble and the finger spin are re-authored on this skeleton at load
  // (7-handles.js): same bones, sockets, events and physics, new poses and timing.
  const handles = bakeHandles({ THREE, character, clips: characterGLTF.animations, meta,
    radius: meta.dribble?.radius ?? .12, restitution: meta.dribble?.restitution ?? .82 });
  scene.add(studio, ball);
  const root = new THREE.Group(); root.name = 'CharacterPath'; root.position.copy(DESK); root.add(character); scene.add(root);
  // Small, feathered contact shadows anchor feet/props at phone resolution;
  // directional shadows still supply the actual moving silhouette.
  const contactPixels = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const radiusSquared = ((x - 31.5) / 31.5) ** 2 + ((y - 31.5) / 31.5) ** 2;
    const offset = (y * 64 + x) * 4;
    contactPixels[offset] = contactPixels[offset + 1] = contactPixels[offset + 2] = 255;
    contactPixels[offset + 3] = Math.round(255 * Math.max(0, 1 - radiusSquared) ** 2);
  }
  const contactTexture = new THREE.DataTexture(contactPixels, 64, 64, THREE.RGBAFormat);
  contactTexture.needsUpdate = true;
  contactTexture.magFilter = contactTexture.minFilter = THREE.LinearFilter;
  const contactGeometry = new THREE.PlaneGeometry(1, 1);
  function contactShadow(x, z, width, depth, opacity) {
    const shadow = new THREE.Mesh(contactGeometry, new THREE.MeshBasicMaterial({ map: contactTexture,
      color: 0x655b4b, opacity, transparent: true, depthWrite: false, toneMapped: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.set(x, .0005, z); shadow.scale.set(width, depth, 1);
    shadow.renderOrder = 1; scene.add(shadow); return shadow;
  }
  const footContact = contactShadow(DESK.x, DESK.z, .7, .6, .2);
  const ballContact = contactShadow(0, 0, .46, .46, .44);
  contactShadow(2.7, -2.87, .95, .8, .18); contactShadow(4.17, -2.25, .95, .85, .18);
  contactShadow(-2, .8, 2.05, 1.0, .14); contactShadow(-2, 0, .85, .7, .16);
  for (const x of [-2.81, -1.19]) for (const z of [.52, 1.08]) contactShadow(x, z, .19, .19, .22);
  const netResponse = new THREE.Group(); netResponse.position.copy(HOOP); scene.add(netResponse);
  const netMeshes = []; studio.traverse(o => { if (o.isMesh && /^HoopNet/.test(o.name)) netMeshes.push(o); });
  scene.updateMatrixWorld(true); for (const mesh of netMeshes) netResponse.attach(mesh);
  const celestialWalls = [], celestialFloors = [];
  const wallSky = { time: { value: 12 }, amount: { value: 1 } };
  studio.traverse(o => { if (o.isMesh) {
    o.castShadow = !o.userData.noShadow && (o.userData.sunOccluder || !/wall|floor|court|cove/i.test(o.name));
    o.receiveShadow = !o.userData.noShadow;
    if (o.userData.runtimeCutaway) { o.material = o.material.clone(); o.material.transparent = true; roomCutaways.push(o); }
    if (/^(RoomWalls|RoomCameraCutaway|ArchWindow_Wall|ArchWindow_PlasterFace|ArchWindow_DeepReveal)/.test(o.name)) {
      o.material = o.material.clone();
      const material = o.material;
      celestialWalls.push({ material, color: material.color.clone(), emissive: material.emissive.clone(), intensity: material.emissiveIntensity });
      // The projection lives on the physical plaster, so geometry and character naturally occlude it.
      material.onBeforeCompile = shader => {
        shader.uniforms.uWallSkyTime = wallSky.time;
        shader.uniforms.uWallSkyAmount = wallSky.amount;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWallSkyPosition;')
          .replace('#include <project_vertex>', 'vWallSkyPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
          varying vec3 vWallSkyPosition;
          uniform float uWallSkyTime;
          uniform float uWallSkyAmount;
          float wallSkyHash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        `).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          vec2 wallSkyPoint = vec2(vWallSkyPosition.x + vWallSkyPosition.z * .63, vWallSkyPosition.y);
          vec2 wallSkyGrid = wallSkyPoint * 10.;
          vec2 wallSkyCell = floor(wallSkyGrid);
          float wallSkySeed = wallSkyHash(wallSkyCell);
          vec2 wallSkyOffset = vec2(wallSkyHash(wallSkyCell + 1.3), wallSkyHash(wallSkyCell + 7.1)) * .64 + .18;
          float wallSkyDistance = length(fract(wallSkyGrid) - wallSkyOffset);
          float wallSkyStar = step(.955, wallSkySeed) * (smoothstep(.065, .0, wallSkyDistance) + .15 * exp(-wallSkyDistance * wallSkyDistance * 55.));
          float wallSkyTwinkle = .92 + .08 * sin(uWallSkyTime * .4 + wallSkySeed * 24.);
          float wallSkyHem = 2.25 + .42 * sin(wallSkyPoint.x * 1.1 + uWallSkyTime * .035) + .2 * sin(wallSkyPoint.x * 2.5 - uWallSkyTime * .025);
          float wallSkyCurtain = exp(-pow((wallSkyPoint.y - wallSkyHem) * 1.7, 2.)) * (.72 + .28 * sin(wallSkyPoint.x * 9. + uWallSkyTime * .06));
          vec3 wallSkyColor = mix(vec3(.08,.34,.28), vec3(.18,.16,.34), smoothstep(wallSkyHem, wallSkyHem + .75, wallSkyPoint.y));
          totalEmissiveRadiance += uWallSkyAmount * (vec3(.55,.69,.9) * wallSkyStar * wallSkyTwinkle * .55 + wallSkyColor * wallSkyCurtain * .12);
        `);
      };
      material.customProgramCacheKey = () => 'celestial-plaster-v1';
    }
    if (/^(RoomFloor|CourtFloor)$/.test(o.name)) {
      o.material = o.material.clone();
      celestialFloors.push({ material: o.material, color: o.material.color.clone(), room: o.name === 'RoomFloor' });
    }
  } });
  character.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  ball.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const mixer = new THREE.AnimationMixer(character);
  const actions = new Map(characterGLTF.animations.map(c => [c.name, mixer.clipAction(c)]));
  if (!actions.has('Sit_Typing') || !actions.has('Jump_Shot')) throw Error('Required skeletal clips missing');
  // One short bridge covers every hard hand-over of the pose: between a full-body clip and the
  // layered court motion (their tracks can't cross-fade inside the mixer, so the switch used to
  // land in a single frame), and into each basketball move. holdPose() notes the pose on screen;
  // the difference between it and the incoming pose is measured once, then eased away on top of
  // the incoming animation (inertial blending). Because the difference is fixed at the hand-over
  // it can't swing a hand the long way round, which a cross-fade between two nearly opposite
  // poses did. It only touches bone rotations and offsets: clip clocks, contact events and the
  // root path are left alone.
  const skeleton = []; character.traverse(o => { if (o.isBone) skeleton.push(o); });
  const poseOf = bone => ({ q: bone.quaternion.clone(), p: bone.position.clone() });
  const bridge = { held: skeleton.map(poseOf), offset: skeleton.map(poseOf), clean: skeleton.map(poseOf), wrote: skeleton.map(poseOf), time: 0, length: 0, fresh: false };
  function holdPose(length = .24) {
    for (let i = 0; i < skeleton.length; i++) { bridge.held[i].q.copy(skeleton[i].quaternion); bridge.held[i].p.copy(skeleton[i].position); }
    bridge.time = 0; bridge.length = reduced.matches ? .03 : length; bridge.fresh = true;
  }
  function bridgePose(step = 0) {
    if (!bridge.fresh && bridge.time >= bridge.length) return;
    bridge.time += step;
    const amount = 1 - cameraEase(Math.min(1, bridge.time / bridge.length));
    for (let i = 0; i < skeleton.length; i++) {
      const bone = skeleton[i], clean = bridge.clean[i], wrote = bridge.wrote[i], offset = bridge.offset[i];
      // The mixer rewrites a bone only when its animated value changed. Where it left our own last
      // write in place, work from the animated value remembered instead of bridging twice.
      if (!bone.quaternion.equals(wrote.q)) clean.q.copy(bone.quaternion);
      if (!bone.position.equals(wrote.p)) clean.p.copy(bone.position);
      if (bridge.fresh) { offset.q.copy(clean.q).invert().premultiply(bridge.held[i].q); offset.p.copy(bridge.held[i].p).sub(clean.p); }
      bone.quaternion.identity().slerp(offset.q, amount).multiply(clean.q);
      bone.position.copy(clean.p).addScaledVector(offset.p, amount);
      wrote.q.copy(bone.quaternion); wrote.p.copy(bone.position);
    }
    bridge.fresh = false;
  }
  function makeSocket(kind, fallbackBone, offset) {
    const spec = meta.sockets?.[kind] ?? {};
    const socketNames = { grip: 'RightHandSocket', leftGrip: 'LeftHandSocket', spin: 'RightIndexTipSocket' };
    const existing = character.getObjectByName(spec.node ?? socketNames[kind]);
    if (existing) return existing;
    const bone = character.getObjectByName(spec.bone ?? fallbackBone) ?? character.getObjectByName(fallbackBone.replace(':', ''));
    if (!bone) throw Error(`Missing ${kind} bone`);
    const socket = new THREE.Object3D(); socket.name = `Runtime_${kind}`;
    socket.position.fromArray(spec.offset ?? offset); bone.add(socket); return socket;
  }
  const handSocket = makeSocket('grip', 'mixamorigRightHand', [0, .08, 0]);
  const leftHandSocket = makeSocket('leftGrip', 'mixamorigLeftHand', [0, .08, 0]);
  const spinSocket = makeSocket('spin', 'mixamorigRightHandIndex3', [0, .14, 0]);
  const indexSupport = character.getObjectByName('mixamorigRightHandIndex4')
    ?? character.getObjectByName('mixamorigRightHandIndex3')
    ?? character.getObjectByName('mixamorig:RightHandIndex4')
    ?? character.getObjectByName('mixamorig:RightHandIndex3');
  const temp = new THREE.Vector3(), quat = new THREE.Quaternion(), screen = new THREE.Vector3();
  const socketForHand = side => side === 'left' ? leftHandSocket : handSocket;
  const courtMotion = createCourtMotion({ THREE, mixer, clips: characterGLTF.animations, character });
  const reachReceivingHand = createReceivingReach({ THREE, character, socketForHand });
  function hand(spin = false, side = holdingHand) { character.updateMatrixWorld(true); return (spin ? spinSocket : socketForHand(side)).getWorldPosition(new THREE.Vector3()); }
  const clipMeta = name => meta.clips?.[name] ?? {};
  const eventTime = (name, event, fallback) => {
    const events = clipMeta(name).events;
    if (Array.isArray(events)) return events.find(e => e.name === event || e.type === event)?.time ?? fallback;
    return events?.[event] ?? (event === 'release' ? events?.detach : undefined) ?? fallback;
  };
  const duration = name => actions.get(name)?.getClip().duration ?? clipMeta(name).duration ?? 1;
  const suppliedBeats = meta.dribble?.beats;
  const dribbleBeats = (Array.isArray(suppliedBeats) && suppliedBeats.length ? suppliedBeats : [{
    release: eventTime('Dribble', 'release', duration('Dribble') * .22),
    catch: eventTime('Dribble', 'catch', duration('Dribble') * .65),
    hand: 'right', receiveHand: 'right', initialVelocity: meta.dribble?.initialVelocity ?? [0, -1, 0],
  }]).map((beat, index, beats) => {
    if (!Number.isFinite(beat.release) || !Number.isFinite(beat.catch) || beat.release < 0 || beat.catch <= beat.release
      || (index > 0 && beat.release <= beats[index - 1].catch)
      || !['right', 'left'].includes(beat.hand) || !['right', 'left'].includes(beat.receiveHand)
      || !Array.isArray(beat.initialVelocity) || beat.initialVelocity.length !== 3 || !beat.initialVelocity.every(Number.isFinite)) {
      throw Error(`Invalid dribble beat ${index + 1}`);
    }
    return { ...beat };
  });
  let current, clip = '', elapsed = 0, clipRate = 1, activeDone = null, finishAt = Infinity, queue = null, sequence = [], move = null;
  let state = 'working', ballState = 'parked', activeName = null, released = false, caught = false;
  let holdingHand = 'right', dribbleProgress = null;
  const navigation = createNavigation({ constrain: constrainCourtStep });
  const keyboardMovement = new Set(), pointerMovement = new Map();
  const movementCodes = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight']);
  let playerWalking = false, shotTurn = null, courtLayered = false, retrieving = false;
  let locomotion = { speed: 0, localX: 0, localZ: 0 };
  let receiveBlend = null;
  // A catch never moves the ball to the hand in one step. From contact the ball keeps to its own
  // arc and is eased onto the hand over a tenth of a second, so neither its position nor its
  // speed jumps at the hand-over.
  const settle = { from: new THREE.Vector3(), velocity: new THREE.Vector3(), age: Infinity, length: .12 };
  const actionAnchor = COURT.clone();
  let visible = true, userPaused = false, contextLost = false, lastFrame = performance.now(), time = 0, stateTime = 0;
  let breakStartedAt = null, arrivalSeconds = null, lastInput = 0, makes = 0, shots = 0, restartLock = false;
  let drawFrames = 0, totalSeconds = 0, quality = 1, sampleSeconds = 0, sampleFrames = 0, qualityChanges = 0;
  const aim = { yaw: 0, power: .5 };
  let spinAngle = 0, netPulseAt = -Infinity;
  const heldRotation = new THREE.Quaternion(), heldSocketRotation = new THREE.Quaternion();
  const wristDelta = new THREE.Quaternion(), spinDelta = new THREE.Quaternion(), identityRotation = new THREE.Quaternion();
  let heldRotationReady = false;
  const spinAxis = V(0, 1, 0), spinAnchor = new THREE.Vector3();
  const history = [], limits = { pendingMax: 0, releaseFrames: [], transitions: 0 };
  const reviewMode = new URLSearchParams(location.search).has('review');
  // Review-only continuity recorder (?review): how far any bone, the path root and the camera
  // move in one simulation step, so a pose pop or a snap shows up as a number, not an opinion.
  const reviewBones = []; character.traverse(o => { if (o.isBone) reviewBones.push(o); });
  const reviewPose = reviewBones.map(bone => bone.quaternion.clone());
  let recording = null, reviewHold = false, reviewRate = 1, reviewCamera = null;
  function recordStep(step) {
    // Where the ball is against the hands, every step: the grip sockets and the fingertip.
    recording.ball.push([+time.toFixed(4), clip, +elapsed.toFixed(4), ballState, ...physics.position.toArray().map(v => +v.toFixed(4)), +physics.velocity.y.toFixed(3),
      ...hand(false, 'right').toArray().map(v => +v.toFixed(4)), ...hand(false, 'left').toArray().map(v => +v.toFixed(4)), ...hand(true).toArray().map(v => +v.toFixed(4)), holdingHand]);
    let worst = 0, worstBone = '';
    for (let i = 0; i < reviewBones.length; i++) {
      const angle = reviewPose[i].angleTo(reviewBones[i].quaternion);
      if (angle > worst) { worst = angle; worstBone = reviewBones[i].name; }
      reviewPose[i].copy(reviewBones[i].quaternion);
    }
    recording.steps.push([+time.toFixed(4), +step.toFixed(5), state, clip, +worst.toFixed(5), worstBone,
      +root.position.x.toFixed(4), +root.position.z.toFixed(4), +root.rotation.y.toFixed(5), +locomotion.speed.toFixed(3)]);
  }
  let parked = V(-2.34, .12, .45), retrieveTarget = null;
  const notes = { working: 'Working at the desk', departing: 'Taking a break', ready: 'Your turn', action: 'Playing', retrieving: 'Retrieving the ball', returning: 'Back to work' };
  function announce(extra = '') {
    status.textContent = `${notes[state] ?? state}${extra ? ` · ${extra}` : ''}`;
    // Visible only in the explicit review URL, so contact verification can be
    // read through the browser's ordinary UI without private-state injection.
    if (reviewMode) status.textContent += ` · V${meta.motionVersion} · bounces ${physics.snapshot().bounces} · catches ${history.filter(e => e.event === 'dribble_catch').length} · hand ${holdingHand} · queue ${limits.pendingMax} · shot release ${limits.releaseFrames.at(-1)?.clipTime.toFixed(3) ?? '—'}`;
  }
  function log(event, detail = {}) {
    history.push({ t: Number(time.toFixed(3)), event, ...detail }); if (history.length > 180) history.shift();
    if (reviewMode) status.dataset.review = JSON.stringify({ state, clip, elapsed, clipRate, arrivalSeconds,
      holdingHand, ballState, queued: queue, shots, makes, limits, motionVersion: meta.motionVersion,
      dribble: dribbleProgress, physics: physics.snapshot(), history: history.slice(-70),
      root: root.position.toArray(), facing: root.rotation.y, navigation: navigation.snapshot(), controlVersion: 5,
      motion: courtMotion.snapshot(),
      animationWeights: [...actions.entries()].filter(([,a]) => a.enabled && a.isScheduled() && a.getEffectiveWeight() > .0001)
        .map(([name,a]) => ({ name, time: a.time, weight: a.getEffectiveWeight() })) });
  }
  function setState(next) { state = next; stateTime = 0; limits.transitions++; announce(); refreshButtons(); log('state', { state }); }
  function play(name, done = null, loop = false, lead = 0, rate = 1) {
    if (courtLayered) { holdPose(); courtMotion.exit(); courtLayered = false; }
    const action = actions.get(name);
    if (!action) throw Error(`Missing clip ${name}`);
    const blend = reduced.matches ? .03 : /Walk/.test(name) ? .22 : .18;
    let outgoing = false;
    for (const other of actions.values()) {
      if (other === action || !other.enabled || !other.isScheduled()) continue;
      const weight = other.getEffectiveWeight();
      if (weight > .0001) { other.stopFading().setEffectiveWeight(weight).fadeOut(blend); outgoing = true; }
      // A queued action can replace an intermediate Idle at zero weight while
      // its fade-in is still scheduled. Stop that fade instead of letting it
      // rise underneath the new action and double the total animation weight.
      else other.stop();
    }
    action.stopFading();
    action.reset().setEffectiveTimeScale(rate).setEffectiveWeight(1).setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop; action.play();
    if (outgoing) action.fadeIn(blend);
    current = action; clip = name; elapsed = 0; clipRate = rate; activeDone = done; released = false; caught = false;
    if (name === 'Dribble') dribbleProgress = dribbleBeats.map(() => ({ released: false, caught: false, missed: false, minSeparation: Infinity }));
    finishAt = loop ? Infinity : Math.max(0, duration(name) - lead);
    // Apply the fade's starting weights now, including inputs arriving between frames.
    mixer.update(0); bridgePose();
    log('clip', { clip: name, rate });
  }
  function consumeSequence() {
    if (sequence.length) { const next = sequence.shift(); next(); }
  }
  function runSequence(steps) { sequence = steps; consumeSequence(); }
  function stepClip(name, after, rate = 1) { return () => play(name, () => { const priorSequence = sequence; after?.(); if (sequence === priorSequence) consumeSequence(); }, false, .07, rate); }
  function walkTo(destination, carrying = false, finalYaw = null, pace = null) { return () => {
    const target = destination.clone(), start = root.position.clone();
    const waypoints = pace?.waypoints ?? planCourtRoute(start, target);
    if (!waypoints) { log('blocked_travel', { target: target.toArray() }); recoverCovered('obstructed-travel'); return; }
    const points = [start, ...waypoints.map(p => V(p.x, 0, p.z))];
    const lengths = points.slice(1).map((p, i) => p.distanceTo(points[i]));
    const d = lengths.reduce((total, length) => total + length, 0), name = carrying ? 'Walk_Ball' : 'Walk';
    if (d < .035) { root.position.copy(target); if (finalYaw !== null) root.rotation.y = finalYaw; consumeSequence(); return; }
    const nominalSpeed = clipMeta(name).speed ?? (clipMeta(name).strideMeters ? clipMeta(name).strideMeters / duration(name) : meta.walkSpeed ?? .8);
    const speed = Math.min(pace?.speed ?? nominalSpeed, Math.sqrt(TRAVEL_ACCELERATION * d));
    const ramp = speed / TRAVEL_ACCELERATION, walkTime = d / speed + ramp;
    const last = points.at(-1), beforeLast = points.at(-2);
    const endHeading = Math.atan2(last.x - beforeLast.x, last.z - beforeLast.z);
    // Time to settle on the final facing: longer for a bigger turn, never most of the trip.
    const turnOut = finalYaw === null ? 0 : Math.min(walkTime * .6, .3 + Math.abs(wrapAngle(finalYaw - endHeading)) / 6);
    // The legs come from the same stride-matched walk/run layers the visitor steers with, driven
    // by the real ground speed, so feet keep pace with the floor. (The trip used to play the walk
    // clip at up to twice its speed.) Without the ball the arms swing free.
    enterCourtMotion(); current = null;
    clip = name; elapsed = 0; clipRate = 1; activeDone = null; finishAt = Infinity; released = false; caught = false;
    yawVelocity = 0;
    move = { start, target, points, lengths, distance: d, speed, nominalSpeed, ramp, finalYaw, turnOut, carrying, yaw: root.rotation.y, length: walkTime, clock: 0,
      done: () => { move = null; root.position.copy(target); if (finalYaw !== null) root.rotation.y = finalYaw; yawVelocity = 0; consumeSequence(); } };
    log('clip', { clip: name, layered: true });
    log('travel', { from: start.toArray(), to: target.toArray(), waypoints, seconds: walkTime, speed });
  }; }
  function travelPathSample(m, distance) {
    let remaining = Math.max(0, Math.min(distance, m.distance)), i = 0;
    while (i < m.lengths.length - 1 && remaining > m.lengths[i]) remaining -= m.lengths[i++];
    const a = m.points[i], b = m.points[i + 1] ?? m.target;
    const ratio = m.lengths[i] > 1e-8 ? remaining / m.lengths[i] : 1;
    return { position: a.clone().lerp(b, ratio), heading: Math.atan2(b.x - a.x, b.z - a.z) };
  }
  // One step of a scripted trip: along the path at the eased speed, turning toward the way it is
  // going (damped, so corners and the first turn have no kink), then settling on the final facing.
  function advanceTravel(m, step, previous) {
    m.clock += step;
    const pathSample = travelPathSample(m, walkingSample(m, m.clock).distance);
    root.position.copy(pathSample.position);
    const turned = damp(m.yaw, m.yaw + wrapAngle(pathSample.heading - m.yaw), yawVelocity, .13, step, TURN_SPEED);
    m.yaw = turned.value; yawVelocity = turned.velocity;
    root.rotation.y = m.finalYaw === null ? m.yaw
      : lerpAngle(m.yaw, m.finalYaw, cameraEase(THREE.MathUtils.clamp((m.clock - m.length + m.turnOut) / m.turnOut, 0, 1)));
    const vx = (root.position.x - previous.x) / step, vz = (root.position.z - previous.z) / step;
    const c = Math.cos(root.rotation.y), s = Math.sin(root.rotation.y);
    locomotion = { speed: Math.hypot(vx, vz), localX: vx * c - vz * s, localZ: vx * s + vz * c };
  }
  // The body eases toward a facing: its turning speed is continuous and capped.
  let yawVelocity = 0, facing = 0;
  function turnToward(target, smoothTime, step) {
    const turned = damp(root.rotation.y, root.rotation.y + wrapAngle(target - root.rotation.y), yawVelocity, smoothTime, step, TURN_SPEED);
    root.rotation.y = turned.value; yawVelocity = turned.velocity;
  }
  function walkingSample(m, clock) {
    const t = Math.min(clock, m.length), r = m.ramp;
    if (t < r) { const u = t / r; return { distance: m.speed * r * (u ** 3 - .5 * u ** 4), factor: ease(u) }; }
    if (t <= m.length - r) return { distance: m.speed * (t - .5 * r), factor: 1 };
    const u = (t - (m.length - r)) / r;
    return { distance: m.distance - .5 * m.speed * r + m.speed * r * (u - u ** 3 + .5 * u ** 4), factor: 1 - ease(u) };
  }
  const destinationMarker = new THREE.Mesh(new THREE.RingGeometry(.12, .16, 32),
    new THREE.MeshBasicMaterial({ color: 0xd7410d, transparent: true, opacity: .65, depthWrite: false }));
  destinationMarker.rotation.x = -Math.PI / 2; destinationMarker.position.y = .018;
  destinationMarker.visible = false; scene.add(destinationMarker);
  const cameraYaw = () => Math.atan2(camera.position.x - look.x, camera.position.z - look.z);
  const hoopYaw = point => Math.atan2(HOOP.x - point.x, HOOP.z - point.z);
  function syncMovementInput() {
    navigation.keys.clear();
    for (const code of keyboardMovement) navigation.keys.add(code);
    for (const code of pointerMovement.values()) navigation.keys.add(code);
    for (const button of directionPad.querySelectorAll('[data-move]')) button.setAttribute('aria-pressed', String(navigation.keys.has(button.dataset.move)));
  }
  function clearMovementInput() {
    keyboardMovement.clear(); pointerMovement.clear(); navigation.clear(); destinationMarker.visible = false;
    floorGesture = null;
    syncMovementInput();
  }
  function updatePlayerMovement(step) {
    if (!canSteer()) { locomotion = { speed: 0, localX: 0, localZ: 0 }; facing = root.rotation.y; if (!move) yawVelocity = 0; return; }
    syncMovementInput();
    const result = navigation.step(root.position, cameraYaw(), step);
    root.position.x = result.position.x; root.position.z = result.position.z;
    if (result.moving) {
      if (!playerWalking) { playerWalking = true; log('player_walk'); }
      // Face the way he is really going, once he is going: the last crawl of a stop or the
      // instant of a reversal has no direction worth turning to.
      if (result.speed > .2) facing = result.heading;
    } else if (playerWalking) {
      playerWalking = false; log('player_stop', { position: root.position.toArray() });
    }
    // The position answers the keys at once; the body follows the travel direction with a damped,
    // capped turn (it used to jump 20 degrees in the first frame of a reversal), stepping
    // sideways or back meanwhile, and finishes the turn after a stop instead of freezing mid-way.
    if (activeName === 'Jump_Shot') turnToward(hoopYaw(root.position), .08, step);
    else turnToward(facing, .1, step);
    const v = navigation.velocity, c = Math.cos(root.rotation.y), s = Math.sin(root.rotation.y);
    locomotion = { speed: result.speed, localX: v.x * c - v.z * s, localZ: v.x * s + v.z * c };
    destinationMarker.visible = !!navigation.target;
    if (navigation.target) destinationMarker.position.set(navigation.target.x, .018, navigation.target.z);
  }
  function canSteer() {
    return courtLayered && ['ready', 'action', 'retrieving'].includes(state) && !move && !retrieving && !userPaused && !drag;
  }
  function enterCourtMotion() {
    clipRate = 1;
    if (!courtLayered) { holdPose(); courtMotion.enter(); courtLayered = true; }
    courtMotion.update({ dt: 0, ...locomotion, actionName: null, actionTime: 0 });
    mixer.update(0); bridgePose(); root.updateMatrixWorld(true);
  }
  function working() {
    clearMovementInput(); playerWalking = false; shotTurn = null;
    root.position.copy(DESK); root.rotation.y = 0;
    holdingHand = 'right';
    setState('working'); activeName = null; play('Sit_Typing', null, true); ballState = 'parked';
    physics.setHeld(parked); refreshButtons();
    queue = null;
  }
  function ready() {
    retrieving = false;
    root.rotation.y = hoopYaw(root.position); facing = root.rotation.y; yawVelocity = 0; setState('ready'); activeName = null;
    lastInput = time;
    if (breakStartedAt !== null) { arrivalSeconds = time - breakStartedAt; breakStartedAt = null; log('court_arrival', { seconds: arrivalSeconds }); }
    ballState = 'held'; enterCourtMotion(); clip = 'Idle_Ball'; elapsed = 0; activeDone = null; finishAt = Infinity;
    physics.setHeld(hand()); refreshButtons();
    if (queue) { const next = queue; queue = null; perform(next); }
  }
  function beginBreak() {
    if (state !== 'working' || userPaused) return;
    breakStartedAt = time; lastInput = time; hero.focus({ preventScroll: true });
    setState('departing');
    runSequence([
      stepClip('Stand_Up', null, 1.4),
      stepClip('Pick_Up_Ball', () => { ballState = 'held'; physics.setHeld(hand()); }, 1.5),
      walkTo(COURT, true, COURT_YAW, QUICK_TRAVEL), ready,
    ]);
    refreshButtons();
  }
  function refreshButtons() {
    const onCourt = state === 'ready' || state === 'action' || state === 'retrieving';
    breakButton.hidden = state !== 'working'; breakButton.disabled = userPaused;
    courtMoves.hidden = !onCourt; returnButton.disabled = userPaused || state !== 'ready';
    controlHint.hidden = !onCourt;
    directionPad.hidden = !onCourt;
    for (const button of directionPad.querySelectorAll('[data-move]')) button.disabled = !canSteer();
    for (const button of controls.querySelectorAll('[data-action]')) {
      button.setAttribute('aria-pressed', String(button.dataset.action === activeName));
      button.classList.toggle('queued', button.dataset.action === queue);
      button.disabled = userPaused || !onCourt;
    }
    charHit.setAttribute('aria-label', 'Take a play break');
    charHit.hidden = state !== 'working' || userPaused;
  }
  function request(name) {
    if (userPaused || !['ready', 'action', 'retrieving'].includes(state)) return;
    lastInput = time;
    if (state === 'ready') perform(name);
    else { queue = name; limits.pendingMax = 1; announce(`Queued ${name === 'Ball_Spin' ? 'Spin' : name === 'Jump_Shot' ? 'Shoot' : 'Dribble'}`); }
    refreshButtons(); log('input', { name, queued: queue });
  }
  function finishAction() {
    if (activeName === 'Jump_Shot' || ballState === 'free') { waitForBall(); return; }
    if (queue) { const next = queue; queue = null; perform(next); }
    else { activeName = null; ballState = 'held'; clip = 'Idle_Ball'; elapsed = 0; finishAt = Infinity; setState('ready'); refreshButtons(); }
  }
  function perform(name) {
    // Core actions share the right-hand ready pose. A failed crossover is
    // retrieved physically rather than switching ownership across the body.
    if (holdingHand !== 'right') { dropIncompleteDribble(); waitForBall(); return; }
    actionAnchor.copy(root.position); receiveBlend = null;
    setState('action'); activeName = name; refreshButtons();
    if (name === 'Jump_Shot') { restartLock = true; physics.resetShot(); }
    startActionClip(name);
  }
  function startActionClip(name) {
    enterCourtMotion(); clip = name; elapsed = 0; released = false; caught = false;
    if (name === 'Dribble') dribbleProgress = dribbleBeats.map(() => ({ released: false, caught: false, missed: false, minSeparation: Infinity }));
    // The move takes over at full weight; the bridge carries the pose into it (done well before
    // the first contact event, which is never earlier than .25 s).
    // (the shot starts further from the hold than the others do, so it gets a little longer)
    holdPose(name === 'Jump_Shot' ? .28 : .2);
    courtMotion.setAction(name);
    activeDone = () => {
      if (name === 'Jump_Shot') { waitForBall(); }
      else if (name === 'Dribble' && !dribbleProgress?.every(beat => beat.caught)) { dropIncompleteDribble(); waitForBall(); }
      else finishAction();
    };
    finishAt = duration(name); log('clip', { clip: name, layered: true });
  }
  function dropIncompleteDribble() {
    if (ballState === 'held' && physics.release(hand(), V(0, -1, 0), { x: 0, y: 0, z: 0 }, { kind: 'dribble' })) {
      ballState = 'free'; log('dribble_recovery_drop', { hand: holdingHand });
    }
    physics.endDribbleControl();
  }
  function waitForBall() {
    if (ballState === 'free') physics.endDribbleControl();
    activeName = null; setState('retrieving');
    // Remain in the landed ready pose until the single real ball can be reached.
    clip = 'Idle_Ball'; elapsed = 0; finishAt = Infinity; activeDone = null; refreshButtons();
  }
  function retrieve() {
    actionAnchor.copy(root.position); clearMovementInput(); playerWalking = false;
    retrieveTarget = physics.position.clone();
    // Authored pickup reaches forward/right from the root. Solve its root placement from metadata.
    const local = V(...(meta.pickupBallLocal ?? [-.32, .12, .47]));
    const approach = findPickupApproach(retrieveTarget, root.position, local);
    if (!approach) { log('blocked_pickup', { ball: retrieveTarget.toArray() }); recoverCovered('obstructed-pickup'); return; }
    const yaw = approach.yaw, destination = V(approach.position.x, 0, approach.position.z);
    const continueAfterPickup = () => {
      restartLock = false; holdingHand = 'right'; ballState = 'held'; physics.setHeld(hand());
      runSequence([walkTo(actionAnchor, true, hoopYaw(actionAnchor), QUICK_TRAVEL), ready]);
    };
    runSequence([walkTo(destination, false, yaw, { ...QUICK_TRAVEL, waypoints: approach.waypoints }), stepClip('Retrieve_Ball', continueAfterPickup, 1.5)]);
    refreshButtons();
  }
  function returnToWork() {
    if (restartLock || ballState === 'free') return;
    clearMovementInput(); playerWalking = false;
    setState('returning'); activeName = null;
    hero.focus({ preventScroll: true });
    runSequence([
      walkTo(DESK, true, 0),
      stepClip('Put_Down_Ball', () => {
        parked.copy(hand()); parked.y = .12; ballState = 'parked'; physics.setHeld(parked);
      }), stepClip('Sit_Down'), working,
    ]);
  }
  function cross(t, before) { return before < t && elapsed >= t; }
  function clipEvents(before) {
    if ((clip === 'Pick_Up_Ball' || clip === 'Retrieve_Ball') && cross(eventTime(clip, 'grip', duration(clip) * .62), before)) {
      holdingHand = 'right'; ballState = 'held'; physics.setHeld(hand()); log('grip', { clip, clipTime: elapsed, rate: clipRate });
    }
    if (clip === 'Put_Down_Ball' && cross(eventTime(clip, 'release', duration(clip) * .65), before)) {
      parked.copy(hand()); parked.y = .12; ballState = 'parked'; physics.setHeld(parked);
    }
    if (clip === 'Jump_Shot' && !released && cross(eventTime(clip, 'release', duration(clip) * .45), before)) {
      const p = hand(); const velocity = physics.getLaunchVelocity(p, aim);
      // The moving shooter's momentum is inherited once. After this event,
      // the shot is exclusively a Rapier projectile, regardless of steering.
      velocity.x += navigation.velocity.x; velocity.z += navigation.velocity.z;
      if (physics.release(p, velocity, { x: -4, y: .2, z: 0 }, { kind: 'shot' })) {
        shots++; released = true; ballState = 'free';
        limits.releaseFrames.push({ clipTime: elapsed, expected: eventTime(clip, 'release', duration(clip) * .45), position: p.toArray(), aim: { ...aim } });
        log('shot_release', { position: p.toArray(), velocity: velocity.toArray() }); announce(`${makes}/${shots}`);
      }
    }
    if (clip === 'Dribble') {
      for (let index = 0; index < dribbleBeats.length; index++) {
        const beat = dribbleBeats[index], progress = dribbleProgress[index];
        if (progress.released || progress.missed || !cross(beat.release, before)) continue;
        if (ballState !== 'held' || holdingHand !== beat.hand || (index > 0 && !dribbleProgress[index - 1].caught)) {
          progress.missed = true; log('dribble_release_missed', { beat: index + 1, hand: holdingHand }); continue;
        }
        const p = hand(false, beat.hand);
        const target = courtMotion.predictSocket(beat.receiveHand, 'Dribble', beat.catch, beat.catch - beat.release)
          .applyAxisAngle(V(0, 1, 0), root.rotation.y).add(root.position);
        const flight = beat.catch - beat.release;
        const velocity = target.clone().sub(p).divideScalar(flight);
        velocity.y = -solveDribbleDownSpeed(p.y, target.y, flight);
        const radius = meta.dribble?.radius ?? .12;
        // Match the ball's tangential floor velocity so friction does not
        // arbitrarily erase a crossover's sideways travel at impact.
        const angular = V(velocity.z / radius, 0, -velocity.x / radius);
        if (physics.release(p, velocity, angular, { kind: 'dribble' })) {
          progress.released = true; progress.releaseTime = elapsed;
          released = true; caught = false; ballState = 'free';
          log('dribble_release', { beat: index + 1, hand: beat.hand, receiveHand: beat.receiveHand, clipTime: elapsed,
            position: p.toArray(), velocity: velocity.toArray() });
        } else { progress.missed = true; log('dribble_release_missed', { beat: index + 1, hand: holdingHand }); }
      }
    }
  }
  function catchDribble() {
    if (clip !== 'Dribble' || ballState !== 'free' || !dribbleProgress) return;
    const index = dribbleProgress.findIndex(beat => beat.released && !beat.caught);
    if (index < 0) return;
    const beat = dribbleBeats[index], progress = dribbleProgress[index];
    const early = beat.catchEarly ?? meta.dribble?.catchEarly ?? .10;
    const late = beat.catchLate ?? meta.dribble?.catchLate ?? .10;
    if (elapsed > beat.catch + late) {
      progress.missed = true;
      log('dribble_catch_missed', { beat: index + 1, clipTime: elapsed });
      dropIncompleteDribble(); waitForBall(); return;
    }
    const baseHand = hand(false, beat.receiveHand);
    if (elapsed >= beat.catch - .10 && elapsed <= beat.catch + .10 && physics.velocity.y > 0) {
      const amount = ease(THREE.MathUtils.clamp((elapsed - beat.catch + .10) / .07, 0, 1));
      reachReceivingHand(beat.receiveHand, physics.position, amount, .12);
    }
    const p = hand(false, beat.receiveHand), separation = p.distanceTo(physics.position);
    progress.minSeparation = Math.min(progress.minSeparation, separation);
    if (elapsed < beat.catch - early || elapsed > beat.catch + late) return;
    // Keep the rebound's seam orientation at contact, then carry it with the wrist.
    quat.copy(physics.quaternion);
    const arriving = physics.position.clone(), arrivingVelocity = physics.velocity.clone();
    if (physics.catchBall(p, quat, beat.catchTolerance ?? meta.dribble?.catchTolerance ?? .055)) {
      // (kept in his own moving frame, as the dribble's flight is, so it holds while he runs or turns)
      root.worldToLocal(settle.from.copy(arriving)); settle.velocity.copy(arrivingVelocity).applyAxisAngle(V(0, 1, 0), -root.rotation.y); settle.age = 0;
      physics.setHeld(arriving, quat); // it stays on its arc this step; the hand takes it over from here
      progress.caught = true; progress.catchTime = elapsed; progress.catchSeparation = separation;
      // Fade the small receiving correction out after contact. The single
      // held ball follows that hand throughout; there is no catch teleport.
      receiveBlend = { side: beat.receiveHand, until: elapsed + .14,
        offset: p.clone().sub(baseHand).applyAxisAngle(V(0, 1, 0), -root.rotation.y) };
      holdingHand = beat.receiveHand; ballState = 'held'; caught = dribbleProgress.every(item => item.caught);
      log('dribble_catch', { beat: index + 1, hand: holdingHand, clipTime: elapsed, separation });
    }
  }
  physics.onMake = () => { makes++; netPulseAt = time; log('make'); announce(`${makes}/${shots}`); };
  function project(position, element, size = null) {
    screen.copy(position).project(camera);
    const width = stage.clientWidth, height = stage.clientHeight;
    element.style.left = `${(screen.x + 1) * width / 2}px`;
    element.style.top = `${(1 - screen.y) * height / 2}px`;
    if (size) { element.style.width = `${size.x}px`; element.style.height = `${size.y}px`; }
  }
  const lampAnchor = V(-2.58, 1.06, .98);
  const laptopScreen = studio.getObjectByName('LaptopScreen');
  const uiPaths = ['screen-liminal.ktx2', 'screen-content-plus.ktx2', 'screen-vibe.ktx2', 'screen-finra.ktx2'];
  let screenIndex = 0;
  async function showProject(index) {
    if (!laptopScreen) return;
    try {
      const texture = await ktx.loadAsync(new URL(uiPaths[index % uiPaths.length], A).href);
      texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = false;
      const previousMaterial = laptopScreen.material, previousTexture = previousMaterial.map;
      laptopScreen.material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide });
      previousTexture?.dispose();
      previousMaterial.dispose();
      log('screen', { index: index % uiPaths.length });
      renderer.render(scene, camera);
    } catch (e) { console.error('Project screen', e); }
  }
  setTheme((themeRoot.dataset.theme ?? 'dark') === 'dark');
  await showProject(0);
  laptopHit.addEventListener('click', () => { showProject(++screenIndex); nextScreenAt = time + 7; });
  function setTheme(dark) {
    themeRoot.dataset.theme = dark ? 'dark' : 'light';
    celestialSky.setTheme(dark);
    wallSky.amount.value = dark ? 1 : .08;
    for (const item of celestialWalls) {
      if (dark) { item.material.color.set(0x344965); item.material.emissive.set(0x101A2D); item.material.emissiveIntensity = .25; }
      else { item.material.color.copy(item.color); item.material.emissive.copy(item.emissive); item.material.emissiveIntensity = item.intensity; }
    }
    for (const item of celestialFloors) {
      if (dark) item.material.color.set(item.room ? 0x8B91A1 : 0x425368);
      else item.material.color.copy(item.color);
    }
    lampHit.setAttribute('aria-checked', String(dark));
    lampHit.setAttribute('aria-label', embedded ? (dark ? 'Switch the studio to daylight' : 'Switch the studio to night')
      : dark ? 'Switch whole page to light mode' : 'Switch whole page to dark mode');
    fill.intensity = dark ? .48 : 1.05; key.intensity = dark ? 95 : 700;
    fill.color.set(dark ? 0xc4d4eb : 0xfff8ec);
    key.color.set(dark ? 0xaec4df : 0xffecd4); scene.environmentIntensity = dark ? .23 : .48;
    lampLight.intensity = dark ? 3.5 : 0;
    const windowMaterial = studio.getObjectByName('ArchWindow_DaylightOpening')?.material;
    if (windowMaterial) {
      windowMaterial.color.setRGB(...(dark ? [.035, .055, .085] : [.710, .775, .755]));
      windowMaterial.emissiveIntensity = dark ? .035 : .34;
      // Keep the authored arch and every solid; let the page sky be visible through its opening.
      windowMaterial.transparent = true; windowMaterial.opacity = dark ? .02 : .08; windowMaterial.depthWrite = false;
    }
    studio.traverse(o => { if (o.isMesh && /lamp.*(bulb|light|shade)/i.test(o.name) && o.material.emissive) {
      o.material.emissive.set(0xffd49b); o.material.emissiveIntensity = dark ? 2 : 0;
    } });
    log('theme', { dark });
    renderer.render(scene, camera);
  }
  function toggleTheme() { setTheme(themeRoot.dataset.theme !== 'dark'); }
  lampHit.addEventListener('click', toggleTheme);
  charHit.addEventListener('click', beginBreak);
  breakButton.addEventListener('click', beginBreak);
  returnButton.addEventListener('click', () => { if (state === 'ready' && !userPaused) returnToWork(); });
  controls.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => request(button.dataset.action)));
  function togglePause() {
    clearMovementInput();
    userPaused = !userPaused; pauseButton.setAttribute('aria-pressed', String(userPaused));
    pauseButton.setAttribute('aria-label', userPaused ? 'Resume scene' : 'Pause scene');
    if (userPaused) { physics.pause(); announce('Paused'); } else { physics.resume(); announce(); }
    lastFrame = performance.now(); refreshButtons();
  }
  pauseButton.addEventListener('click', togglePause);
  hero.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    const key = event.key.toLowerCase();
    if (key === 'escape') {
      // As a room of another page, Escape belongs to that page (it leaves the room).
      clearMovementInput();
      if (drag) endDrag(null, false);
      else if (!embedded && !userPaused) togglePause();
      if (!embedded) event.preventDefault();
      return;
    }
    if (!['ready', 'action', 'retrieving'].includes(state)) return;
    if (movementCodes.has(event.code) && !(event.shiftKey && event.code.startsWith('Arrow'))) {
      event.preventDefault();
      if (canSteer()) { keyboardMovement.add(event.code); syncMovementInput(); }
      return;
    }
    if (event.repeat) return;
    // Native buttons retain Space/Enter activation; custom Space belongs only to the focused scene.
    if (key === ' ' && event.target.tagName === 'BUTTON') return;
    if (key === 'e') { event.preventDefault(); request('Dribble'); }
    if (key === 'q') { event.preventDefault(); request('Ball_Spin'); }
    if (key === ' ') { event.preventDefault(); request('Jump_Shot'); }
    if (event.shiftKey && ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
      clearMovementInput();
      playerWalking = false;
      event.preventDefault(); aim.yaw = THREE.MathUtils.clamp(aim.yaw + (key === 'arrowleft' ? -.025 : key === 'arrowright' ? .025 : 0), -.55, .55);
      aim.power = THREE.MathUtils.clamp(aim.power + (key === 'arrowup' ? .025 : key === 'arrowdown' ? -.025 : 0), 0, 1); announce('Aim adjusted');
    }
  });
  window.addEventListener('keyup', event => { keyboardMovement.delete(event.code); syncMovementInput(); });
  window.addEventListener('blur', clearMovementInput);
  hero.addEventListener('focusout', event => { if (!hero.contains(event.relatedTarget)) clearMovementInput(); });
  for (const button of directionPad.querySelectorAll('[data-move]')) {
    button.addEventListener('pointerdown', event => {
      if (!canSteer() || event.button !== 0) return;
      event.preventDefault(); button.setPointerCapture(event.pointerId); pointerMovement.set(event.pointerId, button.dataset.move);
      syncMovementInput(); hero.focus({ preventScroll: true });
    });
    const release = event => { pointerMovement.delete(event.pointerId); syncMovementInput(); };
    button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
    button.addEventListener('click', event => {
      if (event.detail !== 0 || !canSteer()) return;
      const code = button.dataset.move;
      const vector = screenDirection(code === 'ArrowRight' ? 1 : code === 'ArrowLeft' ? -1 : 0,
        code === 'ArrowDown' ? 1 : code === 'ArrowUp' ? -1 : 0, cameraYaw());
      navigation.setTarget({ x: root.position.x + vector.x * .5, z: root.position.z + vector.z * .5 });
      log('player_step', { direction: code });
    });
  }
  const floorRay = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let floorGesture = null;
  renderer.domElement.addEventListener('pointerdown', event => {
    if (canSteer() && event.button === 0) floorGesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  renderer.domElement.addEventListener('pointercancel', () => { floorGesture = null; });
  renderer.domElement.addEventListener('pointerup', event => {
    const gesture = floorGesture; floorGesture = null;
    if (!gesture || gesture.id !== event.pointerId || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8 || !canSteer()) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    camera.updateMatrixWorld(true); floorRay.setFromCamera(pointer, camera);
    const hit = floorRay.intersectObject(studio, true)[0];
    if (!hit || !(hit.object.name === 'CourtFloor' || hit.object.material?.name === 'Court marking chalk')) return;
    const point = hit.point;
    if (Math.abs(point.x) > 5 || point.z < -4 || point.z > 3.5) return;
    navigation.setTarget(point); hero.focus({ preventScroll: true }); log('player_target', { target: navigation.target });
  });
  // Only dragging the ball captures touch; the rest of the canvas leaves page scrolling alone.
  let drag = null;
  ballHit.addEventListener('pointerdown', event => {
    if (state !== 'ready' || userPaused || ballState !== 'held') return;
    clearMovementInput();
    playerWalking = false;
    const rect = renderer.domElement.getBoundingClientRect();
    event.preventDefault(); ballHit.setPointerCapture(event.pointerId);
    hero.focus({ preventScroll: true });
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, rect };
    lastInput = time; aimIndicator.hidden = false;
    aimIndicator.style.left = `${event.clientX - rect.left}px`; aimIndicator.style.top = `${event.clientY - rect.top}px`;
  });
  ballHit.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    aim.yaw = THREE.MathUtils.clamp(dx / 230, -.55, .55);
    aim.power = THREE.MathUtils.clamp(.5 - dy / 270, 0, 1);
    aimIndicator.style.height = `${Math.hypot(dx, dy)}px`; aimIndicator.style.transform = `rotate(${Math.atan2(-dx, dy)}rad)`;
  });
  function endDrag(event, shoot = true) {
    if (!drag || event && event.pointerId !== drag.id) return;
    const id = drag.id; drag = null; aimIndicator.hidden = true;
    if (ballHit.hasPointerCapture(id)) ballHit.releasePointerCapture(id);
    if (shoot) request('Jump_Shot');
  }
  ballHit.addEventListener('pointerup', event => endDrag(event));
  ballHit.addEventListener('pointercancel', event => endDrag(event, false));
  ballHit.addEventListener('lostpointercapture', event => endDrag(event, false));
  ballHit.addEventListener('click', event => { if (event.detail === 0) request('Jump_Shot'); });
  function resize() {
    const width = stage.clientWidth, height = stage.clientHeight;
    if (!width || !height) return; // not laid out (its room is put away)
    const phone = width < 600;
    renderer.setPixelRatio(Math.max(1, Math.min(devicePixelRatio, phone ? 1.25 : 1.5) * quality));
    renderer.setSize(width, height, false); camera.aspect = width / height;
    frameView(cameraView, roomProgress);
    renderer.render(scene, camera);
  }
  new ResizeObserver(resize).observe(stage); resize();
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; lastFrame = performance.now(); if (!visible) { clearMovementInput(); endDrag(null, false); } }, { threshold: .05 }).observe(stage);
  document.addEventListener('visibilitychange', () => { lastFrame = performance.now(); if (document.hidden) { clearMovementInput(); endDrag(null, false); } });
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); clearMovementInput(); contextLost = true; stage.classList.remove('ready'); announce('Graphics paused'); });
  renderer.domElement.addEventListener('webglcontextrestored', () => { contextLost = false; lastFrame = performance.now(); stage.classList.add('ready'); });
  let observedMotionPreference = reduced.matches;
  function applyReducedMotion() {
    clearMovementInput();
    userPaused = true; physics.pause(); pauseButton.setAttribute('aria-pressed', 'true'); pauseButton.setAttribute('aria-label', 'Resume scene');
    stage.classList.remove('ready'); playButton.hidden = false; controls.hidden = true;
    charHit.hidden = true; lampHit.hidden = true; ballHit.hidden = true; laptopHit.hidden = true; refreshButtons(); announce('Motion is off · Play to explore');
    log('reduced_motion');
  }
  reduced.addEventListener('change', event => { observedMotionPreference = event.matches; if (event.matches) applyReducedMotion(); });
  working();
  // Use the authored pickup offset when available, retaining a single parked ball from arrival.
  if (meta.pickupBallLocal) { parked.copy(DESK).add(V(...meta.pickupBallLocal)); parked.y = .12; physics.setHeld(parked); }
  mixer.update(0); root.updateMatrixWorld(true);
  charHit.hidden = false; lampHit.hidden = false; controls.hidden = false;
  playButton.hidden = true;
  frameView('working'); renderer.render(scene, camera); stage.classList.add('ready'); announce();
  let nextScreenAt = 6;
  let faultRecovery = false;
  async function recoverCovered(reason = physics.recoveryReason) {
    if (faultRecovery) return;
    faultRecovery = true; userPaused = true; physics.pause(); endDrag(null, false);
    if (poster) poster.style.transition = 'none';
    stage.classList.remove('ready');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    log('covered_recovery', { reason });
    physics.resetCovered(parked); queue = null; sequence = []; move = null; restartLock = false;
    retrieving = false; breakStartedAt = null;
    mixer.stopAllAction(); current = null; working(); cameraProgress = cameraVelocity = 0; frameView('working');
    userPaused = false; physics.resume(); lastFrame = performance.now(); refreshButtons();
    renderer.render(scene, camera); stage.classList.add('ready'); if (poster) poster.style.transition = ''; faultRecovery = false;
  }
  function advance(step) {
    const previousRoot = root.position.clone(), previousYaw = root.rotation.y;
    updatePlayerMovement(step);
    // Asked to dribble again while still dribbling: at the top of the last bounce the clip steps
    // back to the top of the first (the same pose), so the rhythm carries on unbroken.
    if (clip === 'Dribble' && state === 'action' && queue === 'Dribble' && elapsed >= handles.dribble.last && elapsed < handles.dribble.last + .05) {
      elapsed += handles.dribble.lead - handles.dribble.last; queue = null;
      dribbleProgress = dribbleBeats.map(() => ({ released: false, caught: false, missed: false, minSeparation: Infinity }));
      refreshButtons(); log('dribble_continue');
    }
    const before = elapsed, initialClip = clip;
    time += step; elapsed += step * clipRate; stateTime += step;
    const trip = move;
    if (trip) advanceTravel(trip, step, previousRoot);
    if (courtLayered) courtMotion.update({ dt: step, ...locomotion,
      // Arms hold the ball while it is in hand or in play; they swing free when it is away.
      carry: trip ? trip.carrying : ballState === 'held' || state === 'action', snapIn: true,
      actionName: state === 'action' ? activeName : null, actionTime: elapsed });
    mixer.update(step); bridgePose(step);
    if (trip && trip.clock >= trip.length) trip.done();
    root.updateMatrixWorld(true);
    physics.setCharacterPose(root.position);
    if (state === 'action' && clip === 'Dribble' && ballState === 'free') {
      physics.transportDribbleFrame(previousRoot, root.position, root.rotation.y - previousYaw);
    }
    if (receiveBlend && ballState === 'held') {
      const amount = THREE.MathUtils.clamp((receiveBlend.until - elapsed) / .14, 0, 1);
      if (amount > 0) reachReceivingHand(receiveBlend.side,
        hand(false, receiveBlend.side).add(receiveBlend.offset.clone().applyAxisAngle(V(0, 1, 0), root.rotation.y)), amount, .12);
      else receiveBlend = null;
    }
    if (ballState === 'held') {
      const gripPosition = hand();
      if (settle.age < settle.length) {
        settle.age += step;
        const arc = temp.copy(settle.from).addScaledVector(settle.velocity, settle.age); arc.y -= 4.905 * settle.age * settle.age;
        gripPosition.lerp(root.localToWorld(arc), 1 - ease(Math.min(1, settle.age / settle.length)));
      }
      let amount = 0;
      if (clip === 'Ball_Spin') {
        const start = eventTime(clip, 'spin_start', .65), end = eventTime(clip, 'spin_end', 2.05), caughtAt = eventTime(clip, 'catch', 2.6);
        amount = elapsed < end ? ease(THREE.MathUtils.clamp((elapsed - start) / .16, 0, 1)) : 1 - ease(THREE.MathUtils.clamp((elapsed - end) / (caughtAt - end), 0, 1));
      }
      // (The spin clip itself carries the ball from the palm onto the fingertip: its grip socket
      // ends a radius above the index tip. Nothing slides the ball between two sockets here.)
      socketForHand(holdingHand).getWorldQuaternion(quat);
      if (!heldRotationReady) {
        heldRotation.copy(physics.quaternion);
        heldSocketRotation.copy(quat);
        heldRotationReady = true;
      }
      // Incremental wrist motion avoids tumbling the ball as the fingertip
      // takes over. At full support only the live finger axis turns the ball.
      wristDelta.copy(heldSocketRotation).invert().premultiply(quat);
      wristDelta.slerp(identityRotation, amount);
      heldRotation.premultiply(wristDelta);
      heldSocketRotation.copy(quat);
      if (amount > 0 && indexSupport) {
        spinAxis.copy(hand(true)).sub(indexSupport.getWorldPosition(spinAnchor));
        if (spinAxis.lengthSq() > 1e-8) spinAxis.normalize();
        else spinAxis.set(0, 1, 0);
      }
      const spinStart = eventTime('Ball_Spin', 'spin_start', .5);
      const angularSpeed = Math.max(12, 17 - Math.max(0, elapsed - spinStart) * 2.4);
      spinAngle = (spinAngle + angularSpeed * amount * step) % (Math.PI * 2);
      spinDelta.setFromAxisAngle(spinAxis, angularSpeed * amount * step);
      heldRotation.premultiply(spinDelta).normalize();
      physics.setHeld(gripPosition, heldRotation);
    } else heldRotationReady = false;
    // Integrate the preceding time slice before detaching at its exact final event time.
    physics.step(step);
    const netAge = time - netPulseAt;
    const netPull = netAge < .65 ? Math.sin(netAge / .65 * Math.PI) * Math.exp(-netAge * 2) : 0;
    netResponse.scale.set(1 + .045 * netPull, 1 + .15 * netPull, 1 + .045 * netPull);
    if (clip === initialClip) clipEvents(before);
    catchDribble();
    ball.position.copy(physics.position); ball.quaternion.copy(physics.quaternion);
    footContact.position.set(root.position.x, .0005, root.position.z);
    const jumping = clip === 'Jump_Shot' && elapsed > .46 && elapsed < .86;
    footContact.material.opacity = jumping ? .12 : .2;
    ballContact.position.set(physics.position.x, .0008, physics.position.z);
    ballContact.material.opacity = .44 / (1 + Math.max(0, physics.position.y - .12) * 5);
    if (activeDone && elapsed >= finishAt - 1e-7) { const fn = activeDone; activeDone = null; fn(); }
    if (recording) recordStep(step);
  }
  // The loop stops altogether while the scene is put away (setActive), and starts once on return.
  let active = true, looping = false;
  function animate(now) {
    if (!active) { looping = false; return; }
    requestAnimationFrame(animate);
    const raw = Math.max(0, (now - lastFrame) / 1000); lastFrame = now;
    if (reviewMode) {
      status.dataset.visibility = JSON.stringify({ hidden: document.hidden, visible, userPaused, drawFrames, time });
      status.dataset.navigation = JSON.stringify({ root: root.position.toArray(), facing: root.rotation.y, playerWalking,
        state, clip, elapsed, clipRate, ballState, activeName, motion: courtMotion.snapshot(),
        navigation: navigation.snapshot(), shotTurning: !!shotTurn, actionAnchor: actionAnchor.toArray(),
        roomProgress, camera: camera.position.toArray() });
    }
    if (reduced.matches !== observedMotionPreference) { observedMotionPreference = reduced.matches; if (observedMotionPreference) applyReducedMotion(); }
    if (document.hidden || !visible || userPaused || contextLost) return;
    // Keep the game clock moving on a slow presented frame. Physics and event
    // crossings still use 120 Hz slices; hidden/offscreen frames return above.
    if (reviewHold) return;
    simulate(Math.min(raw, .25) * reviewRate, raw);
  }
  function simulate(dt, raw) {
    if (!dt) return;
    let remaining = dt;
    while (remaining > 1e-7) {
      const futureEvents = Object.values(clipMeta(clip).events ?? {}).filter(t => typeof t === 'number' && t > elapsed + 1e-7);
      if (clip === 'Dribble') {
        for (const beat of dribbleBeats) {
          if (beat.release > elapsed + 1e-7) futureEvents.push(beat.release);
          if (beat.catch > elapsed + 1e-7) futureEvents.push(beat.catch);
        }
      }
      if (activeDone && finishAt > elapsed + 1e-7) futureEvents.push(finishAt);
      const boundary = futureEvents.length ? (Math.min(...futureEvents) - elapsed) / clipRate : Infinity;
      const step = Math.min(remaining, 1 / 120, boundary);
      advance(step); remaining -= step;
    }
    if (physics.needsRecovery) { recoverCovered(); return; }
    if (state === 'retrieving' && !retrieving && physics.canRecover && physics.velocity.length() < .18) { retrieving = true; retrieve(); }
    if (state !== 'retrieving') retrieving = false;
    if (state === 'working' && time >= nextScreenAt) { showProject(++screenIndex); nextScreenAt = time + 7; }
    const traveling = state === 'departing' || state === 'returning';
    const cameraGoal = state === 'working' ? 0 : traveling ? THREE.MathUtils.clamp((root.position.x - DESK.x) / (COURT.x - DESK.x), 0, 1) : 1;
    // The camera follows the trip with a damped lag instead of being locked to the character's
    // position: its speed has no kinks when he sets off, stops, or turns back from mid-court.
    const follow = damp(cameraProgress, cameraGoal, cameraVelocity, .32, dt);
    cameraProgress = THREE.MathUtils.clamp(follow.value, 0, 1); cameraVelocity = follow.velocity;
    if (Math.abs(cameraProgress - cameraGoal) < 2e-4 && Math.abs(cameraVelocity) < 1e-3) { cameraProgress = cameraGoal; cameraVelocity = 0; }
    const progress = cameraProgress;
    frameView(progress <= 0 ? 'working' : progress >= 1 ? 'court' : 'journey', progress);
    if (reviewCamera) {
      // A review camera that stays with the character, to look at the hands from any side.
      // (offsets are in his own frame: +Z ahead of him, -X to his right)
      const up = V(0, 1, 0), yaw = reviewCamera.yaw ?? root.rotation.y;
      camera.position.copy(reviewCamera.offset).applyAxisAngle(up, yaw).add(root.position); camera.fov = reviewCamera.fov; camera.updateProjectionMatrix();
      camera.lookAt(temp.copy(reviewCamera.look).applyAxisAngle(up, yaw).add(root.position));
    }
    const hitCenter = root.position.clone().add(V(0, state === 'working' ? .85 : 1, 0));
    const pixelHeight = stage.clientHeight * (state === 'working' ? 1.15 : 1.75) / (2 * camera.position.distanceTo(hitCenter) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    project(hitCenter, charHit, { x: Math.max(44, pixelHeight * .65), y: pixelHeight });
    project(lampAnchor, lampHit);
    if (laptopScreen) { project(laptopScreen.getWorldPosition(temp), laptopHit); laptopHit.hidden = state !== 'working'; }
    project(physics.position, ballHit);
    ballHit.hidden = state !== 'ready' || ballState !== 'held' || userPaused;
    // This shares the scene clock and inherits pause/offscreen/reduced-motion suspension.
    wallSky.time.value = reduced.matches ? 12 : time * .55 + 12;
    celestialSky.draw(reduced.matches ? 12 : time * .55 + 12);
    renderer.render(scene, camera); drawFrames++; totalSeconds += raw;
    if (recording) recording.frames.push([+time.toFixed(4), ...camera.position.toArray().map(v => +v.toFixed(4)), ...look.toArray().map(v => +v.toFixed(4)), +camera.fov.toFixed(3)]);
    sampleSeconds += raw; sampleFrames++;
    if (sampleSeconds > 3) {
      const fps = sampleFrames / sampleSeconds;
      const threshold = stage.clientWidth < 600 ? 28 : 50;
      if (fps < threshold && quality > .6) {
        quality = Math.max(.6, quality - .15); qualityChanges++;
        // Keep the window's architectural light at lower quality; reduce its
        // shadow resolution together with the pixel ratio rather than remove it.
        const shadowSize = quality > .75 ? 1024 : 768;
        if (key.shadow.mapSize.x !== shadowSize) {
          key.shadow.mapSize.set(shadowSize, shadowSize);
          key.shadow.map?.dispose(); key.shadow.map = null;
        }
        resize();
      }
      sampleSeconds = 0; sampleFrames = 0;
    }
  }
  lastFrame = performance.now(); looping = true; requestAnimationFrame(animate);
  const api = {
    // Rest (false) or wake (true) the whole scene: no frames, physics or input while resting, and
    // everything where it was left on waking.
    setActive(on) {
      if (on === active) return;
      active = on; clearMovementInput(); endDrag(null, false); lastFrame = performance.now();
      if (on) { resize(); if (!looping) { looping = true; requestAnimationFrame(animate); } }
    },
    get active() { return active; },
    play: () => { clearMovementInput(); userPaused = false; physics.resume(); lastFrame = performance.now();
      playButton.hidden = true; controls.hidden = false; charHit.hidden = false; lampHit.hidden = false;
      stage.classList.add('ready'); pauseButton.setAttribute('aria-pressed', 'false'); pauseButton.setAttribute('aria-label', 'Pause scene'); refreshButtons(); announce(); },
    snapshot: () => ({ state, clip, elapsed, clipRate, queued: queue, activeName, ballState, holdingHand, time, visible, userPaused, reduced: reduced.matches,
      handPositions: { right: hand(false, 'right').toArray(), left: hand(false, 'left').toArray(), spin: hand(true).toArray() },
      dribble: dribbleProgress?.map((progress, index) => ({ ...dribbleBeats[index], ...progress,
        minSeparation: Number.isFinite(progress.minSeparation) ? progress.minSeparation : null })) ?? null,
      spinAngle, spinAxis: spinAxis.toArray(), ballQuaternion: physics.quaternion.toArray(),
      controlVersion: 5, navigation: navigation.snapshot(), motion: courtMotion.snapshot(), shotTurning: !!shotTurn, actionAnchor: actionAnchor.toArray(),
      root: root.position.toArray(), aim: { ...aim }, physics: physics.snapshot(), limits, makes, shots, drawFrames,
      cameraDistance: camera.position.distanceTo(look),
      cameraView, roomProgress, cameraPosition: camera.position.toArray(), arrivalSeconds, motionVersion: meta.motionVersion ?? 1,
      animationWeights: [...actions.entries()].filter(([, action]) => action.enabled && action.isScheduled() && action.getEffectiveWeight() > .0001).map(([name, action]) => ({ name, weight: action.getEffectiveWeight() })),
      meanFps: drawFrames / Math.max(.001, totalSeconds), quality, qualityChanges, renderer: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }, history: history.slice(-70),
      clips: [...actions.keys()], screens: screenIndex, theme: themeRoot.dataset.theme }),
  };
  if (reviewMode) {
    api.record = (on = true) => { const done = recording; recording = on ? { steps: [], frames: [], ball: [] } : null; return done; };
    // hold(): stop the clock; tick(dt): advance exactly dt and draw one frame; rate(): slow motion;
    // camera(offset, look, fov): a camera placed relative to the character (null: the scene's own).
    api.review = {
      hold(on = true) { reviewHold = on; lastFrame = performance.now(); },
      tick(dt = 1 / 60) { simulate(dt, dt); },
      rate(value = 1) { reviewRate = value; },
      camera(offset, lookOffset = [0, 1, 0], fov = 30, lockYaw = false) { reviewCamera = offset ? { offset: V(...offset), look: V(...lookOffset), fov, yaw: lockYaw ? root.rotation.y : null } : null; },
      canvas: renderer.domElement, character, root, THREE, courtMotion, mixer, physics, handles,
    };
  }
  // Read-only diagnostics are intentionally available for the Phase 1 review.
  window.characterPrototype = api;
  return api;
}
