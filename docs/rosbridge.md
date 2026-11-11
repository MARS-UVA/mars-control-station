# rosbridge

How the control station talks to the robot, and what to know before changing it.

## Topology

```
browser ──ws://localhost:9090──> rosbridge ──Zenoh client──> Jetson router :7447 ──> robot nodes
browser <──WebRTC────────────── Jetson gstreamer streamers
                                   └──ws :6767 / :6969──> signaling relay (server/ws_server.js)
```

rosbridge runs in this devcontainer next to the React dev server, not on the
Jetson. It joins the robot's ROS graph as a Zenoh client of the router the
Jetson's `launch.py` starts. This container never runs its own router.

Both devcontainers join the `mars-dev` Docker bridge network. On the same
Docker host, this container reaches the Jetson router as `mars-jetson:7447`,
and the Jetson's streamers reach the signaling relay as
`mars-control-station:6767` / `mars-control-station:6969` using
`CONTROL_STATION_IP=mars-control-station`.

A bridge network belongs to one Docker host. For a robot and laptop on separate
hosts, set `JETSON_IP` here to the Jetson's LAN IP and `CONTROL_STATION_IP` on
the Jetson to the laptop's LAN IP. The Jetson must publish TCP 7447; this
container publishes TCP 6767 and 6969. Match `ROS_DOMAIN_ID` on both sides.

WebRTC video travels separately over ICE-selected connections. Publishing the
signaling ports does not make the video reachable through Docker NAT. Camera
connectivity needs verification; if direct ICE connectivity fails, configure
a reachable TURN relay in both the Jetson streamer and browser.

## Environment

`ros/ros-env.sh` is sourced by `start.sh`, `start-rosbridge.sh`, and `~/.bashrc`
in the container. It is a no-op on a machine without ROS. It sources ROS Jazzy
and the message workspace, sets `RMW_IMPLEMENTATION=rmw_zenoh_cpp`, and, when
`JETSON_IP` is set, points Zenoh at `tcp/$JETSON_IP:7447` in client mode.
Client mode matters: in peer mode this host would advertise its own listener,
which nothing behind WSL2's NAT can reach.

| Variable | Devcontainer | Real robot |
| --- | --- | --- |
| `JETSON_IP` | `mars-jetson` (same Docker host) | the robot's IP |
| `ROS_DOMAIN_ID` | 42 (forced by `containerEnv`) | 0 (bare-metal default), override on the command line |
| `ROS_AUTOMATIC_DISCOVERY_RANGE` | `LOCALHOST` | ignored by rmw_zenoh either way |

Non-interactive shells (`bash -c`, `docker exec` without `-it`) do not run
`.bashrc`, so run `source ros/ros-env.sh` first in those.

## Message packages

The four interface packages (`serial_msgs`, `teleop_msgs`, `robot_control_msgs`,
`autonomy_msgs`) come from the `ros/mars-ros-interfaces` submodule.
`ros/setup-ros-ws.sh` symlinks them into a colcon workspace at
`$MARS_ROS_WS` (default `~/UVA_Projects/mars-control-station-ros_ws`) and
builds them. The workspace is outside the repo because the repo lives on a
Windows mount and build output must not be committed. `postCreateCommand` runs
all of this.

mars-jetson keeps its own copy of these packages in `src/`, not the submodule.
When the submodule pin moves, check that the two still match. If rosbridge
cannot import a package it logs "Cannot infer topic type" for every message on
that topic; `start-rosbridge.sh` warns about missing packages up front.

## Running

```bash
./start.sh                                     # rosbridge, relay, React dev server
./ros/verify-jetson-link.sh                    # second terminal, with the Jetson up
./start-rosbridge.sh                           # UI and rosbridge only, no robot
JETSON_IP=<robot ip> ROS_DOMAIN_ID=0 ./start.sh   # real robot
./start.sh --robot frontloader                # select the Frontloader UI
./start.sh --robot groundDrum                 # select the groundDrum UI
```

`start.sh` starts the relay and UI immediately, waits for the Jetson's Zenoh
port (7447) without an overall timeout, then starts rosbridge and checks that
it accepts connections within 20 seconds. The UI retries its connection while
waiting. The script refuses to start on a busy port
and stops all three processes on Ctrl+C or a
closed terminal. `start-rosbridge.sh` also disables Zenoh scouting so a bench
run cannot attach to a real robot on the LAN.
The optional `--robot` flag accepts `bruno` (the default), `frontloader`, or
`groundDrum`. Bruno keeps the existing dashboard. The other profiles currently
show the camera and lidar visualizations in the middle column, with blank side
columns except for the timer and selected robot label at the lower-left.

Keep the browser tab in the foreground. Chrome throttles background timers to
about 1 Hz, which makes the gamepad publish rate and topic rates look wrong.

## Topics

