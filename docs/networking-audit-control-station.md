# Networking audit — mars-control-station (pre-rosbridge)

**Branch:** `develop`
**HEAD:** `e58a1427377f7dd057bda337ab6b73239f06f6a5` — "added dev containers that have built in networking with jetson dev container for local testing purposes." (Ethan Edwards, 2026-09-04)
**Audit date:** 2026-09-16
**Scope:** read-only inventory of the custom networking layer that is slated for replacement by rosbridge/roslibjs. No code was changed.

---

## 1. Where the networking layer lives

There is no context provider, no hook, and no service class. Networking is spread across **module-level side effects** and **`useEffect` blocks inside a headless component**. Nothing is dependency-injected; every consumer either imports a singleton module or opens its own socket.

### Topology

```
                        ┌──────────────────────────────────────────┐
  Jetson / ESP32        │  Node gateway (server/, all on one host)  │       Browser (react-app)
                        │                                          │
  ──UDP:2001──────────► │  udp_server.js  ──ws(byte 0)──┐          │
   feedback packets     │  (ServerSocket)               │          │
                        │                               ▼          │
                        │                         ws_server.js ◄────┼──ws(byte 1)── Socket.js  (telemetry in)
                        │                         :3001 router     │
  ◄──UDP:8080────────── │  client_udp.js  ◄──ws(byte 51 = "3")─────┼─────────────  packets.js (commands out)
   Jetson controller    │  (UDPClient)                             │
  ◄──UDP:2001────────── │                                          │
   ESP32 motor frame    │                                          │
                        │  signaling_server.js :6767 ──────────────┼──ws──────────  WebcamPanel #1 (WebRTC)
  ◄──WebRTC signaling── │  signaling_server.js :6969 ──────────────┼──ws──────────  WebcamPanel #2 (WebRTC)
                        └──────────────────────────────────────────┘
```

### Files

| File | Role |
|---|---|
| `server/ws_server.js` | Entry point. Owns the WS server on `:3001`, instantiates everything else. Routes by a one-byte "who am I" handshake. |
| `server/udp_server.js` | `ServerSocket` class. Binds UDP `0.0.0.0:2001`, strips a 10-byte header, forwards the payload into `:3001` as the `udpServer` client. |
| `server/client_udp.js` | `UDPClient` class. Serializes gamepad/action JSON into two different binary UDP frames (Jetson and ESP32). Holds mutable actuator state. |
| `server/signaling_server.js` | `SignalingServer` class. Dumb WebSocket broadcast relay for WebRTC SDP/ICE. Two instances, `:6767` and `:6969`. |
| `server/packets.js`, `server/robotState.js` | **Dead.** Stale copies of the React-side files. Never `require`d, and use ESM `import`/`export` in a CommonJS tree, so they would not even load. |
| `react-app/src/Components/Socket.js` | Headless React component (renders nothing). Opens **three** browser WebSockets to `:3001` and owns all inbound telemetry, the chart buffer, and the audio alarms. |
| `react-app/src/packets.js` | Module-level singleton WebSocket to `:3001` + a 30 ms `setInterval` transmit loop. All outbound commands. |
| `react-app/src/robotState.js` | Module-level mutable command state (`pause`, `action`) read by the transmit loop. |
| `react-app/src/gamepad/gamepad.js` | Reads the Gamepad API, applies the direction inversion, produces the payload the transmit loop sends. |
| `react-app/src/gamepad/directionStore.js` | Module-level `direction` flag, bridges React state into the non-React `gamepad.js`. |
| `react-app/src/Components/WebcamPanel.js` | Per-camera `RTCPeerConnection` + its own signaling WebSocket. Fully independent of `:3001`. |

### Wiring into the component tree

