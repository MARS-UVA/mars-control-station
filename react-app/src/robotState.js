let isPaused = false;
let action = 0; // 0 = idle, 1 = dig, 2 = dump, 3 = stop



export const ROBOT_STATES = Object.freeze({
    IDLE: "IDLE",
    DIG: "DIG",
    DUMP: "DUMP",
    STOP: "STOP"
});


export function getPausedState() {
    return isPaused;
}
export function getActionState() {
    return action;
}
export function flipPausedState() {
    isPaused = !isPaused;
}
export function setActionState(input) {
    if (typeof input === 'number' && input >= 0 && input <= 3) {
        action = input;
    }
}

export function getRobotState() {
    return {
        pause: isPaused,
        action: action
    }
}
