/**
 * Reading sensor_msgs/PointCloud2 from rosbridge in the browser.
 */

// uint8[] arrives as a Uint8Array with CBOR; accept the other encodings
// rosbridge can produce too (same fallbacks as H264CameraPanel).
export function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (typeof data === 'string') return Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  if (Array.isArray(data)) return Uint8Array.from(data);
  if (data && data.buffer instanceof ArrayBuffer) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return null;
}

/**
 * Calls fn(x, y, z, view, base) for finite points, reading at most maxPoints
 * (every Nth point of a larger cloud, so the coverage stays even). fn may
 * return true to stop early. `view` and `base` let callers read other fields
 * (view.getUint32(base + field.offset, littleEndian)).
 * Returns false when the cloud has no x/y/z.
 */
export function forEachPoint(msg, maxPoints, fn) {
  const field = (name) => msg.fields.find((f) => f.name === name);
  const fx = field('x');
  const fy = field('y');
  const fz = field('z');
  const bytes = toBytes(msg.data);
  if (!fx || !fy || !fz || !bytes || !msg.point_step) return false;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const little = !msg.is_bigendian;
  const step = msg.point_step;
  const total = Math.min(msg.width * msg.height, Math.floor(bytes.byteLength / step));
  const stride = Math.max(1, Math.ceil(total / maxPoints));
  for (let i = 0; i < total; i += stride) {
    const base = i * step;
    const x = view.getFloat32(base + fx.offset, little);
    const y = view.getFloat32(base + fy.offset, little);
    const z = view.getFloat32(base + fz.offset, little);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    if (fn(x, y, z, view, base) === true) break;
  }
  return true;
}

export const POINT_CLOUD2_TYPE = 'sensor_msgs/msg/PointCloud2';
