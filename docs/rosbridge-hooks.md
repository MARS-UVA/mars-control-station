# rosbridge React hooks

The roslib hooks in `react-app/src/hooks/` connect the UI to the robot's ROS graph through rosbridge (`ws://localhost:9090`, see `devcontainer-ros-setup.md`). They are **not wired into `App.js` or any panel yet**. The existing `Socket.js` / `packets.js` / `robotState.js` path is untouched and still the one the UI uses.

| File | Role |
|---|---|
| `hooks/useRos.js` | The one `Ros` connection: status, retry every 2 s |
| `hooks/useTelemetry.js` | `/current_bus_voltage`, `/temperature`, `/position` |
| `hooks/useRobotState.js` | `/robot_state`, `/arm_control_mode`, `/esp_working` |
| `hooks/useGamepadPublisher.js` | `/human_input_state` + `/esp_gamepad_state` at 30 ms |
| `hooks/useRobotStateToggle.js` | `/robot_state/toggle` (event-driven) |
| `hooks/useDigDumpAction.js` | `/digdump` action client |
| `hooks/rosTypes.js` | Message constants (`ROBOT_STATE`, `DRIVE_MODE`, `DIGDUMP_INDEX`) |
| `Components/ConnectionStatus.js` (+ `.css`) | Presentational status badge, no roslib |

Every hook except `useRos` takes `ros` (null until connected once) as its first argument. `useRobotState` also takes `isConnected`.

## Toolchain (confirmed 2026-09-22)

- Branch `yogi/rosbridge-ui-refactor-work`.
- Create React App (`react-scripts ^5.0.1`), plain JavaScript: no `typescript` dependency, no `.ts`/`.tsx` under `react-app/src`.
- `react-app/.env`: `REACT_APP_ROSBRIDGE_URL=ws://localhost:9090`.
- Message workspace at `~/UVA_Projects/mars-control-station-ros_ws/install` (serial_msgs, teleop_msgs, robot_control_msgs, autonomy_msgs), sourced by `ros/ros-env.sh`.
- `roslib` **2.1.0** installed (`^2.1.0`). Note that v2 is ESM-only (`"exports": { ".": { "import": ... } }`), with named imports `import { Ros, Topic, Action } from 'roslib'`. Webpack handles it. **Jest under `react-scripts test` will not transform it**, so any test that imports a hook needs `transformIgnorePatterns` or a roslib mock. The current `App.test.js` doesn't import the hooks.
- Install caveat: WSL has no Linux `node`. Plain `npm` there resolves to Windows npm, which fails on the Linux-created `node_modules` symlinks (`EISDIR ... .bin/nanoid`). Run npm inside the devcontainer, or with `docker run node:22`, as done here.

## Message definitions (from `ros2 interface show`)

These are the only field names the hooks use. They differ from the training-robot-template-2627 versions of the same message names.

**serial_msgs/msg/CurrentBusVoltage** (all `float32`): `front_left_wheel_current`, `back_left_wheel_current`, `front_right_wheel_current`, `back_right_wheel_current`, `front_drum_current`, `back_drum_current`, `front_actuator_current`, `back_actuator_current`, `main_battery_voltage`, `aux_battery_voltage`

**serial_msgs/msg/Temperature** (all `float32`): `front_left_wheel_temperature`, `back_left_wheel_temperature`, `front_right_wheel_temperature`, `back_right_wheel_temperature`, `front_drum_temperature`, `back_drum_temperature`

**serial_msgs/msg/Position** (`float32`): `front_actuator_position`, `back_actuator_position`

**robot_control_msgs/msg/RobotState**: `uint8 state` (**default 3 = ESTOP**). Constants: `TELEOP=0`, `DIG=1`, `DUMP=2`, `ESTOP=3`

**robot_control_msgs/msg/ArmControlMode** (`uint32`): `front_arm_control`, `back_arm_control`

**std_msgs/msg/UInt8**: `uint8 data`

**teleop_msgs/msg/StickPosition** (`float64`): `y`, `x`. Constants `MAX_X=1.0`, `MAX_Y=1.0`

