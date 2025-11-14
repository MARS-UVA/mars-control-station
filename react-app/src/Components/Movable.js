import React, { useState, useRef } from 'react';

const Movable = ({ children }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const offset = useRef({ x: 0, y: 0 });
  const movableRef = useRef(null);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    // Calculate the offset from the mouse position to the element's top-left corner
    offset.current = {
      x: e.clientX - movableRef.current.getBoundingClientRect().left,
      y: e.clientY - movableRef.current.getBoundingClientRect().top
    };
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      // Update position based on the new mouse position and initial offset
      setPosition({
        x: e.clientX - offset.current.x,
        y: e.clientY - offset.current.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      ref={movableRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      // Attach mouse move/up listeners to the window to handle cases where the mouse leaves the element while dragging
      onMouseLeave={handleMouseUp} 
      style={{
        position: 'absolute', // Allows moving freely within a positioned parent/viewport
        left: position.x,
        top: position.y,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none', // Prevents text selection during drag
      }}
    >
      {children}
    </div>
  );
};

export default Movable;
