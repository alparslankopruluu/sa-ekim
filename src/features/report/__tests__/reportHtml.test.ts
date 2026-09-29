import { buildReportHtml, escapeHtml, isSafeImageDataUri, type ReportModel } from '../reportHtml';

const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';

function model(overrides: Partial<ReportModel> = {}): ReportModel {
  return {
    lang: 'en',
    dir: 'ltr',
    brand: 'Kök',
    title: 'Progress record',
    clinicLine: 'Clinic: Acme',
    operationLine: 'Operation date: 1 Sep 2026',
    generatedLine: 'Created 29 Sep 2026',
    photosHeading: 'Photos',
    noPhotosText: 'No photos yet.',
    sections: [
      {
        title: 'Front',
        photos: [
          { dataUri: JPEG, label: 'Before', dateText: '30 Aug 2026' },
          { dataUri: JPEG, label: 'Week 4', dateText: '28 Sep 2026' },
        ],
      },
    ],
    shedHeading: 'Shed log',
    shedColumns: { week: 'Week', days: 'Days logged', average: 'Average', max: 'Highest' },
    shedRows: [{ weekLabel: 'Week 3', days: '5', average: '31', max: '48' }],
    shedEmptyText: 'No shed entries.',
    disclaimer: 'Personal progress record — not a medical document',
    ...overrides,
  };
}

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;',
    );
  });

  it('leaves plain and non-latin text alone', () => {
    expect(escapeHtml('Saç ekimi 12. hafta — زراعة')).toBe('Saç ekimi 12. hafta — زراعة');
  });

  it('escapes ampersands first so entities are not double-decoded', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
});

describe('isSafeImageDataUri', () => {
  it('accepts base64 jpeg/png data uris only', () => {
    expect(isSafeImageDataUri(JPEG)).toBe(true);
    expect(isSafeImageDataUri('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isSafeImageDataUri('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(isSafeImageDataUri('javascript:alert(1)')).toBe(false);
    expect(isSafeImageDataUri('https://example.com/a.jpg')).toBe(false);
    expect(isSafeImageDataUri('data:image/jpeg;base64,abc"onerror="x')).toBe(false);
    expect(isSafeImageDataUri('')).toBe(false);
  });
});

describe('buildReportHtml', () => {
  it('always carries the disclaimer, the title and the sections', () => {
    const html = buildReportHtml(model());
    expect(html).toContain('Personal progress record — not a medical document');
    expect(html).toContain('Progress record');
    expect(html).toContain('Front');
    expect(html).toContain('Before');
    expect(html).toContain('Week 4');
    expect(html).toContain(JPEG);
    expect(html).toContain('Week 3');
    expect(html).toContain('<table');
  });

  it('escapes every free-text value, including the clinic name', () => {
    const html = buildReportHtml(
      model({ clinicLine: 'Clinic: <img src=x onerror=alert(1)>', title: 'A & B', operationLine: '"quoted"' }),
    );
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('A &amp; B');
    expect(html).toContain('&quot;quoted&quot;');
  });

  it('drops an unsafe image instead of embedding it', () => {
    const html = buildReportHtml(
      model({
        sections: [
          { title: 'Front', photos: [{ dataUri: 'javascript:alert(1)', label: 'Before', dateText: '1 Sep' }] },
        ],
      }),
    );
    expect(html).not.toContain('javascript:');
    expect(html).toContain('Before');
  });

  it('shows the empty texts when there is nothing to report', () => {
    const html = buildReportHtml(model({ sections: [], shedRows: [] }));
    expect(html).toContain('No photos yet.');
    expect(html).toContain('No shed entries.');
    expect(html).not.toContain('<table');
  });

  it('sets language and direction, rejecting anything else', () => {
    expect(buildReportHtml(model({ lang: 'ar', dir: 'rtl' }))).toContain('<html lang="ar" dir="rtl">');
    expect(buildReportHtml(model({ lang: 'en" onload="x' }))).toContain('<html lang="en" dir="ltr">');
  });

  it('makes no medical conclusions: no verdict words in the template', () => {
    const html = buildReportHtml(model({ sections: [], shedRows: [] })).toLowerCase();
    for (const word of ['diagnos', 'success', 'failed', 'healthy', 'graft']) {
      expect(html).not.toContain(word);
    }
  });
});