* `App.js:75` renders `<Socket …/>` with **nine** setter props (`setGamePadStatus`, `setRobotState`, `setFrontArmActive`, `setBackArmActive`, `setESPWorking`, `setChartData`, `setLastDataPoint`, `setTimestamp`, `setData`) plus a read-only `timestamp`. `Socket` returns nothing — it exists purely to hang `useEffect`s off the tree and push into `App`'s `useState`. All telemetry state therefore lives in `App` and is prop-drilled down.
* Outbound is the mirror image and does **not** go through the tree: `RightButtonPanel` and `GamepadPanel` `import` functions from `../packets` directly, and `packets.js` reaches sideways into `gamepad.js` and `robotState.js` at interval time.
* `WebcamPanel` is self-contained; `App.js:94-95` just passes it a `signalingPort` string.

---

## 2. Data the UI subscribes to (robot → UI)

Everything inbound arrives on **one** UDP stream (`:2001`) that is relayed to the `robotFeedback` WebSocket as a single opaque binary blob. There are no message types on the wire — the layout is positional and hardcoded on both ends.

### The feedback blob (`Socket.js:130-145`)

Payload after the gateway strips the 10-byte header:

| Offset | Type | Field | Consumer |
|---|---|---|---|
| 0 | f32 | `front_left_wheel_current` | wheel-current chart; over-stall alarm |
| 4 | f32 | `back_left_wheel_current` | wheel-current chart; over-stall alarm |
| 8 | f32 | `front_right_wheel_current` | wheel-current chart; over-stall alarm |
| 12 | f32 | `back_right_wheel_current` | wheel-current chart; over-stall alarm |
| 16 | f32 | `front_drum_current` | drum-current chart |
| 20 | f32 | `back_drum_current` | drum-current chart |
| 24 | f32 | `front_actuator_current` | buffered, **not rendered** |
| 28 | f32 | `back_actuator_current` | buffered, **not rendered** |
| 32 | f32 | `main_battery_voltage` | `LiveDataPanel` battery card + % lookup table |
| 36 | f32 | `aux_battery_voltage` | `LiveDataPanel` battery card + % lookup table |
| 40 | f32 | `front_left_wheel_temperature` | temp card; 70 °C beep |
| 44 | f32 | `back_left_wheel_temperature` | temp card; 70 °C beep |
| 48 | f32 | `front_right_wheel_temperature` | temp card; 70 °C beep |
| 52 | f32 | `back_right_wheel_temperature` | temp card; 70 °C beep |
| 56 | f32 | `front_drum_temperature` | temp card |
| 60 | f32 | `back_drum_temperature` | temp card |
| 64 | f32 | `front_actuator_position` | actuator card (raw + inches) |
| 68 | f32 | `back_actuator_position` | actuator card (raw + inches) |
| 72 | i32 | robot / action state | `App.robotState` → `RightButtonPanel` button highlight (1 = dig, 2 = dump, 3 = stop) |
| 76 | i32 | front arm active | `App.frontArmActive` → `ArmIndicator` ("Blue") |
| 80 | i32 | back arm active | `App.backArmActive` → `ArmIndicator` ("Orange"), `RightButtonPanel` dump-button color |
| 84 | i32 | ESP alive | `App.ESPWorking` → `App.js:96` "ESP Not Receiving Packets" banner; **gates dig/dump commands** in `RightButtonPanel:30` |

Minimum payload length implied: **88 bytes**. Note `send_udp.py` declares `FEEDBACK_PACKET_LENGTH = 84`, which is one `int32` short — the ESP-alive read would throw `RangeError` against that fixture.

### Declared but never delivered

| Stream | Registration | Intended consumer | Status |
|---|---|---|---|
| Video (2 cameras) | WebRTC over `:6767` / `:6969` | `WebcamPanel` `<video>` | **Working**, separate path |
| Global data rate | `Socket.js:154-173`, sends byte `5` | `chartData.globalDataRate`, "Mbps" chart | **Dead** — byte 5 is unhandled by `ws_server.js`, so nothing is ever routed here. `lastDataRate` stays `0`. Chart is commented out anyway. |
| Gyroscope x/y/z | `Socket.js:177-195`, sends byte `6` | `chartData.xGyro/yGyro/zGyro`, `TiltMeter` | **Dead** — byte 6 is unhandled. Values stay `0`. `TiltingRods`/`TiltMeter` are commented out in `App.js:101`. |
| Logs / diagnostics | — | — | None exist. |
| Heartbeat | — | — | None, other than the ESP-alive `int32` inside the feedback blob. |

