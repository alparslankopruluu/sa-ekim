import { previewEquivalents } from '../credits';

describe('previewEquivalents', () => {
  it('converts credits into whole standard and HD previews', () => {
    expect(previewEquivalents(10)).toEqual({ standard: 10, high: 3 });
    expect(previewEquivalents(25)).toEqual({ standard: 25, high: 8 });
    expect(previewEquivalents(60)).toEqual({ standard: 60, high: 20 });
  });

  it('never returns negative or fractional values', () => {
    expect(previewEquivalents(2)).toEqual({ standard: 2, high: 0 });
    expect(previewEquivalents(0)).toEqual({ standard: 0, high: 0 });
    expect(previewEquivalents(-4)).toEqual({ standard: 0, high: 0 });
    expect(previewEquivalents(Number.NaN)).toEqual({ standard: 0, high: 0 });
    expect(previewEquivalents(7.9)).toEqual({ standard: 7, high: 2 });
  });
});
