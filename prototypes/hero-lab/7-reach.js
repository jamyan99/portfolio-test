// Small receiving-hand corrections keep the ball contact honest while the
// independent gait changes phase. Bone lengths and the authored palm turn stay.
export function createReceivingReach({ THREE, character, socketForHand }) {
  const vector = () => new THREE.Vector3();
  const rotation = () => new THREE.Quaternion();
  const world = vector(), tip = vector(), from = vector(), to = vector();
  const delta = rotation(), parent = rotation(), current = rotation(), palm = rotation();
  const arms = {};
  for (const side of ['right', 'left']) {
    const prefix = side === 'right' ? 'Right' : 'Left';
    const bone = suffix => character.getObjectByName(`mixamorig${prefix}${suffix}`)
      ?? character.getObjectByName(`mixamorig:${prefix}${suffix}`);
    arms[side] = { upper: bone('Arm'), lower: bone('ForeArm'), hand: bone('Hand') };
  }
  return function reach(side, target, amount = 1, maximum = .12) {
    const arm = arms[side], socket = socketForHand(side);
    if (!arm?.hand || !arm.upper || !arm.lower || amount <= 0) return 0;
    character.updateMatrixWorld(true);
    socket.getWorldPosition(tip);
    const desired = tip.clone().add(target.clone().sub(tip).clampLength(0, maximum).multiplyScalar(amount));
    const original = tip.clone();
    arm.hand.getWorldQuaternion(palm);
    for (let iteration = 0; iteration < 5; iteration++) {
      for (const joint of [arm.lower, arm.upper]) {
        joint.getWorldPosition(world); socket.getWorldPosition(tip);
        from.copy(tip).sub(world); to.copy(desired).sub(world);
        if (from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) continue;
        delta.setFromUnitVectors(from.normalize(), to.normalize());
        joint.getWorldQuaternion(current); joint.parent.getWorldQuaternion(parent);
        joint.quaternion.copy(parent.invert().multiply(delta.multiply(current))).normalize();
        character.updateMatrixWorld(true);
      }
      // Keep the wrist's authored world orientation, including palm normal.
      arm.hand.parent.getWorldQuaternion(parent);
      arm.hand.quaternion.copy(parent.invert().multiply(palm));
      character.updateMatrixWorld(true);
    }
    return socket.getWorldPosition(tip).distanceTo(original);
  };
}
