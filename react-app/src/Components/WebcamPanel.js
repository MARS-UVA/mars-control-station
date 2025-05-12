import React, { useState, useEffect, useRef } from "react";
import { Camera } from "lucide-react";
import Guidelines from "./Guidelines";

const styles = {
  container: {
    margin: '10px 0', // Adds margin on top and bottom
    position: 'relative',
    width: '100%',
    height: '50%'
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
  }
};

// This component renders a panel with a webcam feed (currently showing laptop webcam)
function WebcamPanel({index, gamepadData}) {
    const id = parseInt(index);
    //const [imageSrc, setImageSrc] = useState(null);
    const imgRef = useRef(null);
    const lastUrl = useRef(null);
    const socketRef = useRef(null);

    useEffect(() => {
      const ws = new WebSocket("ws://localhost:3001");
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        const buffer = new Uint8Array([id]);
        ws.send(buffer)
        console.log('webcamPanel ws connected');
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
    }, []);



    return (
    <div style={styles.container}>
      {/* Camera feed container */}
      <div style={styles.cameraContainer}>
        <img 
          ref={imgRef}
          style={styles.cameraFeed}
          alt="Camera Feed"
        />
        
        {/* Overlay the parking guidelines */}
        {gamepadData ? <Guidelines leftStick={gamepadData.leftStick} /> : <></>}
      </div>
    </div>
    )
}

export default WebcamPanel;
