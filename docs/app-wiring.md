# App.js wiring: legacy WebSocket path vs rosbridge path

**Date:** 2026-09-23
**Branch:** `yogi/rosbridge-ui-refactor-work`
**Status:** wired and committed on the branch; not yet exercised against a live robot (see *Verification*). Nothing under `server/` and none of `Socket.js`, `packets.js`, `robotState.js`, `gamepad/gamepad.js`, `gamepad/directionStore.js` were touched.

The six roslib hooks from `docs/rosbridge-hooks.md` are now called from `App.js`, behind a build-time flag. The default is the legacy path, unchanged.

## The flag

`react-app/.env`:

```
REACT_APP_USE_ROSBRIDGE=false
```

- Read once at build/start time (Create React App inlines `REACT_APP_*`). Changing it means restarting `npm start`. A shell variable (`REACT_APP_USE_ROSBRIDGE=true npm start`) or `.env.local` overrides the file.
- Anything other than the exact string `true` is the legacy path.
- `App.js` evaluates it into one module-level constant, `USE_ROSBRIDGE`, and every choice below is a ternary on that constant. There is no runtime toggle: swapping data sources under live robot control was not wanted.

### Only one path is ever active

| | Legacy (`false`, default) | rosbridge (`true`) |
|---|---|---|
| Inbound telemetry / state | `<Socket …/>` rendered, as before | `<RosbridgeFeed …/>` rendered instead of `Socket` |
| Gamepad transmit | `packets.js` 30 ms loop, started when the module is imported | `useGamepadPublisher` 30 ms loop |
| Commands | `packets.js` `sendCustomCommandState` | `useDigDumpAction` / `useRobotStateToggle` |
| rosbridge socket | never opened: `useRos({ enabled: false })` returns `ros: null`, `status: 'closed'`, and every other hook is a no-op on a null `ros` | `useRos` connects to `REACT_APP_ROSBRIDGE_URL` |
| `packets.js` module | loaded | **never loaded** (see below) |

All six hooks are called unconditionally at the top of `App` (hook rules). `useRos` gained an `{ enabled }` option so that the legacy path never opens, or retries, a rosbridge connection.

`packets.js` has import-time side effects (opens `ws://localhost:3001`, starts the transmit interval). To keep it off the rosbridge path it is no longer imported by any component. `App.js` loads a small adapter module with a conditional `require`:

```js
const legacy = USE_ROSBRIDGE ? null : require('./legacyNetworking');
```

`react-app/src/legacyNetworking.js` re-exports the same `packets.js` / `gamepad.js` functions the two components used to import, grouped as `legacyGamepad` and `legacyCommands`. It is the only importer of `packets.js` besides `gamepad.js` itself.

## Per-panel prop mapping

Components whose props did **not** change: `LiveDataPanel`, `ArmIndicator`, `DirectionChangeButton`, `GamepadDisplay`, `WebcamPanel`, `Timer`, `ThemeChanger`. `DriveStatePanel` and `ActuatorDataDisplay` are not rendered by `App.js` and were not touched.

### LiveDataPanel (`lastDataPoint`, `chartData`, `timestamp`)

Unchanged props, unchanged component. `Components/RosbridgeFeed.js` replaces `Socket.js` as the producer. It mirrors Socket's loop: every 200 ms it appends one point to `chartData` (60 s window, 300 points) and sets `lastDataPoint`, using `setTimestamp` as the counter. The point has the same keys:

| Point field | Legacy source (feedback blob) | rosbridge source (`useTelemetry`) |
|---|---|---|
| `front_left_wheel_current` … `back_actuator_current`, `main_battery_voltage`, `aux_battery_voltage` | `Float32Array[0..9]` | `currentBusVoltage.<same name>` (`serial_msgs/CurrentBusVoltage`) |
| `front_left_wheel_temperature` … `back_drum_temperature` | `Float32Array[10..15]` | `temperature.<same name>` (`serial_msgs/Temperature`) |
| `front_actuator_position`, `back_actuator_position` | `Float32Array[16..17]` | `position.<same name>` (`serial_msgs/Position`) |
| `globalDataRate`, `xGyro`, `yGyro`, `zGyro` | dead streams, always 0 (see networking audit) | constant 0, kept so the point shape is identical |

