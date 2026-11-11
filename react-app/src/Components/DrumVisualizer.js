import React, { useEffect, useRef, useState } from "react";
import {
  AmbientLight,
  Box3,
  BufferGeometry,
  DirectionalLight,
  Group,
  Line,
  LineBasicMaterial,
  LoadingManager,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import URDFLoader from "urdf-loader";
import {
  calculateDrumKinematics,
  DRUM_OFFSET_ANGLE_DEG,
  MAX_ACTUATOR_POSITION,
} from "./drumKinematics";
import "./DrumVisualizer.css";

const publicPath = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const MODEL_URL = `${publicPath}/robot-model/startup/urdf/robot/urdf/robot.urdf`;
const MODEL_PACKAGE_PATH = `${publicPath}/robot-model/startup`;
const MODEL_LINKS = [
  "frame_assembly",
  "front_left_wheel",
  "rear_left_wheel",
  "front_arm",
  "rear_arm",
  "drum",
  "rear_left_drum",
];
const VISIBLE_LINKS = new Set(MODEL_LINKS);
const FRAME_LINKS = new Set(["frame_assembly", "front_arm", "rear_arm"]);
const DRUM_LINKS = ["drum", "rear_left_drum"];
const ACTUATOR_SAMPLES = 100;

// In robot.urdf, front_arm_joint / rear_arm_joint at 0 rad already puts the
// pivot-to-drum-center line 52.4° above horizontal (outward from the robot),
// and positive joint values raise the drum. Measured from the URDF; change
// this if the arm joint origins in robot.urdf change.
const MODEL_DRUM_ANGLE_AT_ZERO_DEG = 52.3954;

// Joint value that puts the model's drum where the kinematics say it is:
// match the pivot-to-drum-center direction, not the arm line, because the
// URDF and the kinematics place the drum slightly differently along the arm.
function toModelJointAngle(kinematics) {
  const drumDirectionDeg = kinematics.angleDegrees - DRUM_OFFSET_ANGLE_DEG;
  return ((drumDirectionDeg - MODEL_DRUM_ANGLE_AT_ZERO_DEG) * Math.PI) / 180;
}

// Drawn when there is no valid reading: drums fully raised.
const RESTING_JOINT_ANGLE = toModelJointAngle(calculateDrumKinematics(0));

const formatValue = (value) => (
  Number.isFinite(value) ? value.toFixed(1) : "--"
);

function DrumVisualizer({ frontActuatorPosition, rearActuatorPosition }) {
  const modelContainerRef = useRef(null);
  const robotRef = useRef(null);
  const renderRef = useRef(null);
  const [modelReady, setModelReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [modelError, setModelError] = useState("");

  const drums = [
    {
      key: "front",
      label: "Front drum",
      color: "#3182ce",
      position: calculateDrumKinematics(frontActuatorPosition),
    },
    {
      key: "rear",
      label: "Rear drum",
      color: "#e47717",
      position: calculateDrumKinematics(rearActuatorPosition),
    },
  ];

  useEffect(() => {
    const container = modelContainerRef.current;
    if (!container) return undefined;

    let cancelled = false;
    let renderer;
    let resizeObserver;
    let robotGroup;
    let camera;
    let groundLine;

    try {
      const scene = new Scene();
      camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
      camera.userData.bottomY = 0;
      camera.userData.groundY = 0;
      camera.userData.centerX = 0;
      camera.userData.centerZ = 0;
      camera.userData.modelHeight = 0.65;
      camera.userData.modelWidth = 0;
      robotGroup = new Group();
      robotGroup.rotation.x = -Math.PI / 2;
      scene.add(robotGroup);

      scene.add(new AmbientLight(0xffffff, 1.8));
      const keyLight = new DirectionalLight(0xffffff, 2.4);
      keyLight.position.set(1, 2, 3);
      scene.add(keyLight);

      renderer = new WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      container.replaceChildren(renderer.domElement);
      renderer.domElement.setAttribute(
        "aria-label",
        "Side view of the MARS robot chassis, wheels, and moving drums",
      );
      renderer.domElement.setAttribute("role", "img");

      const render = () => {
        if (!container.clientWidth || !container.clientHeight) return;
        renderer.setSize(container.clientWidth, container.clientHeight, false);
        const aspect = container.clientWidth / container.clientHeight;
        const viewHeight = Math.max(
          camera.userData.modelHeight || 0.65,
          (camera.userData.modelWidth || 0) / aspect,
        );
        camera.left = -viewHeight * aspect / 2;
        camera.right = viewHeight * aspect / 2;
        camera.top = viewHeight / 2;
        camera.bottom = -viewHeight / 2;
        camera.position.set(
          camera.userData.centerX + 2,
          camera.userData.bottomY + viewHeight / 2,
          camera.userData.centerZ,
        );
        camera.lookAt(
          camera.userData.centerX,
          camera.userData.bottomY + viewHeight / 2,
          camera.userData.centerZ,
        );
        camera.updateProjectionMatrix();

        if (groundLine) {
          groundLine.geometry.dispose();
          groundLine.geometry = new BufferGeometry().setFromPoints([
            new Vector3(camera.userData.centerX, camera.userData.groundY, camera.userData.centerZ - viewHeight * aspect / 2),
            new Vector3(camera.userData.centerX, camera.userData.groundY, camera.userData.centerZ + viewHeight * aspect / 2),
          ]);
        }
        renderer.render(scene, camera);
      };
      renderRef.current = render;

      resizeObserver = new ResizeObserver(render);
      resizeObserver.observe(container);

      const manager = new LoadingManager();
      manager.onLoad = () => {
        if (cancelled) return;

        const robot = robotRef.current;
        if (!robot) return;

        robot.traverse((object) => {
          if (object.isURDFVisual) {
            const linkName = object.parent?.urdfName;
            object.visible = VISIBLE_LINKS.has(linkName);
            if (FRAME_LINKS.has(linkName)) {
              object.traverse((visualPart) => {
                if (visualPart.material?.color) {
                  visualPart.material.color.set("#667085");
                }
              });
            }
          }
        });

        const frontArmJoint = robot.joints.front_arm_joint;
        const rearArmJoint = robot.joints.rear_arm_joint;
        if (!frontArmJoint || !rearArmJoint) {
          setModelError("The robot model is missing its drum arm joints.");
          setModelLoading(false);
          return;
        }

        frontArmJoint.ignoreLimits = true;
        rearArmJoint.ignoreLimits = true;
        const bounds = new Box3();
        let lowestDrumY = Infinity;
        const setArmPositions = (position) => {
          const kinematics = calculateDrumKinematics(position);
          const jointAngle = kinematics
            ? toModelJointAngle(kinematics)
            : RESTING_JOINT_ANGLE;
          robot.setJointValues({
            front_arm_joint: jointAngle,
            rear_arm_joint: jointAngle,
          });
          robotGroup.updateMatrixWorld(true);
        };

        for (let index = 0; index <= ACTUATOR_SAMPLES; index += 1) {
          const position = (MAX_ACTUATOR_POSITION * index) / ACTUATOR_SAMPLES;
          setArmPositions(position);
          MODEL_LINKS.forEach((name) => bounds.expandByObject(robot.links[name]));
          DRUM_LINKS.forEach((name) => {
            const drumBounds = new Box3().setFromObject(robot.links[name]);
            lowestDrumY = Math.min(lowestDrumY, drumBounds.min.y);
          });
        }

        const wheelBounds = new Box3();
        [
          "front_left_wheel",
          "front_right_wheel",
          "rear_left_wheel",
          "rear_right_wheel",
        ].forEach((name) => wheelBounds.expandByObject(robot.links[name]));
        if (bounds.isEmpty() || wheelBounds.isEmpty() || !Number.isFinite(lowestDrumY)) {
          setModelError("The robot model is missing its frame, wheels, or drums.");
          setModelLoading(false);
          return;
        }

        camera.userData.bottomY = lowestDrumY;
        camera.userData.groundY = wheelBounds.min.y;
        camera.userData.centerX = (bounds.min.x + bounds.max.x) / 2;
        camera.userData.centerZ = (bounds.min.z + bounds.max.z) / 2;
        camera.userData.modelHeight = (bounds.max.y - lowestDrumY) * 1.08;
        camera.userData.modelWidth = (bounds.max.z - bounds.min.z) * 1.08;
        camera.up.set(0, 1, 0);
        groundLine = new Line(
          new BufferGeometry(),
          new LineBasicMaterial({ color: "#718096" }),
        );
        scene.add(groundLine);

        setModelLoading(false);
        setModelReady(true);
        render();
      };
      manager.onError = (url) => {
        console.error(`Failed to load robot model asset: ${url}`);
        if (!cancelled) {
          setModelError("A robot model mesh could not be loaded.");
          setModelLoading(false);
        }
      };

      const loader = new URDFLoader(manager);
      loader.packages = { startup: MODEL_PACKAGE_PATH };

      fetch(MODEL_URL)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load robot URDF (${response.status}).`);
          }
          return response.text();
        })
        .then((urdf) => {
          if (cancelled) return;
          const robot = loader.parse(urdf);
          robotRef.current = robot;
          robotGroup.add(robot);
          render();
        })
        .catch((error) => {
          if (cancelled) return;
          console.error("Failed to load the robot URDF.", error);
          setModelError("The robot model could not be loaded.");
          setModelLoading(false);
        });
    } catch (error) {
      console.error("Failed to initialize the robot model viewer.", error);
      setModelError("The robot model viewer could not be initialized.");
      setModelLoading(false);
    }

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      renderRef.current = null;
      robotRef.current = null;
      renderer?.dispose();
      groundLine?.geometry.dispose();
      groundLine?.material.dispose();
      robotGroup?.traverse((object) => {
        object.geometry?.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      container.replaceChildren();
    };
  }, []);

  useEffect(() => {
    if (!modelReady || !robotRef.current) return;

    const frontPosition = calculateDrumKinematics(frontActuatorPosition);
    const rearPosition = calculateDrumKinematics(rearActuatorPosition);
    robotRef.current.setJointValues({
      front_arm_joint: frontPosition ? toModelJointAngle(frontPosition) : RESTING_JOINT_ANGLE,
      rear_arm_joint: rearPosition ? toModelJointAngle(rearPosition) : RESTING_JOINT_ANGLE,
    });
    renderRef.current?.();
  }, [modelReady, frontActuatorPosition, rearActuatorPosition]);

  return (
    <section className="drum-visualizer" aria-label="Live drum position visualizer">
      <div className="drum-visualizer-heading">
        <h2>Drum position</h2>
        <span>Side view · paired drums move together</span>
      </div>
      <div className="drum-model-view" ref={modelContainerRef} />
      <div className="drum-visualizer-readings">
        {drums.map(({ key, label, color, position }) => (
          <div className="drum-reading" key={key}>
            <span className="drum-reading-label">
              <i style={{ backgroundColor: color }} />
              {label}
            </span>
            <span className="drum-reading-values">
              {formatValue(position?.angleDegrees)}° · {formatValue(position?.heightAboveGroundInches)} in above ground
            </span>
          </div>
        ))}
      </div>
      {(modelLoading || modelError || drums.some(({ position }) => !position)) && (
        <p className={modelError ? "drum-visualizer-status error" : "drum-visualizer-status"}>
          {modelError || (modelLoading
            ? "Loading robot model…"
            : "Waiting for valid actuator feedback")}
        </p>
      )}
    </section>
  );
}

export default DrumVisualizer;
