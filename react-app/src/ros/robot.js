/**
 * Robot dimensions for the dashboard's map views, in base_link axes (x forward,
 * the blue side): the Lunabotics rover size from the arena diagram,
 * 1.5 m x 0.75 m x 0.75 m. (Nav2's footprint on the Jetson is larger, about
 * 1.62 m x 0.71 m, because it covers the arms' full travel.)
 */
export const ROBOT_LENGTH = 1.5;
export const ROBOT_WIDTH = 0.75;
export const ROBOT_HEIGHT = 0.75;
export const ROBOT_GROUND_Z = -0.133; // floor height in base_link (wheel radius - axle height)