Before a topic's first message its fields are left `undefined`, so the value cards show `NaN` rather than a `0.00` that could pass for a reading. That is what the legacy page shows before its first feedback packet too (Socket.js seeds its `Float32Array` with length 4, so everything past index 3 is undefined until then). The stall-current check is false on `undefined`, and the temperature check waits for the first `/temperature` message, so no alarm fires on missing data.

RosbridgeFeed also carries the two audio alarms that live inside `Socket.js` (over-stall current > 366 A on any wheel; wheel temperature > 70 °C beep pattern), with the same constants. Socket.js could not be modified, so this is a copy, marked as such in both places' comments. The temperature check waits for the first `/temperature` message, as Socket waited for the first feedback packet.

### ArmIndicator (`frontArmActive`, `backArmActive`)

rosbridge: `robot.armControlMode?.front_arm_control === 1` and `…back_arm_control === 1`. mars-jetson's `network_communication/src/client.cpp` memcpys these exact `/arm_control_mode` fields into the legacy blob's int32 slots, and `Socket.js` tested `=== 1`, so the test is the same. `null` (nothing received yet) gives `false`, the legacy initial state.

### RightButtonPanel display props (`currentActionState`, `backArmActive`, `espWorking`)

- `currentActionState`: rosbridge passes `robot.robotState ?? 0`. The legacy int32 at blob offset 72 was `/robot_state`'s `state` (confirmed in `client.cpp`), so the 0..3 numbering (`TELEOP/DIG/DUMP/ESTOP`) is identical and the `== 1 / 2 / 3` highlight checks in the panel are unchanged. `null` (unknown, or disconnected, since `useRobotState` resets on disconnect) becomes `0`: no button highlighted.
- `backArmActive`: as ArmIndicator.
- `espWorking`: see the safety note below.

### App's own ESP banner

`ESP Not Receiving Packets` shows when the same `panelEspWorking` value is false.

### GamepadPanel and DirectionChangeButton (`gamepadData`)

`GamepadPanel` still polls the pad itself at 30 ms for display and macro recording and stores the legacy `{ leftStick, rightStick, buttons }` shape in App's `gamepadData`, which `GamepadDisplay` and `DirectionChangeButton` (D-pad-down toggles direction) consume unchanged. On the rosbridge path the poll goes through an adapter (`getGamepadState` prop, below) that reads the pad with `padToGamepadState` from the publisher hook and converts with `rosbridgeAdapters.toLegacyGamepadData`. Booleans become `0`/`1`, matching the Gamepad API `.value` numbers the legacy shape carried; `lt`/`rt` stay analog.

## Deliberate interface changes (two components)

Both components imported their networking functions directly from `packets.js` / `gamepad.js` / `robotState.js`, bypassing props. Since `packets.js` cannot be imported on the rosbridge path at all, the functions became props. `App.js` passes the legacy originals or the rosbridge adapters, so the component bodies are otherwise unchanged.

### GamepadPanel

New required props, same names and call signatures as the functions it imported:

| Prop | Legacy value (`legacyNetworking.legacyGamepad`) | rosbridge value (`App.rosGamepad`) |
|---|---|---|
| `getGamepadState(index, directionOverride)` | `gamepad/gamepad.js getGamepadState` | reads `navigator.getGamepads()[index]`, `padToGamepadState(pad, switched)`, `toLegacyGamepadData`. `directionOverride` honoured like gamepad.js (`null` → current switch state). Returns `null` when no pad at that index. |
| `setTransmissionActive(bool)` | `packets.js setTransmissionActive` | `useGamepadPublisher().setLiveEnabled(bool)`: the 30 ms tick stops publishing live frames but keeps reading the pad (status still updates) and a blurred/hidden window still publishes neutral. |
| `sendCustomGamepadState(frame)` | `packets.js sendCustomGamepadState` | `toRosGamepadState(frame)` → `useGamepadPublisher().publishCustomFrame` (same disconnect guard as live frames). |

So macro record / playback (`q` / `w` / `e`) works on both paths. As on the legacy path, recorded frames are captured with the direction switch forced off and replayed as recorded.

