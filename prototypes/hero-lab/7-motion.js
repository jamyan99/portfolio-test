import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

// All times are sampled explicitly. No fade schedules or action clocks compete
// with the interaction's release/catch clock, even when its mixer also ticks.
export function createCourtMotion({ THREE, mixer, clips, character }) {
  const sources = clips instanceof Map ? clips : new Map(clips.map(clip => [clip.name, clip]));
  const prefix = '__CourtMotion_';
  const lowerNames = new Set(), upperNames = new Set();
  const canonical = name => String(name ?? '').replace(/^mixamorig[:_]?/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const find = name => {
    let match;
    character.traverse(node => { if (canonical(node.name) === canonical(name)) match = node; });
    return match;
  };
  const addTree = (node, names) => node?.traverse(child => { names.add(child.name); names.add(child.uuid); });
  const hips = find('Hips');
  if (hips) { lowerNames.add(hips.name); lowerNames.add(hips.uuid); }
  addTree(find('LeftUpLeg'), lowerNames);
  addTree(find('RightUpLeg'), lowerNames);
  addTree(find('Spine'), upperNames);
  if (!hips || !upperNames.size) throw Error('Court motion requires the shared Hips/Spine skeleton');

  function trackNode(track) {
    const parsed = THREE.PropertyBinding.parseTrackName(track.name);
    return parsed.objectName === 'bones' ? parsed.objectIndex : parsed.nodeName;
  }
  function masked(name, sourceName, names) {
    const source = sources.get(sourceName);
    if (!source) throw Error(`Missing court animation: ${sourceName}`);
    const tracks = source.tracks.filter(track => names.has(trackNode(track)));
    if (!tracks.length) throw Error(`No matching court tracks: ${sourceName}`);
    return new THREE.AnimationClip(prefix + name, source.duration, tracks);
  }

  const lowerClips = {
    idle: masked('Lower_Idle', 'Idle_Ball', lowerNames),
    forward: masked('Lower_Forward', 'Walk_Ball', lowerNames),
    backward: masked('Lower_Backward', sources.has('Walk_Back_Lower') ? 'Walk_Back_Lower' : 'Walk_Ball', lowerNames),
    left: masked('Lower_Left', sources.has('Walk_Left_Lower') ? 'Walk_Left_Lower' : 'Walk_Ball', lowerNames),
    right: masked('Lower_Right', sources.has('Walk_Right_Lower') ? 'Walk_Right_Lower' : 'Walk_Ball', lowerNames),
    jump: masked('Lower_Jump', 'Jump_Shot', lowerNames),
    dribble_idle: masked('Lower_Dribble_Idle', 'Dribble_Idle_Lower', lowerNames),
    dribble_forward: masked('Lower_Dribble_Forward', 'Dribble_Forward_Lower', lowerNames),
    dribble_backward: masked('Lower_Dribble_Backward', 'Dribble_Back_Lower', lowerNames),
    dribble_left: masked('Lower_Dribble_Left', 'Dribble_Left_Lower', lowerNames),
    dribble_right: masked('Lower_Dribble_Right', 'Dribble_Right_Lower', lowerNames),
    run_forward: masked('Lower_Run_Forward', 'Run_Forward_Lower', lowerNames),
    run_backward: masked('Lower_Run_Backward', 'Run_Back_Lower', lowerNames),
    run_left: masked('Lower_Run_Left', 'Run_Left_Lower', lowerNames),
    run_right: masked('Lower_Run_Right', 'Run_Right_Lower', lowerNames),
    run_dribble_forward: masked('Lower_Run_Dribble_Forward', 'Run_Dribble_Forward_Lower', lowerNames),
    run_dribble_backward: masked('Lower_Run_Dribble_Backward', 'Run_Dribble_Back_Lower', lowerNames),
    run_dribble_left: masked('Lower_Run_Dribble_Left', 'Run_Dribble_Left_Lower', lowerNames),
    run_dribble_right: masked('Lower_Run_Dribble_Right', 'Run_Dribble_Right_Lower', lowerNames),
  };
  const upperClips = new Map([
    ['Idle_Ball', masked('Upper_Idle_Ball', 'Idle_Ball', upperNames)],
    ['Walk_Ball', masked('Upper_Walk_Ball', 'Walk_Ball', upperNames)],
    ['Run_Ball', masked('Upper_Run_Ball', 'Run_Ball_Upper', upperNames)],
    // The plain walk's own arm swing, for moving without the ball (fetching it, after a shot).
    ['Walk_Free', masked('Upper_Walk_Free', 'Walk', upperNames)],
  ]);
  // The moving variants have neutral hips and re-solved wrists. The original
  // full-body clips remain intact for desk transitions and asset comparisons.
  for (const name of ['Dribble', 'Ball_Spin', 'Jump_Shot', 'Shot_Recover', 'Celebrate']) {
    const sourceName = sources.has(`${name}_Upper`) ? `${name}_Upper` : name;
    if (sources.has(sourceName)) upperClips.set(name, masked(`Upper_${name}`, sourceName, upperNames));
  }

  function makeLayers(targetMixer) {
    function make(clip) {
      const action = targetMixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
      action.setEffectiveTimeScale(0).setEffectiveWeight(0);
      action.paused = true;
      return action;
    }
    return {
      lower: Object.fromEntries(Object.entries(lowerClips).map(([name, clip]) => [name, make(clip)])),
      upper: new Map([...upperClips].map(([name, clip]) => [name, make(clip)])),
    };
  }
  const layers = makeLayers(mixer);
  let enabled = false, phase = 0, idleTime = 0, selectedAction = null, selectedTime = 0;
  // Which way the body is travelling, as four gait weights, eased over a few frames (update).
  const heading = { forward: 1, backward: 0, left: 0, right: 0 };
  let carry = 1; // 1: arms hold the ball; 0: arms swing free
  // How much of the pose is locomotion, and how much of that is the run. Both follow the speed
  // through a short ease (update): the controller reaches full speed in a few frames, and blending
  // the legs that fast swapped idle for stride in about three frames, which read as a pop.
  const blend = { moving: 0, run: 0 };
  let last = { speed: 0, localX: 0, localZ: 0, weights: { ...heading }, blend: { ...blend }, carry, actionName: null, actionTime: 0 };
  let sampler = null;
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  const wrap = value => ((value % 1) + 1) % 1;
  const actionKey = name => name?.replace(/_Upper$/, '') ?? null;

  function headingWeights(localX, localZ) {
    const total = Math.abs(localX) + Math.abs(localZ);
    return total > 1e-6 ? {
      forward: Math.max(0, localZ) / total,
      backward: Math.max(0, -localZ) / total,
      left: Math.max(0, -localX) / total,
      right: Math.max(0, localX) / total,
    } : { forward: 1, backward: 0, left: 0, right: 0 };
  }
  function direction(speed, weights, actionName = null, eased = null) {
    const forwardWeight = weights.forward + weights.backward, sideWeight = weights.left + weights.right;
    // The walk keeps its own pace (1.32 m/s) and the run takes over above it. Blending the run in
    // from .75 m/s played both clips in slow motion at walking speed.
    const run = eased?.run ?? smooth((speed - 1.3) / .9);
    const walkStride = 1.32 * forwardWeight + .66 * sideWeight;
    const runStride = (actionName === 'Dribble' ? 1.97860585 : 2.502320811) * (forwardWeight + .5 * sideWeight);
    const stride = walkStride * (1 - run) + runStride * run;
    // Follow the controller's acceleration through the crouch-to-walk blend;
    // a near-zero threshold raised the pelvis almost in one frame.
    return { weights, stride, run, moving: eased?.moving ?? smooth((speed - .015) / .65) };
  }
  function jumpWeight(name, time) {
    if (name !== 'Jump_Shot') return 0;
    return smooth((time - .38) / .08) * (1 - smooth((time - .86) / .18));
  }
  function airborneDuration(name, start, end) {
    return name === 'Jump_Shot' ? Math.max(0, Math.min(end, .86) - Math.max(start, .46)) : 0;
  }
  function write(action, weight, time) {
    // LoopRepeat avoids an end-frame disabling a manually sampled action.
    // Clamp below duration so a non-looped authored endpoint stays its endpoint.
    action.enabled = true;
    action.paused = true;
    action.setEffectiveTimeScale(0).setEffectiveWeight(weight);
    action.time = clamp(time, 0, Math.max(0, action.getClip().duration - 1e-7));
  }
  function evaluate(targetMixer, targetLayers, sample, gaitPhase, carryTime) {
    const { speed, localX, localZ, actionName, actionTime } = sample;
    const gait = direction(speed, sample.weights ?? headingWeights(localX, localZ), actionName, sample.blend);
    const holding = sample.carry ?? 1;
    const jump = jumpWeight(actionName, actionTime);
    // Receiving height must not change when input starts/stops during a bounce.
    // These five baked lower poses share one pelvis transform with planted/IK
    // gait feet. Enter before release; leave after the last physical catch.
    const dribble = actionName === 'Dribble'
      ? smooth(actionTime / .26) * smooth((upperClips.get('Dribble').duration - actionTime) / .3) : 0;
    write(targetLayers.lower.idle, (1 - gait.moving) * (1 - jump) * (1 - dribble), (carryTime % lowerClips.idle.duration));
    write(targetLayers.lower.dribble_idle, (1 - gait.moving) * (1 - jump) * dribble, 0);
    for (const name of ['forward', 'backward', 'left', 'right']) {
      const weight = gait.moving * gait.weights[name] * (1 - jump);
      write(targetLayers.lower[name], weight * (1 - dribble) * (1 - gait.run), wrap(gaitPhase) * lowerClips[name].duration);
      write(targetLayers.lower[`run_${name}`], weight * (1 - dribble) * gait.run, wrap(gaitPhase) * lowerClips[`run_${name}`].duration);
      write(targetLayers.lower[`dribble_${name}`], weight * dribble * (1 - gait.run), wrap(gaitPhase) * lowerClips[`dribble_${name}`].duration);
      write(targetLayers.lower[`run_dribble_${name}`], weight * dribble * gait.run, wrap(gaitPhase) * lowerClips[`run_dribble_${name}`].duration);
    }
    write(targetLayers.lower.jump, jump, actionTime);

    const active = targetLayers.upper.get(actionName);
    const clipDuration = active?.getClip().duration ?? 0;
    // Contact events occur outside the short blends; release/catch timestamps
    // retain the authored upper pose and never inherit locomotion time scaling.
    // (snapIn: the caller carries the pose across the start itself, see the pose bridge in
    // 7-character.js, so the move is at full weight from its first frame. Cross-fading weights
    // here sent the free hand the long way round whenever its two poses were nearly opposite.)
    const actionWeight = active && !['Idle_Ball', 'Walk_Ball', 'Run_Ball'].includes(actionName)
      ? (sample.snapIn ? 1 : smooth(actionTime / .12)) * smooth((clipDuration - actionTime) / .12) : 0;
    const carryWalk = gait.moving;
    for (const [name, action] of targetLayers.upper) {
      let weight = name === actionName ? actionWeight : 0;
      let time = actionTime;
      if (name === 'Idle_Ball') {
        weight = (1 - actionWeight) * (1 - carryWalk);
        time = carryTime % action.getClip().duration;
      } else if (name === 'Walk_Ball') {
        weight = (1 - actionWeight) * carryWalk * (1 - gait.run) * holding;
        time = wrap(gaitPhase) * action.getClip().duration;
      } else if (name === 'Run_Ball') {
        weight = (1 - actionWeight) * carryWalk * gait.run * holding;
        time = wrap(gaitPhase) * action.getClip().duration;
      } else if (name === 'Walk_Free') {
        weight = (1 - actionWeight) * carryWalk * (1 - holding);
        time = wrap(gaitPhase) * action.getClip().duration;
      }
      write(action, weight, time);
    }
    targetMixer.update(0);
  }
  function activate(targetLayers) {
    for (const action of [...Object.values(targetLayers.lower), ...targetLayers.upper.values()]) {
      action.reset().setEffectiveTimeScale(0).setEffectiveWeight(0).play();
      action.paused = true;
    }
  }
  function stop(targetLayers) {
    for (const action of [...Object.values(targetLayers.lower), ...targetLayers.upper.values()]) action.stop();
  }
  function enter() {
    if (enabled) return;
    mixer.stopAllAction();
    enabled = true;
    activate(layers);
    evaluate(mixer, layers, last, phase, idleTime);
  }
  function exit() {
    if (!enabled) return;
    stop(layers);
    enabled = false;
    selectedAction = null;
    selectedTime = 0;
    last = { ...last, actionName: null, actionTime: 0 };
  }
  function setAction(name) {
    selectedAction = actionKey(name);
    selectedTime = 0;
    return layers.upper.get(selectedAction) ?? null;
  }
  function update(input = {}) {
    if (!enabled) return;
    const dt = Math.max(0, Number.isFinite(input.dt) ? input.dt : 0);
    const speed = Math.max(0, Number.isFinite(input.speed) ? input.speed : 0);
    const name = Object.prototype.hasOwnProperty.call(input, 'actionName') ? actionKey(input.actionName) : selectedAction;
    if (name !== selectedAction) { selectedAction = name; selectedTime = 0; }
    const time = Number.isFinite(input.actionTime) ? Math.max(0, input.actionTime) : selectedTime + dt;
    const localX = Number.isFinite(input.localX) ? input.localX : 0;
    const localZ = Number.isFinite(input.localZ) ? input.localZ : 0;
    // Ease the travel direction and the carry: a reversal or a quick turn re-weights the four
    // gaits over a few frames instead of swapping legs in one step. Exact in dt, so it reads the
    // same at any frame rate; the direction holds while standing still.
    if (Math.abs(localX) + Math.abs(localZ) > 1e-4) {
      const target = headingWeights(localX, localZ), ease = 1 - Math.exp(-dt * 14);
      for (const key in heading) heading[key] += (target[key] - heading[key]) * ease;
    }
    carry += ((input.carry === false ? 0 : 1) - carry) * (1 - Math.exp(-dt * 9));
    blend.moving += (smooth((speed - .015) / .65) - blend.moving) * (1 - Math.exp(-dt / .085));
    blend.run += (smooth((speed - 1.3) / .9) - blend.run) * (1 - Math.exp(-dt / .1));
    const gait = direction(speed, heading, name, blend);
    const airborne = airborneDuration(name, Math.max(0, time - dt), time);
    phase = wrap(phase + speed * (dt - airborne) / gait.stride);
    idleTime += dt;
    selectedTime = time;
    last = { speed, localX, localZ, weights: { ...heading }, blend: { ...blend }, carry, snapIn: input.snapIn === true, actionName: name, actionTime: time };
    evaluate(mixer, layers, last, phase, idleTime);
  }
  function predictSocket(name, nameOfAction, time, secondsAhead = 0) {
    if (!sampler) {
      const copy = cloneSkeleton(character);
      // Retain the GLTF scene's own transform, but omit CharacterPath's current
      // translation/yaw. The caller applies those to the returned position.
      copy.removeFromParent();
      const sampleMixer = new THREE.AnimationMixer(copy);
      sampler = { character: copy, mixer: sampleMixer, layers: makeLayers(sampleMixer) };
      activate(sampler.layers);
    }
    const actionName = actionKey(nameOfAction);
    const future = Math.max(0, secondsAhead);
    const actionTime = Math.max(0, time);
    const gait = direction(last.speed, last.weights, actionName, last.blend);
    const airborne = airborneDuration(actionName, actionTime - future, actionTime);
    const futurePhase = wrap(phase + last.speed * (future - airborne) / gait.stride);
    evaluate(sampler.mixer, sampler.layers, { ...last, actionName, actionTime }, futurePhase, idleTime + future);
    sampler.character.updateMatrixWorld(true);
    const socketName = { right: 'RightHandSocket', left: 'LeftHandSocket', spin: 'RightIndexTipSocket' }[name] ?? name;
    const socket = sampler.character.getObjectByName(socketName);
    if (!socket) throw Error(`Cannot predict missing socket: ${socketName}`);
    return socket.getWorldPosition(new THREE.Vector3());
  }
  function snapshot() {
    const inspect = action => ({ time: action.time, weight: action.getEffectiveWeight(), clip: action.getClip().name });
    return {
      active: enabled, phase, ...last,
      lower: Object.fromEntries(Object.entries(layers.lower).map(([name, action]) => [name, inspect(action)])),
      upper: Object.fromEntries([...layers.upper].map(([name, action]) => [name, inspect(action)])),
      movingVariants: ['Dribble_Upper', 'Ball_Spin_Upper', 'Jump_Shot_Upper', 'Walk_Back_Lower', 'Walk_Left_Lower', 'Walk_Right_Lower']
        .filter(name => sources.has(name)),
      stableDribbleVariants: ['Dribble_Idle_Lower', 'Dribble_Forward_Lower', 'Dribble_Back_Lower', 'Dribble_Left_Lower', 'Dribble_Right_Lower']
        .filter(name => sources.has(name)),
      running: direction(last.speed, last.weights, last.actionName, last.blend).run,
    };
  }
  return {
    enter, exit, update, setAction, predictSocket, snapshot,
    action: name => layers.upper.get(actionKey(name)) ?? null,
    lower: layers.lower, upper: layers.upper,
    get active() { return enabled; },
  };
}