---

## 3. Data the UI publishes (UI → robot)

One outbound socket (`react-app/src/packets.js`), JSON, two envelope types.

### `type: 'uiState'` — teleop, 30 ms fixed rate

Built in `packets.js:51-65`:

```js
{ type: 'uiState',
  gamepad:  { leftStick:{x,y}, rightStick:{x,y}, buttons:{x,y,a,b,lt,rt,lb,rb,dd,du,dl,dr,l3,r3,back,start} },  // pad 0
  gamepad2: { ...same shape... },                                                                                // pad 1, or null
  commands: { pause: <bool>, action: <int 0-3> } }                                                               // built but IGNORED by the gateway
```

* **Trigger:** unconditional `setInterval(…, 30)` that starts the moment `packets.js` is first imported. Suppressed only while `isTransmissionActive === false`.
* **Gateway fan-out (`ws_server.js:66-76`):** if `gamepad2` is present → send to **both** Jetson and ESP32; else if `gamepad` is present → Jetson only. `commands` is never read server-side — the pause/action state in `robotState.js` is effectively write-only.
* Pad 0 drives the Jetson (`send_controller_jetson`), pad 1 drives the ESP32 (`send_esp`).

### `type: 'action'` — autonomous commands, event-driven

`packets.js:37-46` → `ws_server.js:77-80` → `send_autonomous_action_jetson`.

| Action | `actionType` | Triggers |
|---|---|---|
| Dig Auto | `1` | `RightButtonPanel` "Dig Auto" button, or key `d`. **Gated on `espWorking`.** |
| Dump Auto | `2` | `RightButtonPanel` "Dump Auto" button, or key `f`. **Gated on `espWorking`.** |
| Stop | `3` | `RightButtonPanel` "STOP" button, or `Backspace`. **Not gated** — always sent. |

This is the closest thing to an e-stop. Note it is a fire-and-forget UDP datagram with no ack, no retry, and no local latch — the STOP button's lit state comes back only via the feedback blob's `int32` at offset 72.

### `sendCustomGamepadState(frame)` — macro playback

`GamepadPanel` records `getGamepadState()` snapshots at 30 ms into an in-memory array, then replays them at 30 ms while `setTransmissionActive(false)` suppresses the live loop. Same `uiState` envelope, `gamepad2` omitted (so ESP32 gets nothing during playback). Keys `q` record, `w` play, `e` reset.

### UI-only state, never transmitted

* **Direction switch** (`DirectionChangeButton`, or gamepad D-pad-down) → `directionStore` → only inverts `leftStick.y` sign in `gamepad.js:44` and swaps which camera is highlighted. The robot is never told.
* **Pause** (`robotState.flipPausedState`) — imported by `WebcamPanel` but never called; the `commands.pause` field it feeds is dropped by the gateway.
* Timer, theme.

---

## 4. Protocol details

### Transport

| Leg | Transport | Port | Serialization |
|---|---|---|---|
| Browser ↔ gateway | **Native `WebSocket`** (no socket.io, no SSE, no REST/polling) | `3001` | Outbound: JSON text. Inbound: raw `ArrayBuffer`, positional binary. |
| Gateway ← robot | UDP (`dgram`) | bind `0.0.0.0:2001` | 10-byte LE header + opaque payload |
| Gateway → Jetson | UDP | `$JETSON_IP:8080` | 10-byte LE header + fixed struct |
| Gateway → ESP32 | UDP | `$ESP_IP:2001` | 9-byte frame, no shared header |
| Browser ↔ gateway (video) | Native `WebSocket` + `RTCPeerConnection` | `6767`, `6969` | JSON `{sdp}` / `{ice}` / `{cmd}` |

