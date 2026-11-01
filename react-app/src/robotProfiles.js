// Routine indices mirror autonomy_msgs/action/Dig and Dump on the Jetson.
// Add routine indices when the corresponding server variants are implemented.
export const ROBOT_PROFILES = Object.freeze({
  bruno: Object.freeze({ label: 'Bruno', layout: 'full', digIndex: 0, dumpIndex: 0 }),
  frontloader: Object.freeze({ label: 'Frontloader', layout: 'minimal' }),
  groundDrum: Object.freeze({ label: 'groundDrum', layout: 'minimal' }),
});
export const DEFAULT_ROBOT = 'bruno';
