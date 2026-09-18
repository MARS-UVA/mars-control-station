import { useCallback, useEffect, useRef, useState } from "react";
import { Topic } from "roslib";

const KEY_MAP = {
  KeyW: "w",
  KeyA: "a",
  KeyS: "s",
  KeyD: "d",
};

function stickFromKeys(keys) {
  const x = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  const y = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
  const mag = Math.hypot(x, y);
  if (mag > 1) {
    return { x: x / mag, y: y / mag };
  }
  return { x, y };
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function useGamepadPublisher(ros) {
  const publisherRef = useRef(null);
  const keysRef = useRef({ w: false, a: false, s: false, d: false });
  const [leftStick, setLeftStick] = useState({ x: 0, y: 0 });
  const [gamepadName, setGamepadName] = useState(null);
  const [wasdActive, setWasdActive] = useState(false);

  useEffect(() => {
    if (!ros) return;

    publisherRef.current = new Topic({
      ros,
      name: "/gamepad_state",
      messageType: "teleop_msgs/msg/GamepadState",
    });

    return () => {
      publisherRef.current = null;
    };
  }, [ros]);

  const publish = useCallback((x, y) => {
    publisherRef.current?.publish({
      left_stick: { x, y },
    });
  }, []);

  const applyStick = useCallback(
    (x, y) => {
      setLeftStick({ x, y });
      publish(x, y);
    },
    [publish],
  );

  const releaseStick = useCallback(() => {
    applyStick(0, 0);
  }, [applyStick]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = KEY_MAP[event.code];
      if (!key || isTypingTarget(event.target) || event.repeat) return;
      event.preventDefault();
      keysRef.current = { ...keysRef.current, [key]: true };
      const stick = stickFromKeys(keysRef.current);
      setWasdActive(true);
      applyStick(stick.x, stick.y);
    };

    const onKeyUp = (event) => {
      const key = KEY_MAP[event.code];
      if (!key) return;
      keysRef.current = { ...keysRef.current, [key]: false };
      const stick = stickFromKeys(keysRef.current);
      const anyHeld = Object.values(keysRef.current).some(Boolean);
      setWasdActive(anyHeld);
      applyStick(stick.x, stick.y);
    };

    const onBlur = () => {
      keysRef.current = { w: false, a: false, s: false, d: false };
      setWasdActive(false);
      applyStick(0, 0);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [applyStick]);

  useEffect(() => {
    const onConnected = (event) => {
      setGamepadName(event.gamepad.id);
    };

    window.addEventListener("gamepadconnected", onConnected);

    const interval = window.setInterval(() => {
      if (Object.values(keysRef.current).some(Boolean)) {
        const stick = stickFromKeys(keysRef.current);
        applyStick(stick.x, stick.y);
        return;
      }

      const gamepads = navigator.getGamepads?.() ?? [];
      const gp = gamepads[0];
      if (!gp) return;

      const x = gp.axes[0] ?? 0;
      const y = -(gp.axes[1] ?? 0);
      applyStick(x, y);
    }, 100);

    return () => {
      window.removeEventListener("gamepadconnected", onConnected);
      window.clearInterval(interval);
    };
  }, [applyStick]);

  return { leftStick, applyStick, releaseStick, gamepadName, wasdActive };
}