**teleop_msgs/msg/GamepadState**:
- `bool`: `x_pressed`, `y_pressed`, `a_pressed`, `b_pressed`, `lb_pressed`, `rb_pressed`, `dd_pressed`, `du_pressed`, `dl_pressed`, `dr_pressed`, `l3_pressed`, `r3_pressed`, `back_pressed`, `start_pressed`
- `float64`: `lt_pressed`, `rt_pressed`
- `StickPosition`: `left_stick`, `right_stick`
- Constant `MAX_TRIGGER_VALUE=1.0`

The `.msg` comments label the sticks backwards (`#right stick#` sits above `left_stick`). The hooks go by field name: `left_stick` = axes 0/1.

**teleop_msgs/msg/HumanInputState**: `GamepadState gamepad_state`, `uint8 drive_mode`, `bool a_stop`, `bool e_stop`. Constants `DRIVEMODE_TELEOP=0`, `DRIVEMODE_AUTONOMOUS=1`, `DRIVEMODE_ADVANCED_TELEOP=2`

**autonomy_msgs/action/AutonomousActions**: goal `int32 index`, result `bool success`, feedback `string status`

## Topic types (checked against mars-jetson source)

| Topic | Type | Who uses it on the Jetson |
|---|---|---|
| `/robot_state/toggle` | **`std_msgs/msg/UInt8`**, not RobotState | `robot_state_controller` subscribes (VOLATILE, KEEP_LAST 1). `digdump` also publishes to it |
| `/robot_state` | `RobotState` | `robot_state_controller` publishes TRANSIENT_LOCAL, KEEP_LAST 1 |
| `/esp_working` | `std_msgs/msg/UInt8` | `network_communication` *subscribes*. No publisher exists |
| `/esp_gamepad_state` | `GamepadState` | `esp32_bridge` subscribes |
| `/human_input_state` | `HumanInputState` | `teleop` subscribes |
| `/digdump` | `AutonomousActions` | `digdump` action server |

## Deviations from the brief

