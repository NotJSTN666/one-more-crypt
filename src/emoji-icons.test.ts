import { describe, expect, it } from 'vitest';
import { EMOJI_ICON } from './emoji-icons';
import { ICON_NAMES, iconRows } from './pixel-icons';

describe('pixel icons', () => {
  it('are all 16 by 16', () => {
    for (const name of ICON_NAMES) {
      const rows = iconRows(name);
      expect(rows.length, name).toBe(16);
      for (const r of rows) expect(r.length, `${name}: ${r}`).toBe(16);
    }
  });

  it('every emoji maps to an icon that exists', () => {
    for (const [emoji, name] of Object.entries(EMOJI_ICON)) expect(ICON_NAMES, emoji).toContain(name);
  });
});
