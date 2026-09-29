import { directionChange } from '../direction';

describe('directionChange', () => {
  it('needs no restart when the direction stays the same', () => {
    expect(directionChange('tr', false)).toEqual({ rtl: false, needsRestart: false });
    expect(directionChange('ar', true)).toEqual({ rtl: true, needsRestart: false });
  });

  it('needs a restart when switching into or out of Arabic', () => {
    expect(directionChange('ar', false)).toEqual({ rtl: true, needsRestart: true });
    expect(directionChange('en', true)).toEqual({ rtl: false, needsRestart: true });
  });
});
