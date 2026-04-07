export type LabelColor = readonly [number, number, number];

export const LABEL_OVERLAY_ALPHA = 0.4;

export const LABEL_COLOR_TABLE: Record<number, LabelColor> = {
  1: [255, 215, 0],
  2: [180, 50, 180],
  3: [0, 100, 200],
  4: [0, 100, 200],
  5: [100, 180, 100],
  6: [80, 80, 80],
  7: [200, 60, 60],
  11: [220, 40, 40],
  12: [40, 100, 220],
  13: [255, 120, 120],
  14: [100, 200, 255],
  15: [180, 140, 100],
};

const clampByte = (value: number): number => Math.round(Math.min(255, Math.max(0, value)));

export const getLabelColor = (labelId: number): LabelColor | null => LABEL_COLOR_TABLE[labelId] ?? null;

export const blendLabelOverlay = (
  grayscale: number,
  labelId: number,
  alpha = LABEL_OVERLAY_ALPHA,
): LabelColor => {
  const color = getLabelColor(labelId);
  if (!color) {
    return [grayscale, grayscale, grayscale];
  }

  const keep = 1 - alpha;
  return [
    clampByte(grayscale * keep + color[0] * alpha),
    clampByte(grayscale * keep + color[1] * alpha),
    clampByte(grayscale * keep + color[2] * alpha),
  ];
};