| Topic | Type | Direction | Hook |
| --- | --- | --- | --- |
| `/current_bus_voltage` | `serial_msgs/CurrentBusVoltage` | robot → UI | `useTelemetry` |
| `/temperature` | `serial_msgs/Temperature` | robot → UI | `useTelemetry` |
| `/position` | `serial_msgs/Position` | robot → UI | `useTelemetry` |
| `/robot_state` | `robot_control_msgs/RobotState` (transient local) | robot → UI | `useRobotState` |
| `/arm_control_mode` | `robot_control_msgs/ArmControlMode` | robot → UI | `useRobotState` |
| `/esp_working` | `std_msgs/UInt8` (nothing publishes it) | robot → UI | `useRobotState` |
| `/human_input_state` | `teleop_msgs/HumanInputState`, 30 Hz | UI → robot | `useGamepadPublisher` |
| `/robot_state/toggle` | `std_msgs/UInt8` | UI → robot | `useRobotStateToggle` |
| `/digdump` | `autonomy_msgs/action/AutonomousActions` | UI → robot | `useDigDumpAction` |
| `/unilidar/cloud` | `sensor_msgs/PointCloud2` (live lidar scan, not accumulated; CBOR, throttled to 5 Hz, voxel-thinned to 0.05 m in the browser; always subscribed: the 3D view is always on screen; crosses the wireless link on the real robot) | robot → UI | `PointCloudPanel` |
| `/global_costmap/costmap` | `nav_msgs/OccupancyGrid` (Nav2 global costmap in `map`: RTAB-Map's lidar grid plus inflation; CBOR, 1 Hz; only while Nav2 runs) | robot → UI | `MiniMapPanel` |
| `/local_costmap/costmap` | `nav_msgs/OccupancyGrid` (Nav2 local costmap in `odom`: 6 x 6 m around the robot from the RGB-D cameras; CBOR, 2 Hz; only while Nav2 runs) | robot → UI | `MiniMapPanel` |
| `/arena/markers` | `visualization_msgs/MarkerArray` (arena zones in `map` from `arena_markers_node`; read once per connection, then unsubscribed; only with `enable_nav2:=true arena_name:=ARENA_NASA`, else the built-in `arena.js` layout is drawn) | robot → UI | `MiniMapPanel` |
| `/compute_path_to_pose` | `nav2_msgs/action/ComputePathToPose` (Nav2 planner_server; plans only, never moves the robot; goal in `map`, `use_start: false`; result `path` drawn on the minimap; needs `ros-jazzy-nav2-msgs` in this container; only while Nav2 runs) | UI → robot | `usePlanPath` via `MiniMapPanel` |
| `/tf`, `/tf_static` | `tf2_msgs/TFMessage` (JSON, unthrottled; used for `map → odom → base_link` and the lidar's fixed mount, to place the robot, camera and scans; always subscribed) | robot → UI | `PointCloudPanel`, `MiniMapPanel` (via `ros/tf.js`) |

Constants live in `react-app/src/hooks/rosTypes.js`. `RobotState` is TELEOP 0,
DIG 1, DUMP 2, ESTOP 3. `HumanInputState.drive_mode` uses its own enum (TELEOP 0,
AUTONOMOUS 1, ADVANCED_TELEOP 2). Both goals take `{ index }`, return `{ success }`, and report `{ phase }`.
Bruno's routine indices are in `robotProfile` at the top of
`react-app/src/apps/BrunoApp.js`, with index 0 for both routines. Change them
as Jetson variants become available. Selection is locked during active,
canceling, or unknown goals and on the legacy transport. This selects routines
on the connected Jetson; it does not change the rosbridge host.

## UI behaviour

`REACT_APP_USE_ROSBRIDGE` is read at build time. `start.sh` sets it to `true`.
Each robot app in `src/apps/` passes either the rosbridge hooks or the old `packets.js` functions to
the same panels; only one path is ever loaded.

No hook sends while rosbridge is disconnected. roslib would queue the message and
flush it on reconnect, and a late ESTOP toggle can release the robot as easily
as stop it. The status block shows "not sent: rosbridge disconnected" instead.

Clicking Dig or Dump again while that command is running attempts to cancel
its goal without restarting it. Clicking the other command cancels the old
goal and waits for it to settle before sending the replacement. Repeating a
queued command cancels the replacement too. If cancellation is not confirmed
within 3 seconds, the replacement is dropped and an error is shown; the previous
goal remains tracked. Keyboard shortcuts behave the same.

STOP publishes ESTOP to `/robot_state/toggle` first, unconditionally, then
cancels any digdump goal.

The ESP banner uses `useEspStatus`: the ESP is "online"
if any of the three serial topics arrived in the last 2 s, the same rule the old
UDP gateway used. If the node list shows Gazebo nodes and no `serial_node`, the
ESP is "not present" and the banner is hidden. The `mock` backend looks like
real hardware with a dead ESP and shows the banner. Dig/Dump buttons and
keyboard shortcuts remain available regardless of ESP status; goals are only
sent while rosbridge is connected.

### Path preview

Set goal on the minimap arms one pick. Clicking places the goal; dragging
before releasing sets the heading the robot should finish at, and a plain click
makes it face away from the robot. Esc or Cancel goal disarms it. The goal is
sent to `/compute_path_to_pose` in the `map` frame, so the button is disabled
until the robot pose resolves to `map` (RTAB-Map running). The returned path is
drawn in magenta, dashed where Hybrid-A* plans a reversal, with its length and
planning time in the status block; planner errors (goal occupied, outside the
map, no valid path) are shown there instead. A new pick cancels a request still
in flight, and Clear goal removes the goal and path.

This calls the planner directly, the same action server `bt_navigator` uses
while navigating. Nav2's action servers serve one goal at a time, so a preview
requested during autonomous navigation can preempt the navigator's own
replanning request and make it run a recovery. Preview while the robot is not
navigating.

## Known gaps

- ESTOP is a toggle, not a latch: pressing STOP while already in ESTOP releases
  it to TELEOP, and a non-ESTOP state request can also leave ESTOP. The separate
  Dig/Dump servers abort when displaced and avoid restoring TELEOP after they
  observe another state, but this does not provide a latched emergency stop.

- With `server/ws_server.js` no longer serving port 3001, the
  `REACT_APP_USE_ROSBRIDGE=false` path connects to nothing.
- `udp_client` and `udp_server` still launch on the Jetson and talk to nothing.
- Verified in Gazebo only, with a synthetic gamepad. No real robot, ESP,
  gamepad, or dig/dump cycle. Camera ICE addressing is untested against a real
  Jetson.
