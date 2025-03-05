import React, { useState, useEffect, useRef } from "react";
import { Camera, ChevronRight, ChevronLeft } from "lucide-react";

// This component renders a panel with a webcam feed (currently showing laptop webcam)
function WebcamPanel() {

    const videoRef = useRef(null);
    const [cameraState, setCameraState] = useState("cam1")
    
    const rightClicked = () => {
      setCameraState("cam2");
    }
    const leftClicked = () => {
      setCameraState("cam1")
    }


    useEffect(() => {
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
      }, [cameraState]);



    return (
    <>
      <div className="panel">
        <div className="webcam-container">
          {cameraState == "cam1" ? <video ref={videoRef} autoPlay playsInline muted className="webcam" /> : ""}
          <div className="camera-icon">
            <Camera size={20} />
          </div>
          <button className="camera-left-button" onClick={leftClicked}>
            <ChevronLeft size={20} />
          </button>
          <button className="camera-right-button" onClick={rightClicked}>
            <ChevronRight size={20} />
          </button>
          
        </div>
      </div>
    </>
    )
}

export default WebcamPanel;
