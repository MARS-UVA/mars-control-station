# ROS 2 environment setup — mars-control-station

Goal of this step: make this host able to see the robot's ROS graph directly,
using the same middleware the Jetson uses. Additive/environment work only — no
React or Node source was touched.

**Date:** 2026-09-16
**Repo state:** `develop` @ `e58a1427377f7dd057bda337ab6b73239f06f6a5`

> **Status: incomplete.** `rmw_zenoh_cpp` is not installed on this host yet (it
> needs `sudo`, which was deferred). Everything up to and including the message
> build is done and verified. The Zenoh install and the Zenoh-based
> verification are still outstanding — see
> [What is still outstanding](#what-is-still-outstanding).

---

## 1. Where things live

This repo is checked out on the **Windows** side and is reachable from WSL only
through the DrvFS mount:

```
/mnt/c/Users/aswin/Desktop/UVA/MARS/Computer/Competition_UI_Project/mars-control-station
```

ROS 2, colcon and `rmw_zenoh_cpp` do not run on Windows, so all of the ROS work
happens in the WSL Ubuntu instance, operating on that same checkout. There is
no second clone.

`mars-jetson` is already checked out natively in the same WSL instance at
`/home/yogeshwar/UVA_Projects/mars-jetson`.

| Thing | Path | In git? |
| --- | --- | --- |
| This repo | `/mnt/c/.../mars-control-station` | yes |
| Jetson checkout | `~/UVA_Projects/mars-jetson` | separate repo |
| Message workspace | `~/UVA_Projects/mars-control-station-ros_ws` | **no** (outside the repo) |
| Bench-test workspace | `~/UVA_Projects/mars-bench-ws` | **no** (throwaway, test only) |

---

## 2. How the message packages are vendored

Four packages from `mars-jetson` are needed here. All four are `ament_cmake`
IDL-only with no hardware dependencies, so they build standalone:

| Package | Provides |
| --- | --- |
| `serial_msgs` | `CurrentBusVoltage`, `Temperature`, `Position`, `MotorCommands` |
| `teleop_msgs` | `HumanInputState`, `GamepadState`, `StickPosition` |
| `robot_control_msgs` | `RobotState`, `ArmControlMode`, `ArmDrumControl` |
| `autonomy_msgs` | `AutonomousActions` (the `digdump` action type) |

`serial_msgs` depends on `teleop_msgs`; colcon resolves that ordering itself.

### Decision: symlink from the existing local checkout, via a tracked script

**There was no existing convention to follow.** Before choosing, I checked the
repo for one — there is no `vendor/` directory, no `.repos` file, no
`.rosinstall`, and no `.gitmodules`. The only pre-existing hint is that
`.gitignore` already lists `install/`, `build/` and `log/` at the repo root,
i.e. a colcon workspace at the root was anticipated at some point.

What this step does instead: **`ros/setup-ros-ws.sh`** (tracked) creates a
workspace outside the repo and symlinks the four packages out of an existing
`mars-jetson` checkout.

```bash
./ros/setup-ros-ws.sh
```

It reads three overridable variables:

| Variable | Default |
| --- | --- |
| `MARS_JETSON_SRC` | `$HOME/UVA_Projects/mars-jetson` |
| `MARS_ROS_WS` | `$HOME/UVA_Projects/mars-control-station-ros_ws` |
| `MARS_ROS_DISTRO` | `jazzy` |

Why this and not the alternatives:

- **Why not a git submodule?** `mars-jetson` is already on this disk. A
  submodule would clone the entire Jetson repo (hardware nodes, Catch2, docker
  assets) a second time over the network and require SSH access to
  `git@github.com:MARS-UVA/mars-jetson.git` just to obtain four directories of
  `.msg` files.
- **Why not commit copies of the `.msg` files?** They would silently drift from
  the Jetson's definitions, and a mismatched IDL is exactly the failure mode
  that is hardest to debug at competition — topics appear, types look right,
  payloads decode to garbage.
- **Why not commit the symlinks?** They point at `/home/yogeshwar/...`, which is
  meaningless on anyone else's machine, and Git-for-Windows handles symlinks
  inconsistently. The symlinks are generated, never tracked.

The tracked artifact is therefore the *script*, not the vendored code. A
teammate with a `mars-jetson` checkout runs one command; a teammate without one
gets told to clone it.

---

## 3. Where the workspace lives, and why it is outside the repo

**Decision: alongside the repo, at `~/UVA_Projects/mars-control-station-ros_ws`
on native ext4 — not inside the repo tree.**

Three reasons, in order of weight:

1. **Build artifacts must not be committed.** `.gitignore` covers
   `build/install/log` at the root, but a workspace outside the repo cannot be
   committed by accident at all. This is the stronger guarantee.
2. **`src/` would have to contain machine-specific symlinks.** Inside the repo
   those are either tracked (broken for everyone else) or ignored (in which case
   the directory is pure noise in `git status`).
3. **DrvFS is measurably slower.** Measured on this machine, building
   `teleop_msgs`:

   | Location | Time |
   | --- | --- |
   | native ext4 (`~`) | 1 min 2 s — *while 3 other packages built in parallel* |
   | DrvFS (`/mnt/c`) | 1 min 24 s — *building alone, no contention* |

   The comparison is deliberately biased in DrvFS's favour (the native number
   includes CPU contention from three concurrent builds; the DrvFS number does
   not) and DrvFS still lost by ~35%. A fair head-to-head gap is wider. This
   alone would not be decisive, but combined with (1) and (2) it settles it.

