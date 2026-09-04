# Development containers

Open the repository in VS Code and run **Dev Containers: Reopen in Container**.
When prompted, choose the configuration that matches the host running Docker:

- **macOS**: `.devcontainer/mac/devcontainer.json`
- **WSL**: `.devcontainer/wsl/devcontainer.json`
- **Linux**: `.devcontainer/linux/devcontainer.json`

Each profile installs the dependencies for both the React application and the
Node WebSocket server. The container does not install ROS yet; it is intended
for the application's current WebSocket/UDP implementation. ROS/rosbridge can
be added later without affecting the host-specific container selection.
All three profiles build from the shared `.devcontainer/Dockerfile`.

Inside the container, run:

```bash
./start-dev.sh
```

The React UI is available on port 3000. WebSocket ports 3001, 6767, and 6969
are also forwarded. The Linux profile uses host networking so the UDP server
can communicate directly with devices on the host network. macOS and WSL use
Docker port forwarding because host networking is not consistently available
across Docker Desktop versions. Those two profiles explicitly publish UDP port
2001 for robot feedback.

The profiles create and join the shared `mars-dev` Docker network with the
hostname `mars-control-station`. The companion Jetson container is reachable as
`mars-jetson`, which is also supplied to the server through `JETSON_IP`.
