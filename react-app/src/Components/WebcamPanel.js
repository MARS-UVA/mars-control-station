import React, { useState, useEffect, useRef } from "react";
import { Camera, Pause, Play } from "lucide-react";
import Guidelines from "./Guidelines";

const styles = {
  container: {
    margin: '10px 0', // Adds margin on top and bottom
    position: 'relative',
    width: '100%',
    height: '50%'
  },
  cameraContainer: {
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    backgroundColor: "black",
    borderRadius: "8px",
  },
  
  toggleButton: {
    position: "absolute",
    top: "10px",
    right: "10px",
    background: "rgba(0,0,0,0.6)",
    border: "none",
    borderRadius: "6px",
    color: "white",
    padding: "6px 10px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  cameraContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: 'black',
    borderRadius: '8px'
  },
  cameraFeed: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  overlayText: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    color: "white",
    fontSize: "1.5rem",
    background: "rgba(0,0,0,0.5)",
    padding: "10px 20px",
    borderRadius: "8px",
  },
};

// This component renders a panel with a webcam feed (currently showing laptop webcam)
function WebcamPanel({index, gamepadData}) {
    const id = parseInt(index);
    //const [imageSrc, setImageSrc] = useState(null);
    const imgRef = useRef(null);
    const lastUrl = useRef(null);
    const socketRef = useRef(null);
    const [isPaused, setIsPaused] = useState(false);
    useEffect(() => {
      if(isPaused){
        return;
      }
      const ws = new WebSocket("ws://localhost:3001");
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        const buffer = new Uint8Array([id]);
        ws.send(buffer)
        //console.log('webcamPanel ws connected');
      }

      ws.onmessage = (event) => {
        const blob = new Blob([event.data], {type: 'image/jpeg'});
        const newUrl = URL.createObjectURL(blob);
        //setImageSrc(URL.createObjectURL(blob));

        if(lastUrl.current) {
          const oldUrl = lastUrl.current
          requestAnimationFrame(() => URL.revokeObjectURL(oldUrl));
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
    }, [isPaused, id]);

    const toggleFeed = () => {
      if(isPaused){
        setIsPaused(false);
      }
      else{
        // Stop receiving frames and clear image
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (imgRef.current) {
        imgRef.current.src = "";
      }
      setIsPaused(true);
      }
    }

    return (
    <div style={styles.container}>
      {/* Camera feed container */}
      <div style={styles.cameraContainer}>
        <img 
          ref={imgRef}
          style={styles.cameraFeed}
          alt="Camera Feed"
        />

        {/* Toggle button */}
        <button style={styles.toggleButton} onClick={toggleFeed}>
          {isPaused ? <Play size={16} /> : <Pause size={16} />}
          {isPaused ? "Resume" : "Pause"}
        </button>

        {/* Overlay the parking guidelines */}
        {gamepadData ? <Guidelines leftStick={gamepadData.leftStick} /> : <></>}
      </div>
    </div>
    )
}

export default WebcamPanel;
