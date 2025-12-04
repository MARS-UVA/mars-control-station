import React, { useEffect, useRef } from "react";
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
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const camID = parseInt(index);

  useEffect(() => {
    // Create PeerConnection
    const pc = new RTCPeerConnection({
      iceServers: [
        { url: ["stun:stun.l.google.com:19302"] }
      ]
    });
    pcRef.current = pc;
    // Attach track to video element
    pc.ontrack = (event) => {
      console.log("received track");
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
      }
    };
    // Send ICE candidates to server
    pc.onicecandidate = (event) => {
      if(event.candidate) {
        wsRef.current.send(JSON.stringify({
          type: "candidate",
          candidate: event.candidate,
          camID: camID
        }));
      }
    };

    // Connect to our websocket server
    const ws = new WebSocket("ws://localhost:3001");
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        role: "display",
        camID: camID
      }));
    };

    // Handle messages
    ws.onmessage = async (msg) => {
      let data;
      try {
        data = JSON.parse(msg.data);
      } catch (e) {
        console.log("Invalid JSON from server", msg.data);
        return;
      }

      // Handle SDP offer
      if (data.type === "offer") {
        console.log("received sdp offer");
        await pc.setRemoteDescription(
          new RTCSessionDescription(data.offer)
        );

        // Create webrtc answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Send answer back
        ws.send(JSON.stringify({
          type: "answer",
          answer: answer,
          camID: camID
        }));
      }

      // Handle remote ICE candidates
      if (data.type === "candidate") {
        try {
          await pc.addIceCandidate(data.candidate);
        } catch (e) {
          console.error("Error adding ICE candidate", e);
        }
      }
    };
  }, [camID]);

  return (
    <div style={styles.container}>
      {/* Camera feed container */}
      <div style={styles.cameraContainer}>
        <img 
          ref={videoRef}
          style={styles.cameraFeed}
          autoPlay
          playsInline
          muted
        />
        
        {/* Overlay the parking guidelines */}
        {gamepadData ? <Guidelines leftStick={gamepadData.leftStick} /> : <></>}
      </div>
    </div>
  )
}

export default WebcamPanel;
