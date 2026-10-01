# Devcontainer ROS setup (rosbridge migration)

The control-station devcontainer is now a combined ROS 2 Jazzy + Node 22 image.
rosbridge runs in the same container as the React dev server, and it reaches
the robot's ROS graph over Zenoh through the Jetson's router.

**Date:** 2026-09-22
**Branch:** `yogi/rosbridge-ui-refactor-work` (on top of `0fec2b1`)
**Status:** The files below are all edited. The container has not been rebuilt
since these edits, and rosbridge has not been launched in it yet.

---

## Where the message packages come from

The four interface packages (`serial_msgs`, `teleop_msgs`,
`robot_control_msgs`, `autonomy_msgs`) come from the `mars-ros-interfaces`
git submodule at `ros/mars-ros-interfaces`, pinned to the same commit as
mars-jetson's `src/mars-ros-interfaces`. The container needs no mars-jetson
checkout or mount. The earlier `MARS_JETSON_REL` bind mount and the
`MARS_JETSON_SRC` variable are gone.

The path differs from mars-jetson's on purpose: this repo keeps all ROS files
under `ros/` and has no top-level `src/`, and colcon never sees the submodule
directly - `ros/setup-ros-ws.sh` symlinks its packages into the workspace
outside the repo.

---

## What changed

This covers the full current state: the earlier partial session plus this one.

### `.devcontainer/Dockerfile`

- Base image: `ros:jazzy`.
- ROS packages: `ros-jazzy-rmw-zenoh-cpp`, `ros-jazzy-rosbridge-server`,
  `python3-colcon-common-extensions`, `python3-rosdep`, `ros-dev-tools`.
- Tooling: `curl`, `ca-certificates`, `gnupg`, `git`, `build-essential`,
  `openssh-client`, `iproute2`, `iputils-ping`, `tmux`.
- Node 22 installed from the NodeSource apt repo (signed keyring in
  `/etc/apt/keyrings/nodesource.gpg`).
- `RUN rosdep init || true`. The `ros:jazzy` base usually runs this already,
  and it fails if the sources list exists, so it is guarded.
- Non-root user `mars` (UID/GID 1000) with passwordless sudo. This replaces the
  `ubuntu` user that Noble images ship on UID 1000. It was kept unchanged.
- `/opt/ros/jazzy/setup.bash` is sourced in `mars`'s `.bashrc`.

### `.devcontainer/{linux,mac,wsl}/devcontainer.json`

All three profiles got the same changes:

- `mounts`: none. (A mars-jetson bind mount lived here until the
  `ros/mars-ros-interfaces` submodule replaced it.)
- `containerEnv` added `RMW_IMPLEMENTATION: "rmw_zenoh_cpp"` and, in a later
  pass, `ZENOH_CONFIG_OVERRIDE` (see below). `ROS_DOMAIN_ID`
  stays `"42"`, which matches all three mars-jetson devcontainer profiles
  (checked against `mars-jetson/.devcontainer/{linux,macos,wslg}/devcontainer.json`).
- `forwardPorts` is now `[3000, 3001, 6767, 6969, 9090]`, with the label
  "rosbridge websocket" on 9090.

The directory names in this repo are `linux`, `mac` and `wsl`. mars-jetson uses
`linux`, `macos` and `wslg`, so pick the matching profile by host OS, not by
directory name.

### `ros/ros-env.sh`

The Zenoh override now runs the session in client mode:

```bash
export ZENOH_CONFIG_OVERRIDE="mode=\"client\";connect/endpoints=[\"tcp/${JETSON_IP}:7447\"]"
```

In the default peer mode, this host opens its own listener and advertises it.
Behind WSL2 NAT, or across the Docker network, nothing can connect back to that
listener. A client only makes outbound connections to the Jetson's router.

### `ros/rosbridge.launch.py` (new)

This wraps `rosbridge_server`'s `rosbridge_websocket_launch.xml` with
`websocket_ping_interval: 5.0`, so dead browser connections are detected
quickly. Run it with:

```bash
source ros/ros-env.sh
ros2 launch ros/rosbridge.launch.py
```

### `react-app/.env` (new) and `react-app/.env.local`

Both set `REACT_APP_ROSBRIDGE_URL=ws://localhost:9090`. `.env` is the committed
default. `.env.local` is gitignored and is where you override it for your
machine.

---

## Fixed in the follow-up pass (2026-09-22)

- **`ros/ros-env.sh` is now sourced everywhere it needs to be.**
  `start-dev.sh` now sources it the same way `start.sh` does, with the same
  `$(dirname "$0")/ros/ros-env.sh` guard, before the server and dev server
  start. It has been tested under `start-dev.sh`'s `set -euo pipefail`. Each
  profile's `postCreateCommand` also adds
  `source ${containerWorkspaceFolder}/ros/ros-env.sh` to `~/.bashrc`, so a bare
  terminal gets the Zenoh client config too. The grep guard keeps rebuilds from
  adding a second copy. The scripts run non-interactively, so they don't read
  `.bashrc` and never source the file twice. `${containerWorkspaceFolder}` is
  used because no profile sets `workspaceFolder`. The in-container path is
  therefore `/workspaces/<your local folder name>`, which is
  `/workspaces/mars-control-station` only if you kept the default clone name.
- **`start.sh` and `start-dev.sh` are executable again (755).** The cause:
  editing or checking out files through `\\wsl.localhost\...` from Windows
  (Git for Windows, editors writing via 9P) can't preserve the executable bit.
  Run git and shell edits for this repo from inside WSL.
