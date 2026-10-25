/**
 * Lunabotics arena layout (KSC arena diagram) for the minimap overlay.
 *
 * Arena coordinates, in metres: origin at the bottom-left corner of the
 * diagram (the starting-zone corner), x along the 6.88 m side toward the
 * construction zone, y along the 5 m side away from it. This is the frame
 * mars-jetson's Gazebo world uses too, shifted by y - 2.5 there
 * (startup/world/arena_nasa.world).
 *
 * Only the zones and the target berm area are included. Rocks, craters and
 * the column are left out for now; the minimap shows real obstacles from the
 * lidar.
 */

export const ARENA = {
  width: 6.88,
  height: 5.0,
  // Excavation zone x 0..2.5, obstacle zone x 2.5..6.88.
  zoneDivideX: 2.5,
  startZone: { x: 0, y: 0, w: 2.0, h: 2.0 },
  constructionZone: { x: 3.88, y: 0, w: 3.0, h: 1.5 },
  // Target berm area, 2.2 m x 0.9 m, inside the construction zone. Berm
  // volume outside it does not score. The diagram is not to scale, so its
  // centre is measured off the drawing and only approximate: correct cx/cy
  // to the official berm position.
  berm: { cx: 5.40, cy: 0.57, w: 2.2, h: 0.9 },
};

/**
 * Where the robot started, in arena coordinates. RTAB-Map's map frame (and
 * odom) begin at the robot's starting pose, so this is what lines the overlay
 * up with the minimap. The default is the Gazebo spawn: the middle of the
 * starting zone, facing +x (gazebo.launch.py spawns at world 1.0, -1.5, yaw 0).
 * On the real robot, set it to the actual start position and heading.
 */
export const ROBOT_START_IN_ARENA = { x: 1.0, y: 1.0, yaw: 0 };
