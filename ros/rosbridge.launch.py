"""Launch rosbridge_server's websocket bridge for the control station UI.

rosbridge is colocated with the React dev server (this container), not with the
robot: the browser connects to ws://localhost:9090 and rosbridge reaches the
robot's ROS graph over Zenoh. See docs/devcontainer-ros-setup.md.

Run with:  ros2 launch ros/rosbridge.launch.py
"""

import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription
from launch_xml.launch_description_sources import XMLLaunchDescriptionSource


def generate_launch_description():
    rosbridge_launch = IncludeLaunchDescription(
        XMLLaunchDescriptionSource(
            os.path.join(
                get_package_share_directory('rosbridge_server'),
                'launch',
                'rosbridge_websocket_launch.xml'
            )
        ),
        launch_arguments={'websocket_ping_interval': '5.0'}.items(),
    )
    return LaunchDescription([rosbridge_launch])