`ws://localhost:<port>` is **hardcoded** in all four browser call sites (`packets.js:5`, `Socket.js:122/155/178`, `WebcamPanel.js:76`). There is no env var, no config file, no runtime override. `JETSON_IP` / `ESP_IP` are env vars read only by the Node gateway (`ws_server.js:14-15`), set by `start.sh` or the devcontainer (`JETSON_IP=mars-jetson`).

### Handshake

Each `:3001` client identifies itself with a **first message whose first byte** is a role tag. `ws_server.js:37` does `message.readUInt8()`:

| Byte | Role | Sent by |
|---|---|---|
| `0` | `udpServer` (telemetry source) | `udp_server.js:22` — `Buffer.from([0])` |
| `1` | `robotFeedback` (telemetry sink) | `Socket.js:125-128` — `Int32` LE `1`, so byte 0 is `1` |
| `2` | removed | — |
| `51` | `gamepad` (command source) | `packets.js:7` — `ws.send(3)` |

`ws.send(3)` is a **number**, which the browser coerces to the string `"3"`, whose first byte is ASCII `0x33` = **51**. The `case 51` in the router exists only to accommodate that accident. Anything that later sends a real numeric `3` will not register.

Bytes `5` (data rate) and `6` (gyro) fall through to `default: break` — those two sockets connect, are never stored, and never receive anything. `server/packets.js` sends `-1` → `"-1"` → byte `45` → likewise unhandled.

**There is no authentication of any kind** on any port.

### Routing

`ws_server.js` keeps a single-slot registry `{udpServer, robotFeedback, gamepad}`. A second client claiming a role silently overwrites the first, and the slots are never cleared on `close` (`ws_server.js:87-89` only logs). Telemetry fan-out is `websockets.robotFeedback.send(message)` — exactly one browser tab receives telemetry; open a second tab and the first goes dark.

### Reconnection

**None, anywhere.** No `onclose` reconnect, no backoff, no retry, no heartbeat/ping, on any of the six browser sockets or the gateway's internal socket. If the gateway restarts, or the page loads before the gateway is up, every socket is permanently dead until a manual page refresh. `udp_server.js`'s own `ws` to `:3001` has the same problem, plus a race — it connects at construction time, in the same process and tick as the server it is connecting to.

### Connection-status UI

There is no WebSocket connection indicator. The only connectivity signals a driver sees are:

* `gamepadStatus` — Gamepad API only, says nothing about the network.
* "ESP Not Receiving Packets" banner (`App.js:96`) — driven by an `int32` inside the telemetry blob, so it is itself a lie when the WebSocket is down (`ESPWorking` just stays at its last value, or `false` from initial state).

### Error handling

* `packets.js` — `onclose` logs a string. No `onerror`. Sends are guarded only by `readyState !== OPEN`, so a drop silently discards commands with no user-visible effect.
* `Socket.js` — no `onerror`, no `onclose` on any of the three sockets. `onmessage` does unguarded `DataView`/`Float32Array` reads; a short packet throws `RangeError` inside the handler.
* `ws_server.js` — JSON parse is wrapped in try/catch; `data` is assigned without `let`/`const` (implicit global). If `gamepad2` is present but `gamepad` is `null`, `send_controller_jetson` dereferences `jsonObj.gamepad.buttons` and throws.
* `client_udp.js` / `udp_server.js` — `socket.on('error')` logs; `udp_server` closes the socket on error and never reopens.
* `WebcamPanel` — the most defensive code in the repo: try/catch on SDP and ICE, an ICE candidate queue for the pre-remote-description window. Still no reconnect.

---

## 5. Responsibilities beyond raw pass-through

The gateway and `Socket.js` are doing a lot of work that has nothing to do with transport. All of it has to land somewhere after the migration.

