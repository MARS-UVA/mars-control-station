// Drum arm kinematics. Input is the calibrated actuator position from the
// robot's /position topic: 0.0 is fully retracted (drums raised) and 1.0 is
// fully extended (drums at the ground position).
//
// Linkage: law of cosines on the actuator triangle gives the arm angle above
// horizontal, then the drum center is placed along the arm.
const ACTUATOR_LENGTH_OFFSET_IN = 23.6224274544;
const ACTUATOR_POSITION_SCALE_IN = 12;
const LINKAGE_LENGTH_SQUARED_IN = 737.506048128;
const LINKAGE_COSINE_SCALE = -643.804738952;
const ARM_ANGLE_OFFSET_DEG = 142.920267719;
// Distance along the arm, and perpendicular to it, from the arm pivot to the
// drum center. NOTE: robot.urdf puts the drum at 14.0625 in along the arm and
// 1.8775 in off it; one of the two is likely wrong. Check against the robot.
const ARM_LENGTH_IN = 12.0625;
const DRUM_OFFSET_IN = 2.015;
// From robot.urdf: arm pivot height above the ground (front arm pivot is
// 0.25 in above the front axle, wheels are 7 in radius) and drum radius.
const PIVOT_HEIGHT_ABOVE_GROUND_IN = 7.25;
const DRUM_RADIUS_IN = 6.1;

// Fully extended. The linkage itself allows slightly more (about 1.13), but
// the actuator stops at 1.0.
export const MAX_ACTUATOR_POSITION = 1.0;

// Angle of the arm-pivot-to-drum-center line, relative to the arm itself.
export const DRUM_OFFSET_ANGLE_DEG = (Math.atan2(DRUM_OFFSET_IN, ARM_LENGTH_IN) * 180) / Math.PI;

const degreesToRadians = (degrees) => (degrees * Math.PI) / 180;

/**
 * @returns {null | {
 *   angleDegrees: number,           arm angle above horizontal
 *   horizontalOffsetInches: number, drum center, outward from the arm pivot
 *   verticalOffsetInches: number,   drum center, up from the arm pivot
 *   heightAboveGroundInches: number lowest point of the drum above the ground
 *                                   (negative = below ground level, digging)
 * }}
 */
export function calculateDrumKinematics(actuatorPosition) {
  if (!Number.isFinite(actuatorPosition)) return null;

  const actuatorLength = ACTUATOR_LENGTH_OFFSET_IN
    + ACTUATOR_POSITION_SCALE_IN * actuatorPosition;
  const cosine = (
    (actuatorLength ** 2 - LINKAGE_LENGTH_SQUARED_IN) / LINKAGE_COSINE_SCALE
  );
  if (cosine < -1 || cosine > 1) return null;

  const angleDegrees = ARM_ANGLE_OFFSET_DEG - (Math.acos(cosine) * 180) / Math.PI;
  const angleRadians = degreesToRadians(angleDegrees);
  const verticalOffsetInches = (
    ARM_LENGTH_IN * Math.sin(angleRadians)
    - DRUM_OFFSET_IN * Math.cos(angleRadians)
  );

  return {
    angleDegrees,
    horizontalOffsetInches: (
      ARM_LENGTH_IN * Math.cos(angleRadians)
      + DRUM_OFFSET_IN * Math.sin(angleRadians)
    ),
    verticalOffsetInches,
    heightAboveGroundInches: PIVOT_HEIGHT_ABOVE_GROUND_IN + verticalOffsetInches - DRUM_RADIUS_IN,
  };
}
