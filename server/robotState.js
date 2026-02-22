let isPaused = false;
let isDigging = false;
let isDumping = false;
let isStopped = false;

export function getPausedState() {
    return isPaused;
}
export function getDigState() {
    return isDigging;
}
export function getDumpState() {
    return isDumping;
}
export function getStopState() {
    return isStopped;
}

export function setPausedState(input) {
    if (input instanceof Boolean) {
        isPaused = input;
    }
}
export function setDigState(input) {
    if (input instanceof Boolean) {
        isDigging = input;
    }
}
export function setDumpState(input) {
    if (input instanceof Boolean) {
        isDumping = input;
    }
}
export function setStopState(input) {
    if (input instanceof Boolean) {
        isStopped = input;
    }
}

export function getRobotState() {
    return {
        pause: isPaused,
        currentState : curState
    }
}
export var curState = ROBOT_STATES.IDLE;


export const ROBOT_STATES = Object.freeze({
    IDLE,
    DIG,
    DUMP,
    STOP
});