**Rate control**
* Outbound teleop is rebuilt and sent on a fixed 30 ms timer (~33 Hz) regardless of whether anything changed — no change detection, no coalescing.
* Inbound telemetry is decoupled from arrival: `Socket.js` writes each packet into `motorValuesRef`/`gyroValuesRef` (a 1-deep buffer, dropping everything in between) and a **separate** 200 ms interval samples those refs into `chartData`. Packets arriving faster than 5 Hz are silently discarded; if packets stop, the same stale sample is appended forever.

**Buffering / replay**
* `chartData` is a rolling window capped at `60000 / 200 = 300` points (60 s).
* `GamepadPanel` record/playback is a full macro recorder — unbounded in-memory array of gamepad snapshots, replayed at 30 ms with the live loop muted.

**Unit conversion / derived values** (all client-side)
* `actuatorToDrum()` (`LiveDataPanel.js:13`) — trig linkage solution, raw actuator position → drum height in inches.
* Battery voltage → percentage via 21-point piecewise-linear lookup tables, separate for main (16.8 V–13.09 V) and aux (12.6 V–9.82 V).
* Threshold→color mapping for temperature (60/80 °C) and voltage (30 %/15 % of the table).
* `GROUNDLEVEL = 0.69` actuator threshold.

**Unit conversion / mixing** (server-side, in `client_udp.js:97-184`)
* Arcade-drive mix for the ESP32: 0.05 deadband, `linear*0.6 ± turn*0.4`, clamp to ±1, then `round((v+1)*127)` to uint8.
* Left-stick X inversion.
* **Stateful** bucket-ladder position: an integer that the gateway increments/decrements by 8 on bumper *edges* and resets to 127 on `Y`, clamped 0–255. This is real robot state living in a Node process with no persistence and no feedback loop.
* Conveyor: `127 * (1 + rt - lt)`.
* Track actuators: ternary on D-pad up/down → 0 / 127 / 254.

**Field renaming**
* Gamepad button indices → names (`buttons[2]` → `x`, `buttons[6]` → `lt`, …) in `gamepad.js`.
* Positional float offsets → the long snake_case names in `Socket.js:204-229`. Note the labels disagree with the data: array indices 0–3 are named `front_*`/`back_*` in the data object but rendered as `BL/BR/OL/OR` in `LiveDataPanel`.
* Stick Y sign flip, conditional on the direction-switch flag.

**Alarms (side effects driven by telemetry)**
* Over-stall current alarm — continuous 1000 Hz `AudioContext` sine while any wheel current > 366 A.
* Wheel over-temp — 880 Hz beep every 400 ms for 5 s, on the rising edge of max wheel temp > 70 °C.

**Header framing**
* Inbound: `udp_server.js` parses `{reserved, packetType, packetLength, numPackets, batchPacketCount, crc}` and then **discards all of it**, including `packetType` — so the routing information in the packet is thrown away before the browser can use it.
* Outbound: `client_udp.js` writes the same 10-byte header with `crc` hardcoded to `0`. A `crc32bit()` function is defined at the top of the file and never called. `send_autonomous_action_jetson` declares `packetLength = 40` while actually sending 1 byte of payload.

---

## 6. Comparison notes

Sources: `MARS-UVA/training-robot-template-2627` @ `boilerplate`, `control-station/` (the `training-robot-2627` URL in the brief 404s; this is the org repo that matches, and it is a teaching template with deliberate `TODO` gaps), plus `RobotWebTools/roslibjs` `develop` sources for `Ros.ts` / `Topic.ts`.

**Stack.** Vite + React 19 + TypeScript, single dependency `roslib ^2.1.0`. No Node gateway process at all — `src/ros_bridge_server.launch.py` just includes `rosbridge_server`'s `rosbridge_websocket_launch.xml`. The browser talks straight to rosbridge on `ws://localhost:9090`.

**Where the connection is instantiated.** One hook, `hooks/useRos.ts`:

```ts
const [ros] = useState(() => new Ros({ url }))          // lazy init, one instance for the app's life
useEffect(() => {
  ros.on('connection', () => setStatus('connected'))
  ros.on('error', (e) => { setStatus('error'); console.error(e) })
  ros.on('close',  () => setStatus('closed'))
  return () => { ros.close() }
}, [ros])
return { ros, status }
```

