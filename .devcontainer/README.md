# Development containers

Open the repository in VS Code and run **Dev Containers: Reopen in Container**.
When prompted, choose the configuration that matches the host running Docker:

- **macOS**: `.devcontainer/mac/devcontainer.json`
- **WSL**: `.devcontainer/wsl/devcontainer.json`
- **Linux**: `.devcontainer/linux/devcontainer.json`

No other checkout is needed. The ROS message packages come from the
`ros/mars-ros-interfaces` git submodule, which each profile's
`postCreateCommand` initializes (`git submodule update --init --recursive`)
before building them with `ros/setup-ros-ws.sh`. mars-jetson currently keeps
its own copy of these packages in-tree; when updating the submodule pin, check
that they still match, or rosbridge will fail to load the changed types.

Each profile installs the dependencies for both the React application and the
Node WebSocket server. The image is based on `ros:jazzy` and also includes
`rmw_zenoh_cpp` and `rosbridge_server`, so rosbridge runs in this container next
to the dev server. All three profiles build from the shared
`.devcontainer/Dockerfile`.

Inside the container, run:

```bash
./start.sh
```

This starts the camera signaling relay and React dev server immediately with
`REACT_APP_USE_ROSBRIDGE=true`, waits for the Jetson's Zenoh port (7447), then
starts rosbridge (`ros/rosbridge.launch.py`) on port 9090. Ctrl+C cancels the
wait and stops the services. `JETSON_IP` is preset to `mars-jetson`
in every profile, so there is no prompt; override it for a real robot. To check
the UI against rosbridge with no Jetson running, use `./start-rosbridge.sh`
instead, and to confirm a live Jetson link, run `./ros/verify-jetson-link.sh`
from a second terminal.

The React UI is available on port 3000. WebSocket ports 3001, 6767, and 6969
are also forwarded, along with 9090 for the rosbridge websocket. All three
profiles use the same Docker bridge network (below) and VS Code port
forwarding. None of them uses host networking or publishes UDP ports.
ROS traffic goes over Zenoh in client mode: this container dials out to the
router the Jetson runs on port 7447 (`ros/ros-env.sh`).

The profiles create and join the shared `mars-dev` Docker bridge network with
alias `mars-control-station`. The companion Jetson container joins the same
network with alias `mars-jetson`. On one Docker host, use
`JETSON_IP=mars-jetson` here and `CONTROL_STATION_IP=mars-control-station` on
the Jetson. Both containers must use the same `ROS_DOMAIN_ID` (42 in the
devcontainer profiles).

For a robot and laptop on separate Docker hosts, use the Jetson's LAN IP as
`JETSON_IP` and the laptop's LAN IP as the Jetson's `CONTROL_STATION_IP`.
The Jetson publishes TCP 7447 for Zenoh; these profiles publish TCP 6767 and
6969 for camera signaling. Creating `mars-dev` on both machines does not join
their networks. Match the ROS domain on both sides; for a robot using domain
0, run `JETSON_IP=<robot ip> ROS_DOMAIN_ID=0 ./start.sh`.

WebRTC video uses ICE-selected connections separately from signaling. The
published signaling ports do not ensure that video can traverse Docker NAT.
Verify camera connectivity with the browser; a reachable TURN relay may be
needed if direct ICE connectivity fails.
