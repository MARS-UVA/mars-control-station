import { useEffect, useRef, useState } from "react";
import rod from '../assets/rod.png';
import center from '../assets/circle.png'
// Visualization of two tilting rods with slider controls (IMAGE-BASED RODS)
export default function TiltingRods() {
  const canvasRef = useRef(null);

  // test angles (sliders simulate incoming data)
  const [angleA, setAngleA] = useState(20);
  const [angleB, setAngleB] = useState(-30);

  const minA = -45;
  const maxA = 90;
  const minB = -90;
  const maxB = 45;
  const rodLength = 100;
  const rodThickness = 16;

  // preload images
  const rodImgRef = useRef(null);
  const centerImgRef = useRef(null);

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  useEffect(() => {
    rodImgRef.current = new Image();
    rodImgRef.current.src = rod; // place in /public

    centerImgRef.current = new Image();
    centerImgRef.current.src = center; // place in /public
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    // draw center object (image fallback to circle)
    if (centerImgRef.current?.complete) {
      ctx.drawImage(centerImgRef.current, cx - 25, cy - 25, 50, 50);
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, 25, 0, Math.PI * 2);
      ctx.fillStyle = "#e5e7eb";
      ctx.fill();
    }

    const drawRod = (angleDeg, minDeg, maxDeg, side) => {
      const clamped = clamp(angleDeg, minDeg, maxDeg);
      const rad = (clamped * Math.PI) / 180;

      const baseX = cx + (side === "left" ? -25 : 25);
      const baseY = cy;
      const dir = side === "left" ? Math.PI : 0;

      // allowed range arc (still drawn as vector)
      ctx.beginPath();
      ctx.arc(
        baseX,
        baseY,
        40,
        ((minDeg + (side === "left" ? 180 : 0)) * Math.PI) / 180,
        ((maxDeg + (side === "left" ? 180 : 0)) * Math.PI) / 180
      );
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // draw rod image
      ctx.save();
      ctx.translate(baseX, baseY);
      ctx.rotate(rad + dir);

      if (rodImgRef.current?.complete) {
        ctx.drawImage(
          rodImgRef.current,
          0,
          -rodThickness / 2,
          rodLength,
          rodThickness
        );
      } else {
        // fallback rectangle if image not loaded
        ctx.fillStyle = "#60a5fa";
        ctx.fillRect(0, -rodThickness / 2, rodLength, rodThickness);
      }

      ctx.restore();
    };

    drawRod(angleA, minA, maxA, "left");
    drawRod(angleB, minB, maxB, "right");
  }, [angleA, angleB]);

  return (
    <div className="Tilting-Rods">
      <canvas ref={canvasRef} width={530} height={300} />

      <div className="left-rod">
        <span>Left Rod Angle</span>
        <span>{angleA}°</span>
        <input
          type="range"
          min={minA}
          max={maxA}
          value={angleA}
          onChange={(e) => setAngleA(Number(e.target.value))}
        />
      </div>

      <div className="right-rod">
        <span>Right Rod Angle</span>
        <span>{angleB}°</span>
        <input
          type="range"
          min={minB}
          max={maxB}
          value={angleB}
          onChange={(e) => setAngleB(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
