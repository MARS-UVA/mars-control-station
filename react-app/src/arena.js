/**
 * Lunabotics arena layout (KSC arena diagram) for the minimap overlay.
 *
 * Arena coordinates, in metres: origin at the inner bottom-left corner of the
 * diagram (the starting-zone corner), x along the 6.88 m side toward the
 * construction zone, y along the 5 m side away from it. mars-jetson's NASA
 * Gazebo worlds use this same corner-based frame (startup/world/arena_nasa.world,
 * checked by startup/test/test_arena_origins.py), and so do the surveyed
 * AprilTag priors (startup/marker_priors.py) that RTAB-Map anchors its map
 * frame to. So once the robot is localized, map coordinates are arena
 * coordinates and the overlay needs no offset.
 *
 * This is the minimap's fallback only. When mars-jetson publishes
 * /arena/markers (Nav2 launched with arena_name:=ARENA_NASA), the minimap
 * draws those instead, so the robot's robot_navigation/scripts/arena_configs.py
 * is the source of truth; keep these numbers in step with it.
 *
 * Only the zones and the target berm area are included. Rocks, craters and
 * the column are left out; the minimap shows real obstacles from the
 * costmaps.
 */

export const ARENA = {
  width: 6.88,
  height: 5.0,
  // Excavation zone x 0..2.5, obstacle zone x 2.5..6.88.
  zoneDivideX: 2.5,
  startZone: { x: 0, y: 0, w: 2.0, h: 2.0 },
  constructionZone: { x: 3.88, y: 0, w: 3.0, h: 1.5 },
  // Target berm area, 2.2 m x 0.9 m, inside the construction zone. Berm
  // volume outside it does not score. The diagram does not give its exact
  // position; like arena_configs.py, it is centred in the construction zone.
  berm: { cx: 5.38, cy: 0.75, w: 2.2, h: 0.9 },
};

/**
 * Where the robot started, in arena coordinates. Only used as a fallback,
 * when there is no map frame (RTAB-Map not running), so the robot pose
 * resolves in odom, which begins at the robot's starting pose. The default
 * is the Gazebo spawn: the middle of the starting zone, facing +x
 * (gazebo.launch.py spawns at 1.0, 1.0, yaw 0). With a map frame the overlay
 * is placed by the AprilTag anchor instead and this value is not used.
 */
export const ROBOT_START_IN_ARENA = { x: 1.0, y: 1.0, yaw: 0 };
