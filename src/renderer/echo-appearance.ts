export interface TissueProperties {
  attenCoeff: number;
  baseBrightness: number;
  grainPx: number;
  speckleSigma: number;
}

export interface EchoSectorRenderParams {
  depthMm: number;
  heightPx: number;
  nearFieldMm: number;
  sectorAngleDeg: number;
  spacingMm: number;
  widthPx: number;
}

const BLOOD_POOL_PROPERTIES: TissueProperties = {
  attenCoeff: 0.1,
  baseBrightness: 12,
  grainPx: 1,
  speckleSigma: 6,
};

const MYOCARDIUM_PROPERTIES: TissueProperties = {
  attenCoeff: 0.5,
  baseBrightness: 150,
  grainPx: 3,
  speckleSigma: 25,
};

const HEART_COARSE_PROPERTIES: TissueProperties = {
  attenCoeff: 0.4,
  baseBrightness: 130,
  grainPx: 2,
  speckleSigma: 20,
};

const VALVE_PROPERTIES: TissueProperties = {
  attenCoeff: 0.12,
  baseBrightness: 220,
  grainPx: 1,
  speckleSigma: 5,
};

const ESOPHAGUS_PROPERTIES: TissueProperties = {
  attenCoeff: 0.6,
  baseBrightness: 90,
  grainPx: 2,
  speckleSigma: 15,
};

const LUNG_PROPERTIES: TissueProperties = {
  attenCoeff: 2.0,
  baseBrightness: 5,
  grainPx: 5,
  speckleSigma: 35,
};

const DEFAULT_PROPERTIES: TissueProperties = {
  attenCoeff: 0.3,
  baseBrightness: 60,
  grainPx: 2,
  speckleSigma: 15,
};

const VALVE_LABELS = new Set([20, 21, 22, 23]);
const RAYLEIGH_EPSILON = 1e-6;
const ATTENUATION_DEPTH_SCALE = 2.5;
const NEAR_FIELD_CLUTTER_SIGMA = 35;
const NEAR_FIELD_CLUTTER_GRAIN_PX = 2;
const NEAR_FIELD_CLUTTER_BIAS = 80;
const SPECKLE_MEAN_SCALE = Math.sqrt(Math.PI / 2);
const HASH_SEED = 0x9e3779b9;
const CLUTTER_HASH_SEED = 0x85ebca6b;

export const TISSUE_TABLE: Record<number, TissueProperties> = {
  1: BLOOD_POOL_PROPERTIES,
  2: BLOOD_POOL_PROPERTIES,
  3: BLOOD_POOL_PROPERTIES,
  4: BLOOD_POOL_PROPERTIES,
  5: ESOPHAGUS_PROPERTIES,
  6: LUNG_PROPERTIES,
  7: HEART_COARSE_PROPERTIES,
  11: BLOOD_POOL_PROPERTIES,
  12: BLOOD_POOL_PROPERTIES,
  13: BLOOD_POOL_PROPERTIES,
  14: BLOOD_POOL_PROPERTIES,
  15: MYOCARDIUM_PROPERTIES,
  16: BLOOD_POOL_PROPERTIES,
  17: BLOOD_POOL_PROPERTIES,
  20: VALVE_PROPERTIES,
  21: VALVE_PROPERTIES,
  22: VALVE_PROPERTIES,
  23: VALVE_PROPERTIES,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const clampToByte = (value: number): number => Math.round(clamp(value, 0, 255));

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }

  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const isValveLabel = (labelId: number): boolean => VALVE_LABELS.has(labelId);

const hashToUnitFloat = (x: number, y: number, seed: number): number => {
  let hash = Math.imul(x ^ HASH_SEED, 0x27d4eb2d);
  hash ^= Math.imul(y ^ seed, 0x165667b1);
  hash = Math.imul(hash ^ (hash >>> 15), hash | 1);
  hash ^= hash + Math.imul(hash ^ (hash >>> 7), hash | 61);
  return ((hash ^ (hash >>> 14)) >>> 0) / 4294967296;
};

const sampleRayleigh = (uniform: number, sigma: number): number => {
  const clamped = clamp(uniform, RAYLEIGH_EPSILON, 1 - RAYLEIGH_EPSILON);
  return sigma * Math.sqrt(-2 * Math.log(1 - clamped));
};

