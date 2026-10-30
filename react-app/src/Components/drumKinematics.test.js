import { calculateDrumKinematics } from "./drumKinematics";

describe("calculateDrumKinematics", () => {
  it("calculates arm angle and drum position from actuator feedback", () => {
    const position = calculateDrumKinematics(0.2);

    expect(position).not.toBeNull();
    expect(position.angleDegrees).toBeCloseTo(58.3, 0);
    expect(position.horizontalOffsetInches).toBeGreaterThan(0);
    expect(position.verticalOffsetInches).toBeGreaterThan(0);
  });

  it("returns no position for invalid or out-of-range actuator readings", () => {
    expect(calculateDrumKinematics(undefined)).toBeNull();
    expect(calculateDrumKinematics(Number.NaN)).toBeNull();
    expect(calculateDrumKinematics(2)).toBeNull();
  });
});
