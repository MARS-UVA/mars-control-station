// Tiny synchronous store for the direction state usable from non-React modules
let direction = false;

export function setDirection(value) {
  direction = !!value;
}

export function getDirection() {
  return direction;
}

export default {
  setDirection,
  getDirection,
};
