export type Vec3 = readonly [number, number, number];
export type Mat4 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

const EPSILON = 1e-8;

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

const scale = (value: Vec3, factor: number): Vec3 => [
  value[0] * factor,
  value[1] * factor,
  value[2] * factor,
];

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const length = (value: Vec3): number => Math.sqrt(dot(value, value));

const normalize = (value: Vec3): Vec3 => {
  const valueLength = length(value);

  if (valueLength <= EPSILON) {
    return [0, 0, 0];
  }

  return scale(value, 1 / valueLength);
};

const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const identity = (): Mat4 => [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

const multiply = (a: Mat4, b: Mat4): Mat4 => {
  const out = new Array<number>(16).fill(0);

  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] =
        a[row] * b[column * 4] +
        a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] +
        a[12 + row] * b[column * 4 + 3];
    }
  }

  return [
    out[0], out[1], out[2], out[3],
    out[4], out[5], out[6], out[7],
    out[8], out[9], out[10], out[11],
    out[12], out[13], out[14], out[15],
  ];
};

const fromRotation = (axis: Vec3, angleRad: number): Mat4 => {
  const unitAxis = normalize(axis);
  const [x, y, z] = unitAxis;

  if (dot(unitAxis, unitAxis) <= EPSILON) {
    return identity();
  }

  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  const t = 1 - c;

  return [
    t * x * x + c,
    t * x * y + s * z,
    t * x * z - s * y,
    0,
    t * x * y - s * z,
    t * y * y + c,
    t * y * z + s * x,
    0,
    t * x * z + s * y,
    t * y * z - s * x,
    t * z * z + c,
    0,
    0,
    0,
    0,
    1,
  ];
};

const fromTranslation = (translation: Vec3): Mat4 => [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  translation[0], translation[1], translation[2], 1,
];

const transformPoint = (matrix: Mat4, point: Vec3): Vec3 => [
  matrix[0] * point[0] + matrix[4] * point[1] + matrix[8] * point[2] + matrix[12],
  matrix[1] * point[0] + matrix[5] * point[1] + matrix[9] * point[2] + matrix[13],
  matrix[2] * point[0] + matrix[6] * point[1] + matrix[10] * point[2] + matrix[14],
];

export const vec3 = {
  add,
  sub,
  cross,
  normalize,
  dot,
  scale,
  lerp,
};

export const mat4 = {
  identity,
  multiply,
  fromRotation,
  fromTranslation,
  transformPoint,
};

export const degToRad = (degrees: number): number => (degrees * Math.PI) / 180;

export const radToDeg = (radians: number): number => (radians * 180) / Math.PI;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);
