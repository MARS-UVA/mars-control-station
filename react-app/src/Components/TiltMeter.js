import { useEffect, useRef } from 'react';
import * as THREE from 'three';

function TiltMeter({ angleX = 0, angleY = 0, angleZ = 0 }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const lineRef = useRef(null);
  const frameIdRef = useRef(null);

  useEffect(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(4, 4, 4);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(200, 160);
    mountRef.current.appendChild(renderer.domElement);

    const axesHelper = new THREE.AxesHelper(4);
    scene.add(axesHelper);

    const gridHelper = new THREE.GridHelper(8, 8);
    scene.add(gridHelper);

    const lineGeometry = new THREE.CylinderGeometry(0.05, 0.05, 3, 16);
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const line = new THREE.Mesh(lineGeometry, lineMaterial);
    line.position.set(0, 1.5, 0);
    scene.add(line);
    lineRef.current = line;
    const originGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const originMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const origin = new THREE.Mesh(originGeometry, originMaterial);
    scene.add(origin);

    // Animation loop
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(frameIdRef.current);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (lineRef.current) {
      lineRef.current.rotation.set(0, 0, 0);
      
      const radX = THREE.MathUtils.degToRad(angleX);
      const radY = THREE.MathUtils.degToRad(angleY);
      const radZ = THREE.MathUtils.degToRad(angleZ);
      
      lineRef.current.rotateZ(radZ);
      lineRef.current.rotateY(radY);
      lineRef.current.rotateX(radX);
    }
  }, [angleX, angleY, angleZ]);

return <div ref={mountRef} style={{ marginTop: '30px' }}></div>;
};

export default TiltMeter;