import React, { useState, useEffect, useRef, useCallback } from "react";
import { Camera, ChartNoAxesColumnDecreasing, Pause, Play } from "lucide-react";
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

    const createSocket = useCallback(() => {
      const ws = new WebSocket("ws://localhost:3001");
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        const buffer = new Uint8Array([id]);
        ws.send(buffer);
        //console.log('webcamPanel ws connected');
      };

      ws.onmessage = (event) => {
        const blob = new Blob([event.data], {type: 'image/jpeg'});
        const newUrl = URL.createObjectURL(blob);
        //setImageSrc(URL.createObjectURL(blob));

        if(lastUrl.current) {
          const oldUrl = lastUrl.current;
          requestAnimationFrame(() => URL.revokeObjectURL(oldUrl));
        }
        lastUrl.current = newUrl;

        if(imgRef.current) {
          imgRef.current.src = newUrl;
        }
      };

      return ws;
    }, [id]);

    useEffect(() => {
      const ws = createSocket();
      socketRef.current = ws;
      return() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        } else if (ws) {
          ws.close();
        }
        if(lastUrl.current) URL.revokeObjectURL(lastUrl.current)
      };
    }, [createSocket]);
    
    const sendCommand = (cmd) => {
        const payload = JSON.stringify({ type: 'command', cmd: cmd });
        let ws = socketRef.current;
        if (!ws) {
          ws = createSocket();
          socketRef.current = ws;
          ws.addEventListener('open', () => {
            try { ws.send(payload); } catch (e) { console.log(e);}
          }, {once: true});
          return;
        }
        else if (ws.readyState === WebSocket.OPEN) {
          try { ws.send(payload); } catch (e) { console.log(e);}
        }
        else if (ws.readyState === WebSocket.CONNECTING) {
          ws.addEventListener('open', () => {
            try { ws.send(payload); } catch (e) { console.log(e);}
          }, {once: true});
        }
      }

    const toggleFeed = () => {
      if(isPaused){
        sendCommand('start_video');
        setIsPaused(false);
        console.log("resuming video");
      } else {
        sendCommand('stop_video');
        setIsPaused(true);
        console.log("pausing video");
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
