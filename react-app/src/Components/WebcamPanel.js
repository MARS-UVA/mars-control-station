import React, { useState, useEffect, useRef, useCallback } from "react";
import { Camera, ChartNoAxesColumnDecreasing, Pause, Play } from "lucide-react";
import { flipPausedState, getPausedState } from "../robotState";
import Guidelines from "../gamepad/Guidelines";
import pauseImage from '../assets/touchedNpaused.png';

const styles = {
  container: {
    margin: '10px auto', // Adds margin on top and bottom
    position: 'relative',
    width: '750px',
    height: '475px',
    maxWidth: '100%',
  },
  cameraContainer: {
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    backgroundColor: "black",
    borderRadius: "8px",
  },
  pauseImage : {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "50%",
    height: "50%",
    objectFit: "contain",
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
    objectFit: 'cover',
    display: 'block'
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 10
  }
};

function WebcamPanel({ signalingPort, gamepadData, index }) {
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  
  // Change this to ip of signaling server if not on same computer
  const signalingUrl = `ws://localhost:${signalingPort}`;

  useEffect(() => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    pc.addTransceiver('video', { direction: 'recvonly' });
    
    pcRef.current = pc;
    
    let candidateQueue = [];
    let isRemoteSet = false;

    const ws = new WebSocket(signalingUrl);
    wsRef.current = ws;

    // WebRTC Event Handlers
    pc.ontrack = (event) => {
      console.log(`[${signalingUrl}] Track received`);
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
        videoRef.current.play().catch(e => console.error("Autoplay failed:", e));
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ ice: event.candidate }));
      }
    };

    // WebSocket Event Handlers
    ws.onopen = () => {
      console.log(`[Cam ${index}] Connected to ${signalingUrl}`);
      ws.send(JSON.stringify({ cmd: 'HELLO_FROM_VIEWER' }));
    };

    ws.onmessage = async (event) => {
      let data = event.data;

      if (data instanceof Blob) {
        data = await data.text();
      }

      let msg;
      try {
        msg = JSON.parse(data);
      } catch (e) {
        console.error("JSON Parse Error:", e);
        return;
      }

      if (msg.cmd === 'HELLO_FROM_STREAMER') {
        ws.send(JSON.stringify({ cmd: 'HELLO_FROM_VIEWER' }));
      } 
      else if (msg.sdp && msg.sdp.type === 'offer') {
        console.log("Received Offer - Setting Remote Description");
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          isRemoteSet = true;
          
          // Add candidates that arrived while waiting
          console.log(`Processing ${candidateQueue.length} queued candidates`);
          while (candidateQueue.length > 0) {
             const c = candidateQueue.shift();
             await pc.addIceCandidate(new RTCIceCandidate(c));
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ sdp: { type: 'answer', sdp: answer.sdp } }));
        } catch (e) {
          console.error(`[Cam ${index}] SDP Error:`, e);
        }
      } 
      else if (msg.ice) {
        try {
          if (isRemoteSet) {
             console.log("Adding ICE Candidate directly");
             await pc.addIceCandidate(new RTCIceCandidate(msg.ice));
          } else {
             console.log("Queueing ICE Candidate (Remote not set yet)");
             candidateQueue.push(msg.ice);
          }
        } catch (e) {
          console.error(`[Cam ${index}] ICE Error:`, e);
        }
      }
    };

    // Cleanup
    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
      if (pc.signalingState !== 'closed') pc.close();
    };
  }, [signalingPort, index]);

  return (
    <div style={styles.container}>
      <div style={styles.cameraContainer}>
        <video
          ref={videoRef}
          style={styles.cameraFeed}
          autoPlay
          playsInline
          muted
          controls={false}
        />
      </div>
    </div>
  );
}

export default WebcamPanel;
