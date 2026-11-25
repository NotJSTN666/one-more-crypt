import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testerAskDue } from './testers';
vi.mock('./ui', () => ({ calmMotion: () => true }));

describe('the Android tester card', () => {
  const now = Date.UTC(2026, 10, 25);
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v) });
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 14)', maxTouchPoints: 5 });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('waits for the second run', () => {
    expect(testerAskDue(false, 1, now)).toBe(false);
    expect(testerAskDue(false, 2, now)).toBe(true);
    expect(testerAskDue(false, 9, now)).toBe(true);
  });

  it('never shows on a portal', () => {
    expect(testerAskDue(true, 5, now)).toBe(false);
  });
});
