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

The Jetson devcontainer uses host networking so its router and its WebRTC ICE
candidates carry an address the browser can reach. This container stays on the
`mars-dev` bridge network, reaches the Jetson as `host.docker.internal`, and
publishes 6767 and 6969 to the host so the Jetson's streamers can dial the
relay at `127.0.0.1`.

## Environment

`ros/ros-env.sh` is sourced by `start.sh`, `start-rosbridge.sh`, and `~/.bashrc`
in the container. It is a no-op on a machine without ROS. It sources ROS Jazzy
and the message workspace, sets `RMW_IMPLEMENTATION=rmw_zenoh_cpp`, and, when
`JETSON_IP` is set, points Zenoh at `tcp/$JETSON_IP:7447` in client mode.
Client mode matters: in peer mode this host would advertise its own listener,
which nothing behind WSL2's NAT can reach.

| Variable | Devcontainer | Real robot |
| --- | --- | --- |
| `JETSON_IP` | `host.docker.internal` | the robot's IP |
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
```

`start.sh` waits for rosbridge to accept connections before starting the UI,
refuses to start on a busy port, and stops all three processes on Ctrl+C or a
closed terminal. `start-rosbridge.sh` also disables Zenoh scouting so a bench
run cannot attach to a real robot on the LAN.

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

Constants live in `react-app/src/hooks/rosTypes.js`. `RobotState` is TELEOP 0,
DIG 1, DUMP 2, ESTOP 3. `HumanInputState.drive_mode` uses its own enum (TELEOP 0,
AUTONOMOUS 1, ADVANCED_TELEOP 2). Digdump goal index is DIG 1, DUMP 2.

## UI behaviour

`REACT_APP_USE_ROSBRIDGE` is read at build time. `start.sh` sets it to `true`.
`App.js` passes either the rosbridge hooks or the old `packets.js` functions to
the same panels; only one path is ever loaded.

No hook sends while rosbridge is disconnected. roslib would queue the message and
flush it on reconnect, and a late ESTOP toggle can release the robot as easily
as stop it. The status block shows "not sent: rosbridge disconnected" instead.

STOP publishes ESTOP to `/robot_state/toggle` first, unconditionally, then
cancels any digdump goal.

The ESP banner and the Dig/Dump buttons use `useEspStatus`: the ESP is "online"
if any of the three serial topics arrived in the last 2 s, the same rule the old
UDP gateway used. If the node list shows Gazebo nodes and no `serial_node`, the
ESP is "not present", the banner is hidden, and Dig/Dump stay disabled. The
`mock` backend looks like real hardware with a dead ESP and shows the banner.

## Known gaps

- `robot_state_controller` has no ESTOP latch: any non-ESTOP toggle received
  while in ESTOP becomes the new state. `digdump` publishes TELEOP to
  `/robot_state/toggle` on cancel and on completion. So STOP during an autonomy
  run ends in TELEOP with the goal dead, not in a held ESTOP. Press STOP again
  for a held ESTOP. The legacy gateway behaved the same way. The fix belongs on
  the Jetson: ignore non-ESTOP toggles while in ESTOP, and have `digdump` abort
  on ESTOP instead of publishing TELEOP.
- With `server/ws_server.js` no longer serving port 3001, the
  `REACT_APP_USE_ROSBRIDGE=false` path connects to nothing.
- `udp_client` and `udp_server` still launch on the Jetson and talk to nothing.
- Verified in Gazebo only, with a synthetic gamepad. No real robot, ESP,
  gamepad, or dig/dump cycle. Camera ICE addressing is untested against a real
  Jetson.