1. **`drive_mode` uses HumanInputState's `DRIVEMODE_*` constants, not RobotState's.** `network_communication/src/server.cpp` maps both Dig and Dump to `DRIVEMODE_AUTONOMOUS` (1). Using RobotState's `DUMP=2` would send `DRIVEMODE_ADVANCED_TELEOP`. `setDriveMode` only accepts values from `DRIVE_MODE`.
2. **`/robot_state/toggle` is published as `std_msgs/msg/UInt8`** (`{ data }`), because that's the type `robot_state_controller` subscribes with.
3. **ConnectionStatus lives in `Components/`** (the repo's existing capitalised directory), not a new lowercase `components/`. A case-only duplicate directory breaks checkouts on Windows and macOS. It follows `gamepad/ArmIndicator`'s pattern: a co-located `.css` using the `themes.css` variables.
4. **The digdump supersede waits for the old goal to settle** (see below). This goes beyond the brief's "cancel, then send".

## useDigDumpAction fixes

Goal index: `1` = Dig, `2` = Dump. This matches `network_communication`'s `ActionTypes` enum (`None=0, DigAutonomy=1, DumpAutonomy=2, EStop=3`) and the goal field `index`.

In roslib 2.1, a canceled, aborted or rejected goal arrives through `failedCallback` as a string, e.g. `"GoalError: Action was canceled: {...}"`.

- **(a) Operator cancel stays `canceled`.** `cancelGoal()` records the goal id. A failed-callback result for that goal settles as `canceled` and is never reported as `aborted`. A goal that actually *succeeded* before the cancel took effect is still reported as `succeeded`.
- **(b) Stale results can't clobber a new goal.** `sendGoal()` cancels any in-flight goal itself, and callbacks for any id other than the current one are ignored.
  - **Extra, found in testing:** digdump's `handle_goal` rejects any goal while `goal_active_` is true. Sending right after the cancel was rejected every time (`Rejecting goal: already running`, 3 ms after the cancel request). So the new goal is held until the old goal's terminal result arrives. After 3 s it is sent anyway, and will most likely be rejected.
  - Rejections get their own `rejected` status instead of `aborted`.
- Also: roslib's `Action.sendGoal` adds a `ros.on(goalId)` listener it never removes. The hook removes it when each goal settles.
- Unmounting does **not** cancel a running goal.

## Nothing is queued while disconnected

roslib's `callOnConnection` queues any publish, goal or cancel made while disconnected and flushes the whole queue on reconnect. For this robot that is unsafe, so every outbound path checks `ros.isConnected` first and drops the message instead:
- **Gamepad:** a 16 s outage would otherwise replay about 1,000 stale stick frames per topic.
- **Toggle:** a late ESTOP toggle can *release* the robot.
- **digdump:** a queued goal would start autonomy by itself when the link returned.

`toggle()`, `estop()`, `sendGoal()` and `cancelGoal()` return `false` when nothing was sent. Show that to the operator.

If the link drops with a digdump goal in flight, its result can never arrive (it belonged to the old rosbridge session). The hook drops the goal and sets status to `unknown`. **The robot may still be executing it.**

## Behaviour notes for the wiring step

- **`useRobotState`**: every value is `null` / `'unknown'` until a real message arrives, and it resets to unknown while disconnected. The message's own default (ESTOP) is never shown. `espWorking` is `null` until received, which is distinct from a real `0`.
- **`estop()` is a toggle, not a latch.** `robot_state_controller` releases ESTOP → TELEOP when it receives ESTOP while already in ESTOP. Check `robotState` before using it as a stop button.
- **Gamepad**:
  - Only `mapping === 'standard'` pads are read. Anything else publishes neutral and reports `gamepadStatus: 'unsupported-mapping'`.
  - Stick y is negated (up = +), as in `gamepad/gamepad.js`, but the `directionStore` direction switch is **not** applied. Decide that when wiring.
  - While the window is blurred or hidden, every tick publishes neutral, not just the transition.
  - Chrome throttles timers in hidden tabs to about 1 Hz. Those frames are neutral anyway.
  - `a_stop` and `e_stop` are always `false`. Estop goes through `/robot_state/toggle`.
- **Replayed toggles (hazard):** rosbridge advertises `/robot_state/toggle` as TRANSIENT_LOCAL, depth 100, lifespan 1 s. rmw_zenoh doesn't enforce the lifespan, so any **transient-local** subscriber that joins late gets old toggles replayed. `ros2 topic echo` does, because it matches the publisher's durability. `robot_state_controller` subscribes VOLATILE and got exactly one message per click in testing. Don't add a transient-local subscriber to this topic.

## Verification (step 10)

**Not verified against real mars-jetson data.** The mars-jetson container was up, but no Zenoh router or ROS nodes were running in it (port 7447 refused). The checks below instead ran on a local stack:
- `rmw_zenohd`
- rosbridge from the control-station devcontainer image (rosbridge_server isn't installed in WSL itself)
- the ROS CLI
- the **real mars-jetson `digdump` action server**, run in a throwaway container from the mars-jetson image

The hooks were exercised in Chrome through a temporary harness page, which has since been deleted. `index.js` was restored.

Confirmed:
- `useRos` reaches `connected`. After rosbridge is stopped and restarted, the status goes closed → error → connected, and roslib re-subscribes all six subscriptions (checked with `ros2 topic info`).
- All five inbound topics arrive with the field names above and `lastReceived` timestamps. `/esp_working` `0` is distinct from `null`.
- `/robot_state` shows `unknown` before the first message. After a reconnect it picked up a value changed *during* the outage (DIG → DUMP), so it isn't stale.
- rosbridge resolved every type, and ROS received `/human_input_state` and `/esp_gamepad_state` with exactly the field set above. `drive_mode` changed 0 → 1 on `setDriveMode(DRIVE_MODE.AUTONOMOUS)`.
- `/robot_state/toggle` carried `{data: 3}` for estop and `{data: 1}` for DIG.
- digdump: dig → cancel settled as `canceled`. Dig → dump: the old goal was canceled and dump accepted only after `Goal Canceled` (server log). Cancel during a supersede also behaved correctly.
- CRA eslint config: clean. `react-scripts start`: compiled with all hooks bundled.

A code review before commit added the disconnect guards above, the `unknown` status, the `useRos` retry after a rejected `connect()`, and reporting a success that races a cancel as `succeeded`. These were linted, but **not re-run against the live stack**.

Not verified:
- Real telemetry values and QoS from the Jetson.
- A physical gamepad: only neutral frames were published, because no pad was connected.
- The 30 ms rate: the tab was in the background, so it was throttled.
- A digdump goal running to success.
