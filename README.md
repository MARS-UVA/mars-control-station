# Mars Control Station

## How to Run

The UI talks to the robot over ROS 2 through [rosbridge](https://github.com/RobotWebTools/rosbridge_suite):
rosbridge runs next to the React dev server, the browser connects to it on
`ws://localhost:9090`, and rosbridge reaches the robot's ROS graph over Zenoh.
That needs ROS 2 Jazzy, so run everything from the development container
(see [`.devcontainer/README.md`](.devcontainer/README.md)).

Inside the container:

```bash
./start.sh
```

This starts the camera signaling relay (ports 6767 and 6969) and the React dev
server (port 3000) immediately, with `REACT_APP_USE_ROSBRIDGE=true`. It waits
for the Jetson's Zenoh port (7447) to become reachable before starting
rosbridge (port 9090). The UI retries its connection in the meantime.
The Zenoh wait has no overall timeout; Ctrl+C stops all three services.

`start.sh` connects to the Jetson at `$JETSON_IP`. The devcontainer presets it to
`mars-jetson` for a Jetson container on the same Docker host and shared
`mars-dev` bridge network (the Gazebo simulation setup). For a real robot, pass
the robot's address instead and match its ROS domain:

```bash
JETSON_IP=<robot ip> ROS_DOMAIN_ID=0 ./start.sh
```

To check the link once both sides are up, from a second terminal in the container:

```bash
./ros/verify-jetson-link.sh
```

To test the UI and rosbridge wiring with no robot at all:

```bash
./start-rosbridge.sh
```

How it fits together, the topics, and the known gaps: [`docs/rosbridge.md`](docs/rosbridge.md).

## Gateway Server

- `server.c` : Creates a socket to listen to incoming messages (future improvement is to include a set of sockets to lighten load on server socket and have different reciever socket)
- **Things to do:**

1. Socket set to avoid read and write blocking
2. Data transformation layer
3. Data queue
4. Server endpoint for react application
5. Express server to fetch data for react app

## React App

## Gamepad