Full four-package clean build on native ext4: **1 min 49 s**. Incremental
re-run: **6.8 s**.

---

## 4. Build

Run from a WSL shell. `ros/setup-ros-ws.sh` does all of this; the individual
commands are recorded here for reference.

```bash
source /opt/ros/jazzy/setup.bash          # needed first, or rosdep cannot
                                          # resolve keys (no ROS_DISTRO)
cd ~/UVA_Projects/mars-control-station-ros_ws
rosdep install --from-paths src --ignore-src -y
colcon build --symlink-install \
    --packages-select serial_msgs teleop_msgs robot_control_msgs autonomy_msgs
source install/setup.bash
```

`rosdep` reported `#All required rosdeps installed successfully` with nothing to
install — the four packages need only `rosidl_default_generators` /
`rosidl_default_runtime`, already present with ROS 2 Jazzy. **No `sudo` was
needed for the build.**

Build result:

```
Starting >>> teleop_msgs
Starting >>> autonomy_msgs
Starting >>> robot_control_msgs
Finished <<< autonomy_msgs [52.3s]
Finished <<< robot_control_msgs [53.8s]
Finished <<< teleop_msgs [1min 2s]
Starting >>> serial_msgs
Finished <<< serial_msgs [36.5s]

Summary: 4 packages finished [1min 39s]
```

All seven interface types the UI cares about resolve:

```
serial_msgs/msg/CurrentBusVoltage             OK
serial_msgs/msg/Temperature                   OK
serial_msgs/msg/Position                      OK
robot_control_msgs/msg/RobotState             OK
robot_control_msgs/msg/ArmControlMode         OK
teleop_msgs/msg/HumanInputState               OK
autonomy_msgs/action/AutonomousActions        OK
```

Note `autonomy_msgs/action/AutonomousActions` **is** the `digdump` action type —
`digdump/src/action_server.cpp:5-6` creates the server as
`create_server<DigDump>(..., "digdump")` where `DigDump` aliases that action. So
the four message packages cover the action as well; no fifth package is needed.

---

## 5. Host environment config

The repo's existing host env config is **`start.sh`** — it is what exports
`JETSON_IP` and `ESP_IP` (the Node gateway at `server/ws_server.js:14-15` reads
them). So that is where the ROS env hooks in.

Added **`ros/ros-env.sh`** (tracked, sourced not executed):

```bash
source ros/ros-env.sh
```

It sources ROS 2 Jazzy, sources the message workspace, and exports:

```bash
export RMW_IMPLEMENTATION=rmw_zenoh_cpp
```

`start.sh` now sources it, guarded, after `JETSON_IP` is resolved and before the
UI starts:

```bash
if [ -f "$(dirname "$0")/ros/ros-env.sh" ]; then
    source "$(dirname "$0")/ros/ros-env.sh"
fi
```

`ros/ros-env.sh` returns early when `/opt/ros/jazzy/setup.bash` is absent, so
this is a **no-op** for teammates who only run the React/Node UI and for the
`.devcontainer` image (which is `node:22-bookworm` with no ROS at all). That was
the reason for the guard: `start.sh` must not start failing for UI-only users.

### Deliberately not set

| Variable | Why not |
| --- | --- |
| `ROS_DOMAIN_ID` | The Jetson's `deploy.sh` does not set it. Both hosts stay on default domain 0; setting it on one side only would partition the graph. |
| `ROS_AUTOMATIC_DISCOVERY_RANGE` | `LOCALHOST` is a devcontainer-only isolation setting. It would block exactly the cross-host discovery this setup exists for. |

---

## 6. Zenoh topology

**Decision: this host does _not_ run its own `rmw_zenohd`. It attaches to the
router the Jetson already starts.**

The Jetson starts the router itself in `setup_terminal.sh`:

```bash
ros2 run rmw_zenoh_cpp rmw_zenohd
```

Reasoning:

- **One router, not two.** `rmw_zenoh_cpp`'s normal deployment is one router
  per LAN with everything else attached as a session peer. Two routers means
  configuring them to peer with each other — more moving parts to get wrong on
  competition day, for no gain.
- **The robot is the fixed point.** The Jetson has a stable address that
  `start.sh` already knows (`JETSON_IP`). The control station is the thing that
  moves between networks, so it should be the side that dials out.
- **The Jetson's graph must survive the UI restarting.** If the control station
  owned the router, restarting the UI would drop the router out from under the
  robot's nodes. With the router on the Jetson, the UI can come and go freely.

`ros/ros-env.sh` therefore points this host at the Jetson's router whenever
`JETSON_IP` is set:

```bash
export ZENOH_CONFIG_OVERRIDE="connect/endpoints=[\"tcp/${JETSON_IP}:7447\"]"
```

7447 is `rmw_zenohd`'s default TCP listen port.

> This topology is a **design decision, not yet a verified one** — see below.

---

## 7. Verification

### Case 5b applies — the physical Jetson is not reachable

Checked, not assumed:

```
$ ip -4 addr show                 # WSL
inet 172.28.81.32/20  eth0        # WSL2 NAT network

$ getent hosts mars-jetson
(no DNS entry)

$ ping -c1 -W2 192.168.50.105     # Jetson on the MARS network
unreachable
$ ping -c1 -W2 172.25.149.82      # Jetson on eduroam
unreachable
```

From the Windows host, for completeness:

```
IPAddress        InterfaceAlias
10.0.0.134       Wi-Fi
172.28.80.1      vEthernet (WSL)

192.168.50.105 : False
172.25.149.82  : False
```

The Windows host is on **`10.0.0.134`** — a different network from both
addresses `start.sh` knows for the Jetson (`192.168.50.105` on `Team_39`,
`172.25.149.82` on eduroam). The Jetson is simply not on this network. So
**case 5b applies: no cross-host test was possible.**

### ⚠️ What a same-machine test does and does not prove

> A bench test in this one WSL instance proves **only** that the message types
> and topic names are wired correctly. It does **not** validate cross-host
> Zenoh routing. Cross-host discovery must still be checked against the real
> Jetson before trusting any of this at competition.

### ⚠️ Second, independent blocker for when the Jetson _is_ back

WSL2 here runs in **default NAT mode** — `/mnt/c/Users/aswin/.wslconfig`
contains only:

```ini
[wsl2]
memory=6GB
processors=4
```

with no `networkingMode=mirrored`. WSL2 sits behind a NAT'd
`vEthernet (WSL)` adapter on `172.28.80.0/20`, so even once the Windows host
joins the MARS network, the WSL instance will not be directly addressable by
the Jetson. Outbound TCP to the Jetson's router on 7447 should work, which may
be enough given the dial-out topology in §6 — but this is untested and is the
first thing to check when hardware is available. If it does not work, the
options are `networkingMode=mirrored` in `.wslconfig`, a `netsh portproxy` on
the Windows side, or running the control station natively on Linux.

