# Development containers

Open the repository in VS Code and run **Dev Containers: Reopen in Container**.
When prompted, choose the configuration that matches the host running Docker:

- **macOS**: `.devcontainer/mac/devcontainer.json`
- **WSL**: `.devcontainer/wsl/devcontainer.json`
- **Linux**: `.devcontainer/linux/devcontainer.json`

**Default setup:** clone `mars-jetson` next to this repo, in the same parent
directory. Nothing else is needed. The container mounts it at
`/workspaces/mars-jetson`.

```
parent/
├── mars-control-station/
└── mars-jetson/
```

**Custom layout:** set `MARS_JETSON_REL` on the host to the path of your
mars-jetson checkout, relative to this repo (for example `../../mars-jetson`).
It has to be relative, not absolute. It only takes effect when the container is
built or rebuilt, so changing it inside a running container does nothing.

If mars-jetson isn't at the expected path, container creation fails with
Docker's `invalid mount config for type "bind": bind source path does not
exist: <path>`. The `<path>` in that message is where it looked. See
`docs/devcontainer-ros-setup.md` for details.

Each profile installs the dependencies for both the React application and the
Node WebSocket server. The image is based on `ros:jazzy` and also includes
`rmw_zenoh_cpp` and `rosbridge_server`, so rosbridge runs in this container next
to the dev server. All three profiles build from the shared
`.devcontainer/Dockerfile`.

Inside the container, run:

```bash
./start-dev.sh
```

The React UI is available on port 3000. WebSocket ports 3001, 6767, and 6969
are also forwarded, along with 9090 for the rosbridge websocket. All three
profiles use the same Docker bridge network (below) and VS Code port
forwarding. None of them uses host networking or publishes UDP ports.
ROS traffic goes over Zenoh in client mode: this container dials out to the
router the Jetson runs on port 7447 (`ros/ros-env.sh`), so nothing has to reach
back into the container.

The profiles create and join the shared `mars-dev` Docker network with the
hostname `mars-control-station`. The companion Jetson container is reachable as
`mars-jetson`, which is also supplied to the server through `JETSON_IP`.