const sampleSpeckle = (
  column: number,
  row: number,
  grainPx: number,
  sigma: number,
  labelId: number,
  seed: number,
): number => {
  if (sigma <= 0) {
    return 0;
  }

  const quantizedColumn = Math.floor(column / Math.max(1, grainPx));
  const quantizedRow = Math.floor(row / Math.max(1, grainPx));
  const uniform = hashToUnitFloat(
    quantizedColumn ^ labelId,
    quantizedRow ^ (labelId << 4),
    seed,
  );
  return sampleRayleigh(uniform, sigma) - sigma * SPECKLE_MEAN_SCALE;
};

const getTissueProperties = (labelId: number): TissueProperties =>
  TISSUE_TABLE[labelId] ?? DEFAULT_PROPERTIES;

const getBoundaryBoost = (
  labels: ArrayLike<number>,
  column: number,
  row: number,
  width: number,
  height: number,
): number => {
  const centerLabel = Number(labels[row * width + column]);
  if (centerLabel === 0) {
    return 0;
  }

  let boost = 0;
  const updateBoost = (neighborLabel: number): void => {
    if (neighborLabel === 0 || neighborLabel === centerLabel) {
      return;
    }

    boost = Math.max(
      boost,
      isValveLabel(centerLabel) || isValveLabel(neighborLabel) ? 120 : 90,
    );
  };

  if (column > 0) {
    updateBoost(Number(labels[row * width + column - 1]));
  }
  if (column < width - 1) {
    updateBoost(Number(labels[row * width + column + 1]));
  }
  if (row > 0) {
    updateBoost(Number(labels[(row - 1) * width + column]));
  }
  if (row < height - 1) {
    updateBoost(Number(labels[(row + 1) * width + column]));
  }

  return boost;
};

export const renderEchoSector = (
  labelData: ArrayLike<number>,
  output: Uint8Array,
  params: EchoSectorRenderParams,
): void => {
  const { depthMm, heightPx, nearFieldMm, sectorAngleDeg, spacingMm, widthPx } = params;
  const halfSectorRad = (sectorAngleDeg * Math.PI) / 360;
  const centerX = widthPx / 2;

  output.fill(0);

  let flatIndex = 0;
  for (let row = 0; row < heightPx; row += 1) {
    const axialDepthMm = (row + 0.5) * spacingMm;

    for (let column = 0; column < widthPx; column += 1, flatIndex += 1) {
      const lateralMm = (column + 0.5 - centerX) * spacingMm;
      const radiusMm = Math.hypot(lateralMm, axialDepthMm);
      const angularOffset = Math.abs(Math.atan2(lateralMm, Math.max(axialDepthMm, 1e-4)));
      const withinSector =
        axialDepthMm >= nearFieldMm &&
        axialDepthMm <= depthMm &&
        radiusMm <= depthMm &&
        angularOffset <= halfSectorRad;

      if (!withinSector) {
        continue;
      }

      const labelId = Number(labelData[flatIndex]);
      if (labelId === 0) {
        continue;
      }

      const properties = getTissueProperties(labelId);
      const speckle = sampleSpeckle(
        column,
        row,
        properties.grainPx,
        properties.speckleSigma,
        labelId,
        HASH_SEED,
      );
      let pixel = properties.baseBrightness + speckle;

      pixel += getBoundaryBoost(labelData, column, row, widthPx, heightPx);

      const depthNorm = clamp(axialDepthMm / Math.max(depthMm, 1), 0, 1);
      const tgcGain = 1 + 1.2 * depthNorm;
      const attenuation = Math.exp(-properties.attenCoeff * depthNorm * ATTENUATION_DEPTH_SCALE);
      pixel *= tgcGain * attenuation;

      if (axialDepthMm < nearFieldMm + 8) {
        const clutterWeight = 1 - smoothstep(nearFieldMm, nearFieldMm + 8, axialDepthMm);
        const clutter =
          NEAR_FIELD_CLUTTER_BIAS +
          Math.max(
            0,
            sampleSpeckle(
              column,
              row,
              NEAR_FIELD_CLUTTER_GRAIN_PX,
              NEAR_FIELD_CLUTTER_SIGMA,
              labelId,
              CLUTTER_HASH_SEED,
            ),
          );
        pixel = pixel * (1 - clutterWeight) + clutter * clutterWeight;
      }

      const angleNorm = clamp(angularOffset / Math.max(halfSectorRad, 1e-4), 0, 1);
      const radialNorm = clamp(radiusMm / Math.max(depthMm, 1), 0, 1);
      const edgeFeather = 1 - smoothstep(0.86, 1, Math.max(angleNorm, radialNorm));

      output[flatIndex] = clampToByte(pixel * edgeFeather);
    }
  }
};
