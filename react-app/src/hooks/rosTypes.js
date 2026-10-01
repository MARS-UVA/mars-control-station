/**
 * Constants mirrored from the ROS interface definitions, as reported by
 * `ros2 interface show` against the built message workspace. See
 * docs/rosbridge-hooks.md before changing anything here.
 */

// robot_control_msgs/msg/RobotState
export const ROBOT_STATE = Object.freeze({
  TELEOP: 0,
  DIG: 1,
  DUMP: 2,
  ESTOP: 3,
});

// teleop_msgs/msg/HumanInputState. drive_mode uses these, NOT RobotState's
// values: network_communication maps both Dig and Dump to AUTONOMOUS.
export const DRIVE_MODE = Object.freeze({
  TELEOP: 0,
  AUTONOMOUS: 1,
  ADVANCED_TELEOP: 2,
});

// autonomy_msgs/action/AutonomousActions goal.index, per network_communication's
// ActionTypes enum (server.hpp).
export const DIGDUMP_INDEX = Object.freeze({
  DIG: 1,
  DUMP: 2,
});
