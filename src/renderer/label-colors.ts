export type LabelColor = readonly [number, number, number];

export const LABEL_OVERLAY_ALPHA = 0.4;

export const LABEL_COLOR_TABLE: Record<number, LabelColor> = {
  // TotalSegmentator 'total' task labels
  1: [255, 215, 0],     // aorta → gold
  2: [180, 50, 180],    // pulmonary vein → purple
  3: [0, 100, 200],     // SVC → blue
  4: [0, 100, 200],     // IVC → blue
  5: [100, 180, 100],   // esophagus → green
  6: [80, 80, 80],      // lung → gray
  7: [200, 60, 60],     // heart (coarse) → red

  // heartchambers_highres labels (academic license)
  11: [220, 40, 40],    // LV cavity → red
  12: [40, 100, 220],   // RV cavity → blue
  13: [255, 120, 120],  // LA cavity → pink
  14: [100, 200, 255],  // RA cavity → light blue
  15: [180, 140, 100],  // myocardium → tan/brown
  16: [255, 200, 0],    // aorta (highres) → bright gold
  17: [160, 60, 200],   // pulmonary artery (highres) → violet
  20: [255, 255, 200],  // mitral valve → bright white-yellow
  21: [255, 255, 180],  // aortic valve → bright white-yellow
  22: [255, 255, 200],  // tricuspid valve → bright white-yellow
  23: [255, 255, 180],  // pulmonic valve → bright white-yellow
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
