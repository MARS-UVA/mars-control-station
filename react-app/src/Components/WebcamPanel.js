import React, { useState, useEffect, useRef } from "react";
import { Camera } from "lucide-react";

// This component renders a panel with a webcam feed (currently showing laptop webcam)
function WebcamPanel() {
    //const [imageSrc, setImageSrc] = useState(null);
    const imgRef = useRef(null);
    const lastUrl = useRef(null);
    const socketRef = useRef(null);

    useEffect(() => {
      const ws = new WebSocket("ws://localhost:3001");
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        const buffer = new Uint8Array([0]);
        ws.send(buffer)
        console.log('webcamPanel ws connected');
      }

      ws.onmessage = (event) => {
        const blob = new Blob([event.data], {type: 'image/jpeg'});
        const newUrl = URL.createObjectURL(blob);
        //setImageSrc(URL.createObjectURL(blob));

        if(lastUrl.current) {
          const oldUrl = lastUrl.current
          requestAnimationFrame(() => URL.revokeObjectURL(lastUrl.current));
        }
        lastUrl.current = newUrl;

        if(imgRef.current) {
          imgRef.current.src = newUrl;
        }
      };
      return() => {
        ws.close();
        if(lastUrl.current) URL.revokeObjectURL(lastUrl.current)
      };
    }, []);



    return (
    <>
      <div className="panel">
        <div className="webcam-container">
          <img ref={imgRef} alt="Waiting for image" />
        </div>
      </div>
    </>
    )
}

export default WebcamPanel;