**This has not been validated either way.**

### What the bench test actually ran

Two further constraints shaped this, both consequences of `sudo` being
unavailable in this session:

1. **`rmw_zenoh_cpp` is not installed**, so the bench test ran on the **default
   middleware, `rmw_fastrtps_cpp`** — not Zenoh.
2. **`network_communication` could not be built.** It needs
   `ros-jazzy-control-msgs`, which is not installed on this host
   (`rosdep` wants `sudo -H apt-get install -y ros-jazzy-control-msgs`).

So the bench graph is `digdump`'s action server — which is real Jetson code, and
which provides the `digdump` action, subscribes to `position` and
`arm_control_mode`, and publishes `robot_state/toggle` — plus `ros2 topic pub`
publishers standing in for the hardware nodes (`serial_node`,
`robot_state_controller`) using the real message types.

The `digdump` server built against these four packages with no rosdep
dependencies at all:

```
Starting >>> digdump
Finished <<< digdump [1min 20s]
Summary: 1 package finished [1min 21s]
```

#### `ros2 topic list -t`

```
/arm_control_mode [robot_control_msgs/msg/ArmControlMode]
/arm_drum_control/autonomy [std_msgs/msg/Float64MultiArray]
/cancel_command [std_msgs/msg/UInt8]
/cmd_vel/autonomy [geometry_msgs/msg/Twist]
/current_bus_voltage [serial_msgs/msg/CurrentBusVoltage]
/human_input_state [teleop_msgs/msg/HumanInputState]
/parameter_events [rcl_interfaces/msg/ParameterEvent]
/position [serial_msgs/msg/Position]
/robot_state [robot_control_msgs/msg/RobotState]
/robot_state/toggle [std_msgs/msg/UInt8]
/rosout [rcl_interfaces/msg/Log]
/temperature [serial_msgs/msg/Temperature]
```

All seven required topics present:

```
  current_bus_voltage    PRESENT
  temperature            PRESENT
  position               PRESENT
  robot_state            PRESENT
  arm_control_mode       PRESENT
  human_input_state      PRESENT
  robot_state/toggle     PRESENT
```

#### `ros2 topic info` — types resolve, no "unknown type"

```
$ ros2 topic info -v /current_bus_voltage
Type: serial_msgs/msg/CurrentBusVoltage
Publisher count: 1
Topic type: serial_msgs/msg/CurrentBusVoltage
Topic type hash: RIHS01_3d80f34c72f3e06c0b765778501de3359fc746082287824ae7e43046b94d86c3
Endpoint type: PUBLISHER
QoS profile:
  Reliability: RELIABLE
  Durability: VOLATILE

$ ros2 topic info -v /robot_state
Type: robot_control_msgs/msg/RobotState
Publisher count: 1
Topic type hash: RIHS01_a56dd6db69526c50fc06590338afbe1f14c5d1e296c911ed219e215d8882e21f

$ ros2 topic info /human_input_state
Type: teleop_msgs/msg/HumanInputState
Publisher count: 1
Subscription count: 0
```

Concrete `RIHS01_...` type hashes rather than `unknown type` is the thing worth
noting — it means the locally built IDL is what the graph is actually using.

#### `ros2 action list -t` — `digdump` visible

```
/digdump [autonomy_msgs/action/AutonomousActions]
```

#### `ros2 node list`

```
/action_server
```

### Verification summary

| Claim | Status |
| --- | --- |
| Four message packages build standalone on this host | ✅ verified |
| All seven topic names appear on the graph | ✅ verified |
| All message/action types resolve (no `unknown type`) | ✅ verified |
| `digdump` action visible with the right type | ✅ verified |
| Real Jetson code (`digdump`) links against these packages | ✅ verified |
| `RMW_IMPLEMENTATION=rmw_zenoh_cpp` actually works | ❌ **not tested** — not installed |
| Zenoh client → Jetson router attach | ❌ **not tested** |
| Cross-host discovery to real hardware | ❌ **not tested** — case 5b |
| WSL2 NAT permits Zenoh to the Jetson | ❌ **not tested** |

