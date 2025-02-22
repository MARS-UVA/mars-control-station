import React, { useState, useEffect, useRef } from "react";
import { Camera } from "lucide-react";

// This component renders a panel with a webcam feed (currently showing laptop webcam)
function WebcamPanel() {
    const [imageSrc, setImageSrc] = useState(null);
    //const videoRef = useRef(null);

    useEffect(() => {
      const ws = new WebSocket("ws://localhost:3001");

      ws.onmessage = (event) => {
        const blob = new Blob([event.data], {type: 'image/jpeg'});
        setImageSrc(URL.createObjectURL(blob));
      }
      /*      
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          navigator.mediaDevices
            .getUserMedia({ video: true })
            .then((stream) => {
              if (videoRef.current) {
                videoRef.current.srcObject = stream;
              }
            })
            .catch((error) => {
              console.error("Error accessing webcam:", error);
            });
        }
            */
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
