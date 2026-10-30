// Routine indices mirror autonomy_msgs/action/Dig and Dump on the Jetson.
// Add profiles here when both corresponding server variants are implemented.
export const ROBOT_PROFILES = Object.freeze({
  bruno: Object.freeze({ label: 'Bruno', digIndex: 0, dumpIndex: 0 }),
});
export const DEFAULT_ROBOT = 'bruno';
