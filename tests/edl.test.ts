import { describe, expect, it } from 'vitest';
import { buildEDL } from '../src/core/edl';
import { getFrameRate } from '../src/core/timecode';

describe('buildEDL', () => {
  it('writes a CMX3600 EDL with locators and a start offset', () => {
    const edl = buildEDL(
      [
        { source: 2, start: 0, end: 75, text: 'Hello world' },
        { source: 3, start: 75, end: 200, text: 'Second\nline' },
      ],
      { title: 'My Show', rate: getFrameRate('25'), offset: 90000, color: 'BLUE' },
    );

    expect(edl).toBe(
      [
        'TITLE: My Show',
        'FCM: NON-DROP FRAME',
        '',
        '001  AX       V     C        01:00:00:00 01:00:03:00 01:00:00:00 01:00:03:00',
        '* FROM CLIP NAME: Hello world',
        '* LOC: 01:00:00:00 BLUE    Hello world',
        '',
        '002  AX       V     C        01:00:03:00 01:00:08:00 01:00:03:00 01:00:08:00',
        '* FROM CLIP NAME: Second line',
        '* LOC: 01:00:03:00 BLUE    Second line',
        '',
      ].join('\n'),
    );
  });

  it('uses DROP FRAME and semicolons for drop-frame rates', () => {
    const edl = buildEDL([{ source: 1, start: 1800, end: 1900, text: 'x' }], {
      title: '',
      rate: getFrameRate('29.97df'),
      offset: 0,
      color: 'RED',
    });
    expect(edl).toContain('TITLE: Untitled');
    expect(edl).toContain('FCM: DROP FRAME');
    expect(edl).toContain('00:01:00;02 00:01:03;12');
  });
});
