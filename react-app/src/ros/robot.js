import { calculateDrumKinematics } from '../Components/drumKinematics';

/**
 * Robot dimensions for the dashboard's map views, in base_link axes (x forward,
 * the blue side): the Lunabotics rover size from the arena diagram,
 * 1.5 m x 0.75 m x 0.75 m. (Nav2's footprint on the Jetson is larger, about
 * 1.62 m x 0.71 m, because it covers the arms' full travel.)
 */
export const ROBOT_LENGTH = 1.5; // rule size; see robotFootprint for the drawn length
export const ROBOT_WIDTH = 0.75;
export const ROBOT_HEIGHT = 0.75;
export const ROBOT_GROUND_Z = -0.133; // floor height in base_link (wheel radius - axle height)

// ---------------------------------------------------------------------------
// Drum-dependent footprint. The fixed ROBOT_LENGTH above is the rule-size box;
// the map views instead draw the robot's actual length, which depends on how
// far each drum arm is swung out.

const INCH = 0.0254;
// From robot.urdf: the arm pivots sit 0.2921 m (11.5 in) fore and aft of the
// frame centre, which is base_link's origin.
const ARM_PIVOT_X = 0.2921;
const DRUM_RADIUS = 6.1 * INCH; // same as drumKinematics.js

/**
 * Distance (m) from base_link's origin, along x, to the outer edge of one
 * drum, for a calibrated actuator position (0 = raised, 1 = lowered). Unknown
 * or invalid readings use the fully lowered reach, so the box is never drawn
 * smaller than the robot might really be.
 */
export function drumReach(actuatorPosition) {
  const k = calculateDrumKinematics(actuatorPosition) ?? calculateDrumKinematics(1.0);
  return ARM_PIVOT_X + k.horizontalOffsetInches * INCH + DRUM_RADIUS;
}

/**
 * Footprint along x in base_link: front (+x) and rear (-x) extents in metres,
 * plus the box's length and the x of its centre. The two drums move
 * independently, so the box is not always centred on base_link.
 */
export function robotFootprint(frontActuatorPosition, backActuatorPosition) {
  const front = drumReach(frontActuatorPosition);
  const rear = drumReach(backActuatorPosition);
  return { front, rear, length: front + rear, centerX: (front - rear) / 2 };
}