- **`__pycache__/` is gitignored**, in the same unanchored style as
  `node_modules/`.
- **`.devcontainer/README.md` is corrected.** It now lists the `ros:jazzy`
  image, rosbridge on 9090, and Zenoh client mode, and no longer describes host
  networking or UDP 2001 publishing.

## Message workspace: resolved (2026-09-22)

The gap was that the `serial`/`teleop`/`robot_control`/`autonomy` message
packages were never built inside the container, so rosbridge would have had no
custom types. Each profile's `postCreateCommand` now builds them right after
the `.bashrc` line and before the Node steps:

```
git submodule update --init --recursive && rosdep update --rosdistro jazzy && ./ros/setup-ros-ws.sh
```

- **Decision: build fresh in the container, don't mount a prebuilt `install/`.**
  This matches how `npm ci` already handles Node dependencies: the build is
  reproducible in each container and doesn't depend on the host.
- The packages come from the `ros/mars-ros-interfaces` submodule only (see
  "Where the message packages come from" above). The submodule step runs
  first, inside the `&&` chain, so a failed fetch stops container creation
  instead of reaching the build with nothing to link.
- The workspace lands at the same `MARS_ROS_WS` default that `ros-env.sh`
  reads (`~/UVA_Projects/mars-control-station-ros_ws`, so `/home/mars/...` in
  the container), so the two agree without any extra configuration.
- Two changes this build needed:
  - **`rosdep update` as `mars`.** The `ros:jazzy` base runs `rosdep update`
    only as root. In the existing image, `rosdep` as `mars` fails with
    "your rosdep installation has not been initialized yet".
  - **`ros/setup-ros-ws.sh` is now executable.** It was committed as 100644, so
    `./ros/setup-ros-ws.sh` would have failed with "Permission denied".
- The four packages only depend on `ament_cmake`, `rosidl_default_generators`,
  `rosidl_default_runtime` and each other. The base image already has all of
  these, so `rosdep install` shouldn't need apt, even though the Dockerfile
  deletes the apt lists.
- The ROS steps are joined to the Node steps with `&&`. This was changed from
  `;`, which let `npm ci` run and report success after a failed message build.
  A broken ROS environment should fail container creation loudly instead of
  being hidden by `npm ci`. The `.bashrc` line still ends in `;`, because it's idempotent and
  can't really fail.
- **To verify at rebuild:** once the build has run, the
  `ros-env.sh: no build at .../install` warning should stop appearing when a
  shell starts, because the workspace will exist before any terminal opens.
  This is an expectation, not something tested yet.

## `ZENOH_CONFIG_OVERRIDE` promoted to `containerEnv` (2026-09-22)

All three profiles' `containerEnv` now set:

```json
"ZENOH_CONFIG_OVERRIDE": "mode=\"client\";connect/endpoints=[\"tcp/mars-jetson:7447\"]"
```

The reasoning is the same as for `RMW_IMPLEMENTATION`. In the devcontainer,
`JETSON_IP` is always the static string `"mars-jetson"`, so the override
`ros-env.sh` would compute from it is also static. Putting it in `containerEnv`
means every process in the container gets it, including non-interactive ones
that never source `ros-env.sh`. The value is the same as the one `ros-env.sh`
produces when `JETSON_IP=mars-jetson`, so interactive shells that also source
`ros-env.sh` just re-export the same value.

`ros/ros-env.sh` is unchanged. It's still the source of truth outside the
devcontainer, where `JETSON_IP` is a real IP and not a fixed string.

## ⚠️ Non-interactive shells don't get the message workspace

This is a standing caveat for anyone, human or agent, running commands in this
container. Non-interactive shell invocations include:

- `bash -c ...` and `bash -lc ...`
- `docker exec` without `-it`
- Claude Code's own command execution

None of these source `ros/ros-env.sh` or the built workspace's
`install/setup.bash`. Both are sourced from the bottom of `~/.bashrc`, and
Ubuntu's stock `.bashrc` returns early for non-interactive shells before it
reaches those lines. In that situation `AMENT_PREFIX_PATH` is only
`/opt/ros/jazzy`, and `ros2 interface show serial_msgs/...` fails with
`Unknown package`.

Any non-interactive command that needs the built message types must source them
explicitly first:

```bash
source ros/ros-env.sh && source "$MARS_ROS_WS/install/setup.bash"
```

`ros-env.sh` exports `MARS_ROS_WS` (default
`~/UVA_Projects/mars-control-station-ros_ws`) and normally sources the
workspace itself when it exists. The second `source` makes that explicit and is
harmless if it runs twice.

`RMW_IMPLEMENTATION` and `ZENOH_CONFIG_OVERRIDE` no longer need this step,
because they come from `containerEnv` now. Sourcing the workspace still does,
because it's a script to run and not a static value.

## Still open

### Deliberately deferred (real-hardware only, doesn't affect bench testing)

**Domain ID mismatch against real hardware.** Both devcontainers use
`ROS_DOMAIN_ID=42`. The real Jetson's `deploy.sh` doesn't set a domain ID, so
it runs on 0, and `ros-env.sh` deliberately leaves it unset. If you point this
container at the real robot, `containerEnv` still forces 42. Run
`export ROS_DOMAIN_ID=0` first, or the two sides won't see each other.

### Not verified yet

Container rebuild, `ros2 launch ros/rosbridge.launch.py`, and the UI connecting
to `ws://localhost:9090`.
