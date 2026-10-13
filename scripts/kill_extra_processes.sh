#!/usr/bin/env bash
# Stop this checkout's leftover servers/UI and the current user's ROS / Zenoh
# bridge processes. Use --dry-run to list targets without stopping anything.
set -euo pipefail
repo_root=$(cd "$(dirname "$0")/.." && pwd)
exec python3 - "$repo_root" "$@" <<'PY'
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

repo = Path(sys.argv[1]).resolve()
if sys.argv[2:] not in ([], ['--dry-run']):
    sys.exit('Usage: scripts/kill_extra_processes.sh [--dry-run]')
dry_run = sys.argv[2:] == ['--dry-run']

def processes():
    result = {}
    for directory in Path('/proc').iterdir():
        if not directory.name.isdigit():
            continue
        try:
            if directory.stat().st_uid != os.getuid():
                continue
            args = directory.joinpath('cmdline').read_bytes().decode(errors='replace').strip('\0').split('\0')
            stat = directory.joinpath('stat').read_text().rsplit(')', 1)[1].split()
            if not args[0] or stat[0] == 'Z':
                continue
            cwd = directory.joinpath('cwd').resolve()
            result[int(directory.name)] = (int(stat[1]), stat[19], args, cwd)
        except (OSError, ValueError, IndexError):
            continue
    return result

def in_repo(path):
    return path == repo or repo in path.parents

def target(args, cwd):
    # Inspect executable/script arguments, not arbitrary inline shell code.
    names = [Path(arg).name for arg in args[:2]]
    if any(name in {'zenohd', 'rmw_zenohd', 'rosbridge_websocket', 'rosapi_node'} for name in names):
        return True
    if any(name == 'ros2' for name in names):
        if 'run' in args and 'rmw_zenoh_cpp' in args and 'rmw_zenohd' in args:
            return True
        if 'launch' in args and any(Path(arg).name in {'rosbridge.launch.py', 'rosbridge_websocket_launch.xml'} for arg in args):
            return True
    if '--name' in args and 'ros2-daemon' in args and 'rmw_zenoh_cpp' in args:
        return True
    for arg in args[:3]:
        path = (cwd / arg).resolve()
        if in_repo(path) and path.name in {'start.sh', 'start-rosbridge.sh', 'ws_server.js', 'udp_server.js', 'client_udp.js'}:
            return True
    if any(name in {'node', 'nodejs', 'sh', 'bash'} for name in names):
        if any(in_repo((cwd / arg).resolve()) and
               ('react-scripts' in Path(arg).parts or Path(arg).name == 'react-scripts')
               for arg in args[1:3]):
            return 'start' in args or any(arg.endswith('/scripts/start.js') for arg in args)
        if in_repo(cwd) and args[1:3] == ['-c', 'react-scripts start']:
            return True
    return in_repo(cwd) and (args[0] == 'npm start' or
                            Path(args[0]).name == 'npm' and 'start' in args[1:])

snapshot = processes()
# Never stop the caller's shell or the cleanup process itself.
protected = set()
pid = os.getpid()
while pid in snapshot and pid not in protected:
    protected.add(pid)
    pid = snapshot[pid][0]
selected = {pid for pid, (_, _, args, cwd) in snapshot.items()
            if pid not in protected and target(args, cwd)}
while True:
    descendants = {pid for pid, (parent, _, _, _) in snapshot.items()
                   if parent in selected and pid not in protected}
    expanded = selected | descendants
    if expanded == selected:
        break
    selected = expanded

for pid in sorted(selected):
    print(f'{"Would stop" if dry_run else "Stopping"} {pid}: {" ".join(snapshot[pid][2])}', flush=True)

# Start times protect against a PID being reused while cleanup waits.
def remaining():
    current = processes()
    return {pid for pid in selected if pid in current and
            current[pid][1] == snapshot[pid][1]}

def send(pids, sig):
    for pid in pids:
        try:
            os.kill(pid, sig)
        except ProcessLookupError:
            pass

if not dry_run:
    send(remaining(), signal.SIGTERM)
    deadline = time.monotonic() + 5
    while remaining() and time.monotonic() < deadline:
        time.sleep(0.1)
    survivors = remaining()
    if survivors:
        print('Force-stopping processes that did not exit after 5 seconds.', flush=True)
        send(survivors, signal.SIGKILL)

# Only remove the session created by start.sh, preserving other tmux sessions.
try:
    session = '=mars-control-station-rosbridge'
    exists = subprocess.run(['tmux', 'has-session', '-t', session], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
    if exists:
        print(f'{"Would remove" if dry_run else "Removing"} tmux session {session[1:]}', flush=True)
        if not dry_run:
            subprocess.run(['tmux', 'kill-session', '-t', session], check=True)
except FileNotFoundError:
    pass
if not selected:
    print('No leftover ROS / Zenoh or control-station server processes found.')
PY