`App.tsx` calls `useRos()` once and passes the `ros` handle down to the other hooks as a plain argument. No context provider — the handle is a prop. This is the same "one owner, pass it down" shape we already have, except the thing being passed is a live connection object instead of nine `setState` functions.

**Subscribe.** `hooks/useSensorData.ts` — one `new Topic({ros, name:'/heading', messageType:'std_msgs/msg/Float64'})` per stream, `.subscribe(msg => setState(...))` inside a `useEffect` keyed on `ros`, `.unsubscribe()` in cleanup. Each named topic is its own object with its own typed message shape. Directly replaces our single opaque blob + byte-offset table: each of the ~22 fields becomes either a named topic or a field of a named message type, and the offsets go away entirely.

**Publish.** `hooks/useGamepadPublisher.ts` — a `Topic` held in a `useRef`, `.publish({left_stick:{x,y}})` on a 100 ms interval (vs. our 30 ms) plus immediately on keyboard events. Custom message type `teleop_msgs/msg/GamepadState`. Same fixed-interval-poll pattern as `packets.js`, but the serialization (`DataView` byte-stuffing in `client_udp.js`) is replaced by a message-type declaration.

**Commands.** This is the largest shape difference. Dig/dump/stop is not a topic — it is a **ROS action** (`hooks/useAutonomousAction.ts`, `autonomy_interfaces/action/AutonomousActions`), with `sendGoal(index, onResult, onFeedback, onError)` returning a goal id, plus `cancelGoal()` and a real status machine (`idle | pending | active | succeeded | aborted | canceled`). Our fire-and-forget `actionType` UDP byte with echoed-state-in-telemetry feedback maps onto this cleanly and gets acks, feedback, and cancel for free. `cancelGoal` is the natural home for the STOP button.

**Connection status.** `components/ConnectionStatus.tsx` renders the `status` string from `useRos` as a labeled card. We have no equivalent — this is a gap worth closing regardless of the migration.

**roslibjs facts relevant to what our gateway does by hand:**
* `Topic` takes `throttle_rate` (ms between messages, enforced bridge-side), `queue_length` (bridge-side subscribe queue), `queue_size` (bridge-side republish queue), `latch`, and `compression` (`none` | `png` | `cbor` | `cbor-raw`). `throttle_rate` + `queue_length` replace the hand-rolled ref-buffer + 200 ms sampler in `Socket.js`.
* `Topic` defaults `reconnect_on_close = true` — resubscribe and readvertise happen automatically on reconnect. That is the single biggest gap this migration closes; we currently have zero reconnection anywhere.
* `Ros` emits `connection` / `close` / `error`, and exposes `isConnected`. One transport, multiplexed by topic name — the byte-tag handshake and the single-slot `{udpServer, robotFeedback, gamepad}` registry both disappear, and with them the "only one browser tab gets telemetry" limitation.
* Video is the one thing rosbridge does not cover. The `:6767`/`:6969` WebRTC signaling path has no counterpart in the reference repo (it has no cameras) and will need to survive the migration as-is or move to `web_video_server`.

**Things in our stack with no reference counterpart, which need decisions:**
1. The stateful arcade-drive mixing and bucket-ladder accumulator in `client_udp.js` — currently in the Node gateway. Must move to a ROS node on the robot, not to the browser.
2. Macro record/playback (`GamepadPanel`) — a topic publisher can replay just as easily, but `setTransmissionActive` has no equivalent; needs an explicit mute in the publisher hook.
3. The audio alarms and unit conversions in `Socket.js` / `LiveDataPanel.js` — pure client-side logic, portable as-is once the data source is a topic callback.
4. The direction-switch flag is currently UI-local and leaks into `gamepad.js` through a module global (`directionStore`). Under roslibjs it should be either a published topic or a parameter, not a hidden global.
