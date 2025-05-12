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
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Extract stick values, default to 0 if not provided
    const stickX = leftStick?.x || 0;
    const stickY = leftStick?.y || 0;
    
    // Calculate trajectory angle based on stick position
    // stickX: -1 (full left) to 1 (full right)
    // Use negative stickX because turning left should curve path to the left
    const curveIntensity = -stickX * 3; // Adjust multiplier to control curve intensity
    
    // Forward/reverse intensity based on stickY
    // stickY is typically -1 (full forward) to 1 (full backward)
    // Invert stickY since -1 usually means pushing stick forward
    const forwardIntensity = -stickY;
    
    // Set guidelines style
    ctx.lineWidth = 4;
    
    // Draw guidelines (3 lines - left, center, right)
    const drawGuideline = (offsetX, color) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      
      // Start point at the bottom of the screen
      const startX = width / 2 + offsetX;
      const startY = height;
      
      // Control points for the curve
      const cp1x = startX;
      const cp1y = height * 0.7;
      
      // End point calculation with curve based on stick position
      // The further you look, the more the curve affects the path
      const curveAmount = curveIntensity * Math.abs(offsetX / 50); // More curve for outer lines
      const endX = startX + curveAmount * 60;
      const endY = height * (0.5 - forwardIntensity * 0.3); // Adjust based on forward/reverse
      
      // Second control point
      const cp2x = endX - curveAmount * 20;
      const cp2y = height * 0.6;
      
      // Draw the curved path
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
      ctx.stroke();
      
      // Draw perspective lines (horizontal markers)
      if (offsetX === 0) { // Only draw on center line
        for (let i = 1; i <= 3; i++) {
          const t = i / 4; // Parameter along the curve (0 to 1)
          const markerY = startY * (1 - t) + endY * t;
          const markerX = startX * (1 - t) + endX * t;
          
          // Calculate width of marker based on perspective
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
    
    // Draw the three guidelines
    drawGuideline(-50, "rgba(0, 255, 255, 0.8)"); // Left - cyan
    drawGuideline(0, "rgba(255, 255, 255, 0.8)"); // Center - white
    drawGuideline(50, "rgba(0, 255, 255, 0.8)"); // Right - cyan
    
    // Draw safety zone at the bottom
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