---

## 8. What is still outstanding

In order:

1. **Install Zenoh** (needs `sudo`; candidate version on this host is
   `0.2.10-1noble.20260902.013525`):

   ```bash
   sudo apt-get update && sudo apt-get install -y ros-jazzy-rmw-zenoh-cpp
   ```

   Confirm it matches the Jetson's version — that was assumed here from
   `deploy.sh` setting `RMW_IMPLEMENTATION=rmw_zenoh_cpp`, not read off the
   Jetson itself.

2. **Re-run the bench test with Zenoh actually in use**, to confirm
   `ros/ros-env.sh` produces a working graph rather than just the right
   variables.

3. **Optionally install `ros-jazzy-control-msgs`** so
   `network_communication` builds — that node is the real subscriber for all
   seven topics and makes the bench test closer to the live graph.

4. **Re-verify against real hardware (case 5a).** This is the one that matters
   for competition and nothing above substitutes for it. Check in this order:
   Windows host joins the Jetson's network → WSL can reach `JETSON_IP` →
   TCP 7447 open → `ros2 topic list` shows the robot's topics. Expect the WSL2
   NAT issue in §7 to need attention.

5. **`rosbridge_suite`** — deliberately not installed yet; next step.

---

## 9. Gotchas found along the way

### `start.sh` has CRLF line endings in the Windows working tree

It cannot be run under `bash` as it currently sits on disk:

```
$ bash -n start.sh
start.sh: line 8: syntax error near unexpected token `elif'
```

This is **pre-existing and not caused by this step** — the committed blob is
LF and passes `bash -n` cleanly, as does the edited version once
LF-normalized. Only the Windows working-tree copy is affected.

### The two gits disagree about this repo

Git-for-Windows (with its default `core.autocrlf=true`) sees the tree as clean.
WSL's git, reading `~/.gitconfig` with `autocrlf` unset, reports **65 files
modified with 25207 insertions and 25207 deletions** — pure line-ending churn,
no content change.

**Do not run `git add`/`git commit` from WSL in this repo.** It would rewrite
the line endings of 65 unrelated files. Commit from the Windows side. Files
added by this step were deliberately written with **LF** so both gits agree on
them.

A `.gitattributes` with `* text=auto eol=lf` (plus `*.sh text eol=lf`) would
fix this class of problem permanently, but that rewrites the working tree and
is out of scope here.

### `set -u` breaks ROS setup scripts

`/opt/ros/jazzy/setup.bash` references unbound variables
(`AMENT_TRACE_SETUP_FILES`), so it fails under `set -u`. Both
`ros/setup-ros-ws.sh` and `ros/ros-env.sh` save, relax and restore `nounset`
around the sourcing. Worth knowing if you source ROS from any other
`set -euo pipefail` script — `start-dev.sh` uses that.

### `rosdep` needs ROS sourced first

Without it there is no `ROS_DISTRO` and every key fails to resolve:

```
ERROR: ... could not have their rosdep keys resolved to system dependencies
(ROS distro is not set...)
serial_msgs: Cannot locate rosdep definition for [rosidl_default_generators]
```

`ros/setup-ros-ws.sh` sources ROS before calling `rosdep`.

### `ros2 topic info` needs the leading slash

`ros2 topic info current_bus_voltage` returns `Unknown topic` even when the
topic exists. Use `/current_bus_voltage`.

---

## 10. Files added or changed by this step

| File | Change |
| --- | --- |
| `ros/setup-ros-ws.sh` | **new** — builds the message workspace |
| `ros/ros-env.sh` | **new** — host ROS/Zenoh env, sourced not executed |
| `start.sh` | **+6 lines** — guarded `source ros/ros-env.sh` before `cd react-app` |
| `docs/ros-env-setup.md` | **new** — this file |

No React or Node source was touched. `.gitignore` needed no change: it already
covers `build/`, `install/` and `log/`, and the workspace lives outside the repo
regardless.

