import React, { useEffect, useRef } from "react";

const canvasStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none'
};

const Guidelines = ({ leftStick }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    
    ctx.clearRect(0, 0, width, height);
    
    const stickX = leftStick?.x || 0;
    const stickY = leftStick?.y || 0;
    const curveIntensity = stickX * 3; // the multiplier was wrong due to gamepad mapping
  
    const forwardIntensity = stickY;
    
    ctx.lineWidth = 4;
    
    const drawGuideline = (offsetX, color) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      
      const startX = width / 2 + offsetX;
      const startY = height;
      
      const cp1x = startX;
      const cp1y = height * 0.7;
      
      const curveAmount = curveIntensity * Math.abs(offsetX / 50); // More curve for outer lines
      const endX = startX + curveAmount * 60;
      const endY = height * (0.5 - forwardIntensity * 0.3); // if forward intensity is negative, the line goes up because obstacles get further away
      
      const cp2x = endX - curveAmount * 20;
      const cp2y = height * 0.6;
      
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
      ctx.stroke();
      
      // Draw perspective lines (horizontal markers) for awareness of obstacles nearby
      if (offsetX === 0) {
        for (let i = 1; i <= 3; i++) {
          const t = i / 4; // Parameter along the curve (0 to 1)
          const markerY = startY * (1 - t) + endY * t;
          const markerX = startX * (1 - t) + endX * t;
          
          const markerWidth = (100 - 20 * i); // Gets narrower with distance
          
          // Adjust for curve
          const curveOffsetAtMarker = curveIntensity * t * 15;
          
          ctx.beginPath();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
          ctx.moveTo(markerX - markerWidth + curveOffsetAtMarker, markerY);
          ctx.lineTo(markerX + markerWidth + curveOffsetAtMarker, markerY);
          ctx.stroke();
        }
      }
    };
    
    drawGuideline(-100, "rgba(0, 255, 255, 0.8)"); // adjust based on robot wheel base measurements
    drawGuideline(0, "rgba(255, 255, 255, 0.8)");
    drawGuideline(100, "rgba(0, 255, 255, 0.8)");
    
    // safety zone at the bottom in red dashed lines
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 100, 100, 0.7)";
    ctx.setLineDash([8, 8]);
    ctx.moveTo(width * 0.2, height - 30);
    ctx.lineTo(width * 0.8, height - 30);
    ctx.stroke();
    ctx.setLineDash([]);
    
  }, [leftStick]);
  
  return (
    <canvas 
      ref={canvasRef} 
      style={canvasStyle}
    //   className="absolute top-0 left-0 w-full h-full pointer-events-none" 
      width={800} 
      height={600} 
    />
  );
};

export default Guidelines;