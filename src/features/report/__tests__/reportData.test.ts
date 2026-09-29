import type { JourneyPhoto } from '@/stores/journey';

import { pickReportPhotos, shedWeekRows } from '../reportData';

const at = (iso: string) => new Date(`${iso}T12:00:00`).getTime();

function photo(id: string, angle: JourneyPhoto['angle'], iso: string): JourneyPhoto {
  return { id, uri: `file:///journey/${id}.jpg`, takenAt: at(iso), angle };
}

describe('pickReportPhotos', () => {
  it('takes the first and the latest photo per angle, in capture-angle order', () => {
    const photos = [
      photo('t1', 'top', '2026-09-05'),
      photo('f1', 'front', '2026-08-30'),
      photo('f2', 'front', '2026-09-10'),
      photo('f3', 'front', '2026-09-20'),
      photo('t2', 'top', '2026-09-25'),
    ];
    const picked = pickReportPhotos(photos);
    expect(picked.map((p) => p.angle)).toEqual(['front', 'top']);
    expect(picked[0]?.first.id).toBe('f1');
    expect(picked[0]?.last?.id).toBe('f3');
    expect(picked[1]?.first.id).toBe('t1');
    expect(picked[1]?.last?.id).toBe('t2');
  });

  it('has no "last" when an angle has a single photo', () => {
    const picked = pickReportPhotos([photo('f1', 'front', '2026-09-01')]);
    expect(picked).toHaveLength(1);
    expect(picked[0]?.last).toBeNull();
  });

  it('is empty without photos', () => {
    expect(pickReportPhotos([])).toEqual([]);
  });
});

describe('shedWeekRows', () => {
  const entries = [
    { date: '2026-09-15', count: 30 }, // day 14 -> week 3
    { date: '2026-09-16', count: 50 }, // day 15 -> week 3
    { date: '2026-09-22', count: 20 }, // day 21 -> week 4
    { date: '2026-08-30', count: 5 }, // before the operation: left out
  ];

  it('groups by week since the operation with days logged, average and highest', () => {
    const rows = shedWeekRows(entries, '2026-09-01');
    expect(rows).toEqual([
      { week: 3, days: 2, average: 40, max: 50 },
      { week: 4, days: 1, average: 20, max: 20 },
    ]);
  });

  it('gives one overall row when there is no operation date', () => {
    expect(shedWeekRows(entries, null)).toEqual([{ week: null, days: 4, average: 26, max: 50 }]);
  });

  it('is empty without entries', () => {
    expect(shedWeekRows([], '2026-09-01')).toEqual([]);
    expect(shedWeekRows([], null)).toEqual([]);
  });
});
