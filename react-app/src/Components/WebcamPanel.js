import React, { useState, useEffect, useRef } from "react";
import { Camera } from "lucide-react";

// This component renders a panel with a webcam feed (currently showing laptop webcam)
function WebcamPanel() {
    const [imageSrc, setImageSrc] = useState(null);

    useEffect(() => {
      const ws = new WebSocket("ws://localhost:3001");

      ws.onopen = () => {
        const buffer = new Uint8Array([0]);
        ws.send(buffer)
        console.log('webcamPanel ws connected');
      }

      ws.onmessage = (event) => {
        const blob = new Blob([event.data], {type: 'image/jpeg'});
        setImageSrc(URL.createObjectURL(blob));
      }
      return() => ws.close();
    }, []);



    return (
    <>
      <div className="panel">
        <div className="webcam-container">
          {imageSrc ? (
            <img src={imageSrc}/>
          ) : (
            <p>Waiting for Image</p>
          )}
        </div>
      </div>
    </>
    )
}

export default WebcamPanel;
