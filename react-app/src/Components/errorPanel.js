import React, { useState, useEffect, useRef } from "react";

function ErrorPanel() {
    //const [imageSrc, setImageSrc] = useState(null);
    const lastUrl = useRef(null);
    const socketRef = useRef(null);

    useEffect(() => {
      const ws = new WebSocket("ws://localhost:3002");
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        const buffer = new Uint8Array([0]);
        ws.send(buffer)
        console.log('errorPanel ws connected');
      }
    })

    return (
        <div className="gamepad-display">
            <div>
                <table>
                    <tr>
                        <th> Teleop Node </th>
                        <th> SerialROS Node </th>
                    </tr>
                    <tr>
                        <td id="TeleopNodeStatus"> No error </td>
                        <td id="SerialROSNodeStatus"> No error </td>
                    </tr>
                </table>
            </div>
        </div>



    )
      
}