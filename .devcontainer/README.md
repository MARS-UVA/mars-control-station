# Development containers

Open the repository in VS Code and run **Dev Containers: Reopen in Container**.
When prompted, choose the configuration that matches the host running Docker:

- **macOS**: `.devcontainer/mac/devcontainer.json`
- **WSL**: `.devcontainer/wsl/devcontainer.json`
- **Linux**: `.devcontainer/linux/devcontainer.json`

No other checkout is needed. The ROS message packages come from the
`ros/mars-ros-interfaces` git submodule, which each profile's
`postCreateCommand` initializes (`git submodule update --init --recursive`)
before building them with `ros/setup-ros-ws.sh`. mars-jetson pins the same
submodule commit, so both sides build identical interface definitions.

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
router the Jetson runs on port 7447 (`ros/ros-env.sh`).

The profiles create and join the shared `mars-dev` Docker network. The
companion Jetson container runs with host networking, so it is not on
`mars-dev` and is reached through the host gateway as `host.docker.internal`
(supplied as `JETSON_IP`). The camera signaling ports 6767 and 6969 are
published to the host so the Jetson's streamers can dial the relay here at
`127.0.0.1`.
