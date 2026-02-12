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

/**
 * WebRTC Player Component
 * @param {string} signalingPort - The WS Port for the Signaling Server
 * @param {object} gamepadData - For the guidelines overlay
 */
function WebcamPanel({signalingPort, index}) {
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const camID = parseInt(index);
  const signalingUrl = `ws://localhost:${signalingPort}`

  useEffect(() => {
    // Initialize PeerConnection
    const config = {
      iceServers: [{urls: 'stun:stun.l.google.com:19302'}]
    };
    const pc = new RTCPeerConnection(config);
    pcRef.current = pc;

    // Initialize WebSocket
    const ws = new WebSocket(signalingUrl);
    wsRef.current = ws;

    // WebRTC Event Handlers
    pc.ontrack = (event) => {
      console.log(`[${signalingUrl}] Track received`);
      if(videoRef.current) {
        videoRef.current.srcObject = event.streams[0]
      }
    };

    pc.onicecandidate = (event) => {
      if(event.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ ice: event.candidate }));
      }
    }

    // Websocket Event Handlers
    ws.onopen = () => {
      console.log(`[${signalingUrl}] Connected to Signaling Server`);
      // Announce presence to the server
      ws.send(JSON.stringify({ cmd: 'HELLO_FROM_VIEWER' }));
    };

    ws.onmessage = async (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        console.error('Invalid JSON: ', event.data);
        return;
      }
      
      // Streamer Announcement
      if(msg.cmd == 'HELLO_FROM_STREAMER') {
        console.log(`[${signalingUrl}] Streamer joined. Resending Hello`)
        ws.send(JSON.stringify({ cmd: 'HELLO_FROM_VIEWER' }));
      }
      // Handle SDP Offers
      else if(msg.sdp) {
        if(msg.sdp.type === 'offer') {
          console.log(`[${signalingUrl}] Received Offer`);
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            // Send answer back to robot
            ws.send(JSON.stringify({ sdp: { type: 'answer', sdp: answer.sdp } }));
          } catch (e) {
            console.error('SDP Error', e);
          }
        }
      }
      // Handle ICE
      else if(msg.ice) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(msg.ice));
        } catch (e) {
          console.error('ICE Error:', e);
        }
      }
    };

    // Cleanup
    return () => {
      if(ws.readyState === WebSocket.OPEN) ws.close();
      if(pc.signalingState !== 'closed') pc.close();
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
          controls={false} // Hide controls
          muted
        />
      </div>
    </div>
  );
}

export default WebcamPanel;
