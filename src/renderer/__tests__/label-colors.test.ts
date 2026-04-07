import { describe, expect, it } from 'vitest';

import {
  LABEL_COLOR_TABLE,
  LABEL_OVERLAY_ALPHA,
  blendLabelOverlay,
  getLabelColor,
} from '../label-colors';

describe('label color helpers', () => {
  it('exposes the authored structure colors', () => {
    expect(LABEL_COLOR_TABLE[1]).toEqual([255, 215, 0]);
    expect(LABEL_COLOR_TABLE[11]).toEqual([220, 40, 40]);
    expect(getLabelColor(99)).toBeNull();
  });

  it('blends label colors over grayscale CT output', () => {
    expect(blendLabelOverlay(100, 11, LABEL_OVERLAY_ALPHA)).toEqual([148, 76, 76]);
    expect(blendLabelOverlay(80, 3, LABEL_OVERLAY_ALPHA)).toEqual([48, 88, 128]);
    expect(blendLabelOverlay(120, 0, LABEL_OVERLAY_ALPHA)).toEqual([120, 120, 120]);
  });
});
