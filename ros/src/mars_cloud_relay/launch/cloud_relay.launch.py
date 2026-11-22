"Launch the station's Draco-to-PointCloud2 relay"

import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    package_share = get_package_share_directory('mars_cloud_relay')
    return LaunchDescription([
        Node(
            package='point_cloud_transport',
            executable='republish',
            name='mars_cloud_relay',
            parameters=[os.path.join(package_share, 'config', 'cloud-relay.yaml')],
            remappings=[
                ('in/draco', '/rtabmap/cloud_map/draco'),
                ('out', '/station/cloud_map_decompressed'),
            ],
            output='screen',
        ),
    ])