Removed imports: `getGamepadState` (gamepad.js), `setTransmissionActive`, `sendCustomGamepadState` (packets.js). The two effects that use the props now list them in their dependency arrays; all supplied values are referentially stable (module functions, or `useCallback`/`useMemo` with stable deps), so the effects don't re-run more than before.

### RightButtonPanel

New required props:

| Prop | Legacy value (`legacyNetworking.legacyCommands`) | rosbridge value (`App.rosCommands`) |
|---|---|---|
| `onDig()` | `sendCustomCommandState(1)` | `useDigDumpAction().sendGoal(DIGDUMP_INDEX.DIG)` (= 1) |
| `onDump()` | `sendCustomCommandState(2)` | `sendGoal(DIGDUMP_INDEX.DUMP)` (= 2) |
| `onStop()` | `sendCustomCommandState(3)` | `useRobotStateToggle().estop()` first, unconditionally, then `useDigDumpAction().cancelGoal()` |

Removed imports: `sendCustomCommandState` (packets.js) and the never-called `getActionState` / `setActionState` (robotState.js). The `actions_enum` (1/2/3) moved to `legacyNetworking.LEGACY_ACTION`.

The Dig/Dump-on-`espWorking` gate and the ungated Stop stay inside the component, as does the `d` / `f` / `Backspace` keyboard handling.

**Stop mapping, checked against the original.** In mars-jetson `network_communication/src/server.cpp`, `ActionTypes::EStop` (3) does two things: `cancel_goal()` if a digdump goal handle is active, then publishes `std_msgs/UInt8 {data: 3}` to `/robot_state/toggle`. It never sends a digdump goal. `onStop` on the rosbridge path sends the same two messages through the hooks, but in the opposite order: `estop()` is called first, unconditionally, and its result is what the "not sent" notice reports; `cancelGoal()` follows. Both are synchronous and return whether they sent, so the cancel can neither delay nor suppress the ESTOP. `cancelGoal()` is a no-op (returns `false`) when nothing is in flight. Why the order matters, and why neither order gives a held ESTOP on today's Jetson code, is in *Known safety gap* below.

Two things carried over from the legacy behaviour, not changed here, worth knowing:
- `estop()` is a toggle (see `rosbridge-hooks.md`): ESTOP sent while already in ESTOP releases to TELEOP. The legacy path published the same UInt8 3 and had the same property. The STOP button's lit state (`currentActionState == 3`) is the operator's indication.
- `RightButtonPanel`'s keyboard effect has an empty dependency array, so the `d` / `f` handlers close over the first render's `espWorking` (`false` on both paths). Keyboard Dig/Dump therefore never fires; the buttons work. Pre-existing; left as is because fixing it changes legacy behaviour.

When a rosbridge send is refused (the hooks return `false` while disconnected instead of queueing), App sets a notice shown in the status block: "STOP not sent: rosbridge disconnected" etc.

## Known safety gap: STOP does not hold ESTOP during an active digdump goal

Found 2026-09-23 by reading the Jetson nodes themselves (mars-jetson checkout at `~/UVA_Projects/mars-jetson`), not the earlier summaries of them. **The UI change described here is a mitigation, not a resolution. The resolution has to be made in mars-jetson.**

### Finding 1: robot_state_controller has no ESTOP latch

`robot_state_controller/robot_state_controller/robot_state_controller.py:46-55`:

```python
if self.state == ESTOP_MODE and msg.data == ESTOP_MODE:
    self.state = TELEOP_MODE
elif self.state != ESTOP_MODE and msg.data == ESTOP_MODE:
    self.state = ESTOP_MODE
else:
    self.state = msg.data
```

Any non-ESTOP toggle value, including one arriving **while in ESTOP**, becomes the new state. Entering ESTOP does nothing except select the `*/teleop` inputs on the two `topic_tools` muxes (`cmd_vel_mux`, `arm_drum_mux`, launched in `startup/launch/robot.launch.py:75-90`) and republish `/robot_state` (lines 65-68). It has no knowledge of the digdump action and never cancels a goal.

The robot does stop while ESTOP holds: the muxes drop the autonomy inputs, and `teleop.py` publishes a zero `Twist` and a zero arm/drum array on every `/robot_state` change (`__on_robot_state` → `__stopped_motors`, lines 178-180 and 259-261) and ignores gamepad input whenever the state is not TELEOP (lines 183-185).

