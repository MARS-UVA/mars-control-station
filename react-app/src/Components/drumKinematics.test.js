import { calculateDrumKinematics, MAX_ACTUATOR_POSITION } from "./drumKinematics";

describe("calculateDrumKinematics", () => {
  it("calculates arm angle and drum position from actuator feedback", () => {
    const position = calculateDrumKinematics(0.2);

    expect(position).not.toBeNull();
    expect(position.angleDegrees).toBeCloseTo(58.3, 0);
    expect(position.horizontalOffsetInches).toBeGreaterThan(0);
    expect(position.verticalOffsetInches).toBeGreaterThan(0);
  });

  it("lowers the drums as the actuator extends, reaching the ground at full extension", () => {
    const raised = calculateDrumKinematics(0);
    const lowered = calculateDrumKinematics(MAX_ACTUATOR_POSITION);

    expect(raised.heightAboveGroundInches).toBeCloseTo(11.7, 0);
    expect(lowered.heightAboveGroundInches).toBeCloseTo(-1.4, 0);
    expect(lowered.angleDegrees).toBeLessThan(raised.angleDegrees);
  });

  it("returns no position for invalid or out-of-range actuator readings", () => {
    expect(calculateDrumKinematics(undefined)).toBeNull();
    expect(calculateDrumKinematics(Number.NaN)).toBeNull();
    expect(calculateDrumKinematics(2)).toBeNull();
  });
});
