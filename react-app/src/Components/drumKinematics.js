const ACTUATOR_LENGTH_OFFSET_IN = 23.6224274544;
const ACTUATOR_POSITION_SCALE_IN = 12;
const LINKAGE_LENGTH_SQUARED_IN = 737.506048128;
const LINKAGE_COSINE_SCALE = -643.804738952;
const ARM_ANGLE_OFFSET_DEG = 142.920267719;
const ARM_LENGTH_IN = 12.0625;
const DRUM_OFFSET_IN = 2.015;
const DRUM_HEIGHT_OFFSET_IN = 1.75;

const degreesToRadians = (degrees) => (degrees * Math.PI) / 180;

export function calculateDrumKinematics(actuatorPosition) {
  if (!Number.isFinite(actuatorPosition)) return null;

  const actuatorLength = ACTUATOR_LENGTH_OFFSET_IN
    + ACTUATOR_POSITION_SCALE_IN * actuatorPosition;
  const cosine = (
    (actuatorLength ** 2 - LINKAGE_LENGTH_SQUARED_IN) / LINKAGE_COSINE_SCALE
  );
  if (cosine < -1 || cosine > 1) return null;

  const angleDegrees = ARM_ANGLE_OFFSET_DEG - (Math.acos(cosine) * 180) / Math.PI;
  const angleRadians = degreesToRadians(angleDegrees);

  return {
    angleDegrees,
    horizontalOffsetInches: (
      ARM_LENGTH_IN * Math.cos(angleRadians)
      + DRUM_OFFSET_IN * Math.sin(angleRadians)
    ),
    verticalOffsetInches: (
      ARM_LENGTH_IN * Math.sin(angleRadians)
      - DRUM_OFFSET_IN * Math.cos(angleRadians)
      - DRUM_HEIGHT_OFFSET_IN
    ),
  };
}