### Finding 2: digdump never reads `/robot_state` and publishes TELEOP requests itself

`digdump/src/action_server.cpp`. The node subscribes to `arm_control_mode`, `position` and `cancel_command` only; the goal runs in a detached thread (`handle_accepted`, lines 312-322) that checks nothing but `goal_handle->is_canceling()` (lines 200, 213, 226, 243, 257). So an ESTOP toggle on its own leaves the goal running in the background, its commands silently dropped by the muxes.

The node also publishes to `/robot_state/toggle` (`state_publisher_`, line 20):
- `action_type` (1 or 2) when execution starts (line 171),
- **`0` (TELEOP) on cancel, twice**: immediately in `handle_cancel` (line 121), and again from the execute thread when it next sees `is_canceling()`, up to one 10 Hz loop iteration (~100 ms) later, in `cancel_current_goal` (line 306),
- **`0` on natural completion** (line 287), and on the `cancel_command` topic and the invalid-index path (lines 73, 278).

Combined with Finding 1, each of those `0`s **releases ESTOP to TELEOP** if it lands after the operator's `3`.

### Consequences for STOP

- **ESTOP alone, no cancel:** the goal keeps running blind and, when it finishes on its own seconds later (dig: lower + `dig_time` + raise; dump: `move_time` + `dump_time`, 5 s defaults each), publishes `0`. The robot leaves ESTOP into TELEOP with no operator action, while the UI is still streaming gamepad frames at 30 Hz. In the investigation's words, an uncancelled goal is *a delayed time bomb that releases ESTOP at an unpredictable moment*.
- **ESTOP plus cancel, either order:** the cancel makes digdump publish `0` twice, and at least one of them arrives after the `3`. The final state is TELEOP every time, but it is reached within ~100 ms, the goal is dead, and the UI shows it truthfully (STOP button unlit, status line `Robot state: TELEOP`, digdump `canceled`). Pressing STOP again then enters ESTOP and holds, because nothing is left running to release it.
- **The legacy design had the identical behaviour.** `network_communication/src/server.cpp:47-73` cancels the goal handle and then publishes `3`; the same two `0`s follow from digdump. No version of this UI has ever produced a held ESTOP during an autonomy run.

### What the UI change does and does not solve

`App.js` `rosCommands.stop` now calls `estop()` first, unconditionally, and reports its result; `cancelGoal()` follows. This guarantees the highest-priority message is the first thing on the wire and can never be delayed or dropped because of the cancel, and it removes the delayed-release time bomb by killing the goal. It gets the robot to a true, displayed TELEOP state within ~100 ms.

It **cannot** make STOP durably hold ESTOP during an active goal. That needs a latch that does not exist on the Jetson. A UI-side workaround (re-send `3` once the cancel settles) was considered and rejected: it would depend on the UI's lagging view of `/robot_state`, and because the toggle has no latch, a re-send that lands while the state is already ESTOP releases it.

### Side findings from the same source read (not addressed here)

- digdump's `stop_msg` (`action_server.hpp:85`) is never sized: `lower_msg`…`drive_msg` get `data.resize(4)` in the constructor (lines 50-54) but `stop_msg` does not. Every `publish_command(stop_msg)`, including the cancel path (line 305), publishes an **empty** `Float64MultiArray` to `arm_drum_control/autonomy`. Whether `robot_controller` treats an empty array as "stop" or ignores it was not checked.
- `network_communication/src/client.cpp:170-176` (ESP feedback timeout) has the same toggle hazard: it publishes `3` only when its own copy of the state is not already `3`. A rapid ESP disconnect/reconnect, or a stale local copy, can produce an unintended release through exactly the mechanism above, independently of anything in this UI.

### Required mars-jetson fix

One or both of:
1. `robot_state_controller`: ignore non-ESTOP toggle values while in ESTOP, so only an explicit ESTOP toggle releases it (and consider whether release should be a distinct message rather than a repeat of `3`).
2. `digdump`: subscribe to `/robot_state` and abort the running goal on ESTOP, and stop publishing `0` on cancel/completion (or have `robot_state_controller` refuse those while in ESTOP).

