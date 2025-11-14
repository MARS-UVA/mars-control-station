// === WebSocket Setup ===
const ws = new WebSocket('ws://localhost:3001');

ws.onopen = () => {
  console.log('WebSocket connected');
  ws.send(JSON.stringify({ type: 'init' }));
};

ws.onclose = () => {
  console.log('WebSocket disconnected');
};

// === Gamepad Tracking ===
let gamepads = navigator.getGamepads();

window.addEventListener('gamepadconnected', () => {
  console.log('Gamepad connected');
  gamepads = navigator.getGamepads();
});

window.addEventListener('gamepaddisconnected', () => {
  console.log('Gamepad disconnected');
  gamepads = navigator.getGamepads();
});

// === Utility: Browser Detection (optional) ===
function detectBrowser() {
  const ua = navigator.userAgent;
  if (/chrome|chromium|crios/i.test(ua)) return "Chrome";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua)) return "Safari";
  if (/msie|trident/i.test(ua)) return "Internet Explorer";
  if (/edge\/\d+/i.test(ua)) return "Microsoft Edge";
  if (/opera|opr/i.test(ua)) return "Opera";
  return "Unknown";
}

// === Input Parsing ===
function getButtonObjectFromGamepad(gp) {
  return {
    a: gp.buttons[0].value,
    b: gp.buttons[1].value,
    x: gp.buttons[2].value,
    y: gp.buttons[3].value,
    lb: gp.buttons[4].value,
    rb: gp.buttons[5].value,
    lt: gp.buttons[6].value,
    rt: gp.buttons[7].value,
    back: gp.buttons[8].value,
    start: gp.buttons[9].value,
    l3: gp.buttons[10].value,
    r3: gp.buttons[11].value,
    du: gp.buttons[12].value,
    dd: gp.buttons[13].value,
    dl: gp.buttons[14].value,
    dr: gp.buttons[15].value,
  };
}

function getLeftStickFromGamepad(gp) {
  return { x: gp.axes[0], y: -gp.axes[1] };
}

function getRightStickFromGamepad(gp) {
  return { x: gp.axes[2], y: -gp.axes[3] };
}

// === Overlay Coordinates ===
const buttonPositions = {
  a:  { x: 500, y: 280 },
  b:  { x: 540, y: 240 },
  x:  { x: 460, y: 240 },
  y:  { x: 500, y: 200 },

  du: { x: 220, y: 240 },
  dd: { x: 220, y: 300 },
  dl: { x: 180, y: 270 },
  dr: { x: 260, y: 270 },

  lb: { x: 140, y: 40 },
  rb: { x: 460, y: 40 },
  lt: { x: 140, y: 10 },
  rt: { x: 460, y: 10 },
  l3: { x: 180, y: 300 },
  r3: { x: 420, y: 340 },
};

const stickPositions = {
  leftStick: { x: 150, y: 220 },
  rightStick: { x: 420, y: 300 },
};

// === Gamepad State ===
function getGamepadState(index = 0) {
  const gp = navigator.getGamepads()[index];
  if (!gp) return null;
  return {
    leftStick: getLeftStickFromGamepad(gp),
    rightStick: getRightStickFromGamepad(gp),
    buttons: getButtonObjectFromGamepad(gp),
  };
}

// === Visual Overlay Updates ===
function updateButtonOverlays(buttons) {
  for (const [btn, value] of Object.entries(buttons)) {
    const overlay = document.getElementById(`button-${btn}`);
    const pos = buttonPositions[btn];
    if (!overlay || !pos) continue;

    overlay.style.left = `${pos.x}px`;
    overlay.style.top = `${pos.y}px`;
    overlay.style.backgroundColor = `rgba(255, 0, 0, ${0.3 + 0.7 * value})`;
  }
}

function updateStickOverlays(left, right) {
  const leftOverlay = document.getElementById('left-stick');
  const rightOverlay = document.getElementById('right-stick');

  if (leftOverlay) {
    leftOverlay.style.left = `${stickPositions.leftStick.x + left.x * 20}px`;
    leftOverlay.style.top = `${stickPositions.leftStick.y + left.y * 20}px`;
  }

  if (rightOverlay) {
    rightOverlay.style.left = `${stickPositions.rightStick.x + right.x * 20}px`;
    rightOverlay.style.top = `${stickPositions.rightStick.y + right.y * 20}px`;
  }
}

// === Polling Loop ===
setInterval(() => {
  const state = getGamepadState(0);
  if (!state) return;

  // Update on-screen overlays
  updateButtonOverlays(state.buttons);
  updateStickOverlays(state.leftStick, state.rightStick);

  // Send to server
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(state));
  }
}, 30);

export { getGamepadState };