Until then, operators should treat STOP during autonomy as "goal cancelled, robot in TELEOP", and press STOP a second time if a held ESTOP is wanted.

## ESP-working gating (safety decision)

`useRobotState().espWorking` is `null` until a `/esp_working` message arrives, then `0` or `1`.

**Decision: `null` is treated as not online.** `App.js` computes `panelEspWorking = robot.espWorking === 1`, so with `null` or `0`:
- `RightButtonPanel` keeps Dig / Dump disabled (only Stop works),
- the "ESP Not Receiving Packets" banner is shown.

Only a received `1` enables autonomy. "Never heard from the ESP" must not read as "ESP fine".

Consequence to be aware of: per `rosbridge-hooks.md`, `/esp_working` has **no publisher** on mars-jetson today. On the legacy path this flag was computed locally by `network_communication` from its own 2 s ESP feedback timeout and never came from the topic. So on the rosbridge path, until something publishes `/esp_working`, Dig and Dump are permanently disabled and the banner is permanently up. That is the safe failure mode, and it is intentional, but it means the rosbridge path cannot run autonomy against the current Jetson graph. Follow-up for the Jetson side, not the UI.

## Where the direction switch lives now

Legacy: `App` writes `directionSwitched` into `gamepad/directionStore` (module global); `gamepad.js` reads it on every transmit and flips the sign of `leftStick.y` (`switched ? axes[1] : -axes[1]`). The robot is never told; only the left-stick sign and the camera highlight change.

rosbridge: **inside the publisher hook, applied at publish time.** `useGamepadPublisher(ros, { directionSwitched })` keeps the value in a ref that the 30 ms tick reads, and `padToGamepadState(pad, directionSwitched)` builds `left_stick.y` with the same rule. Same timing semantics as the module global (the flag is read on every frame, no timer restart), without a hidden global. The right stick is not affected, as before. `App` still calls `setDirection` for the legacy path only.

The display poll in `GamepadPanel` passes `directionOverride = false` on both paths, so the on-screen stick is never inverted, as before.

## ConnectionStatus

On the rosbridge path `App` renders a status block at the top of the left panel: `<ConnectionStatus status={rosStatus} />` from `useRos`, plus the gamepad publisher status (`none` / `unsupported-mapping` / `connected` / `suspended`), `robotStateName`, the digdump status and feedback string, and the last error or "not sent" notice. Styles are three small classes appended to `App.css`. Nothing of this renders on the legacy path.

## Other hook changes

- `useRos({ enabled = true } = {})`: new option, described above. Default behaviour unchanged.
- `useGamepadPublisher(ros, { directionSwitched = false } = {})`: new option; new returns `setLiveEnabled(bool)` and `publishCustomFrame(gamepadState) → boolean`; `neutralGamepadState` and `padToGamepadState(pad, directionSwitched)` are now named exports. Publishing behaviour with defaults is unchanged.
- `useTelemetry`, `useRobotState`, `useRobotStateToggle`, `useDigDumpAction`, `rosTypes`: untouched.

## Files

| File | Change |
|---|---|
| `react-app/.env` | `REACT_APP_USE_ROSBRIDGE=false` |
| `react-app/src/App.js` | hooks, flag gate, prop mapping, status block |
| `react-app/src/App.css` | three `.rosbridge-status*` classes |
| `react-app/src/legacyNetworking.js` | new: legacy adapter (the only importer of `packets.js` besides `gamepad.js`) |
| `react-app/src/rosbridgeAdapters.js` | new: legacy gamepad shape ↔ `GamepadState` |
| `react-app/src/Components/RosbridgeFeed.js` | new: chart window + alarms from `useTelemetry` |
| `react-app/src/gamepad/GamepadPanel.js` | functions → props |
| `react-app/src/Components/RightButtonPanel.js` | functions → props, dead imports dropped |
| `react-app/src/hooks/useRos.js` | `enabled` option |
| `react-app/src/hooks/useGamepadPublisher.js` | `directionSwitched` option, `setLiveEnabled`, `publishCustomFrame`, exports |

## Verification

### How it was run

WSL has no Linux `node`, and Windows `node` cannot run webpack against the `\\wsl.localhost` UNC path (`Module not found: Can't resolve '\\wsl.localhost\...\src\index.js'`), so both builds ran with `docker run node:22` inside WSL, as the hooks step did:

```
docker run --rm -v <react-app>:/app -w /app -e CI=false [-e REACT_APP_USE_ROSBRIDGE=true] \
  -e BUILD_PATH=/out/<mode> node:22 node node_modules/react-scripts/bin/react-scripts.js build
```

Each bundle was then served from `/tmp` with `python3 -m http.server` and loaded in Chrome. A throwaway TCP listener on `127.0.0.1:3001` and `:9090` logged every connection attempt so the two data paths could be told apart from the outside. All of that is torn down; nothing was left running and no `build/` directory was created in the repo.

### `REACT_APP_USE_ROSBRIDGE=false` (default, regression check)

- `react-scripts build`: **Compiled successfully**, no ESLint warnings printed.
- Page renders as before: gamepad panel, Arm Control, Control Panel with STOP / Dig Auto / Dump Auto, Switch Direction, timer, two camera frames, "ESP Not Receiving Packets" banner, value cards, charts. No rosbridge status block in the DOM (`.rosbridge-status` absent). No uncaught errors.
- Connection log while the page was open: four connections to **3001** (`packets.js` plus Socket.js's three sockets), **none to 9090**. So the flag-off bundle never touches rosbridge.
- The legacy bundle's content hash (`main.094d690b.js`) was identical across all three builds, including one made before and one after a `RosbridgeFeed.js` edit: the rosbridge-only components are dead-code-eliminated out of the flag-off bundle entirely.
- Without the gateway on 3001 the value cards read `NaN` and the banner is up, exactly as on `main` with no server.

### `REACT_APP_USE_ROSBRIDGE=true`

- `react-scripts build`: **Compiled successfully**, no warnings.
- Page renders without crashing; every panel present. Status block shows `ConnectionStatus` cycling **Connecting → Error** as `useRos` retries every 2 s against a port that refuses (screenshots checked at both states), `Gamepad publisher: none` (or `suspended` while the automation window lacked focus), `Robot state: unknown · digdump: idle`.
- Connection log while the page was open: one connection to **9090 every ~2 s**, **none to 3001**. `packets.js` is not executed on this path.
- STOP button (clicked through the DOM): `estop()` refused while disconnected and the status block showed **"STOP not sent: rosbridge disconnected"**; `cancelGoal()` was a no-op with nothing in flight (digdump status stayed `idle`). No exception. Re-run after the estop-first reorder (bundle `main.5610c6da.js`): same result from the button and from the `Backspace` key, Dig still gated off, no crash.
- Dig Auto button: nothing sent and no notice, because `espWorking` is `null` → gated off, as designed. Banner shown.
- Value cards show `NaN` before any telemetry, same as legacy.

### Not verified (say so, don't assume)

- **No live robot data.** mars-jetson's graph was not reachable in this session: both Jetson addresses from `start.sh` (`192.168.50.105`, `172.25.149.82`) refused TCP on 7447 (Zenoh) and 9090 (rosbridge), nothing listened on `localhost:9090`, and no mars-jetson or rosbridge container was running in either Docker engine. So real telemetry into `LiveDataPanel`, `/robot_state` into the button highlight, `/arm_control_mode` into ArmIndicator, and `/esp_working` were **not** seen end to end. The field-name mapping rests on `rosbridge-hooks.md`'s live check from the previous session plus the mars-jetson source read for this one.
- **No physical gamepad** was connected: `useGamepadPublisher`'s frame conversion with `directionSwitched`, the display adapter, and macro record/playback through `setLiveEnabled` / `publishCustomFrame` are unexercised beyond compiling.
- **No dig/dump cycle** and no real e-stop: the Stop mapping was checked against the Jetson source, not run.
- Console and network capture in the Chrome extension returned nothing for these localhost pages, hence the external TCP listener as the proof of which sockets each bundle opens.
- `npm start` (dev server) was not run; the production build was used for both checks. Same webpack config and ESLint plugin, so a clean build implies a clean `npm start`, but it is stated here rather than assumed.
