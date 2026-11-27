import { describe, expect, it, vi } from 'vitest';

import { chatTime } from './chat-time';

describe('chat message times', () => {
  const now = new Date(2026, 10, 27, 15, 0);
  it('today is just the time', () => {
    expect(chatTime(new Date(2026, 10, 27, 9, 5).toISOString(), now)).not.toMatch(/Yesterday|Nov/);
  });
  it('yesterday says so', () => {
    expect(chatTime(new Date(2026, 10, 26, 23, 50).toISOString(), now)).toMatch(/^Yesterday /);
  });
  it('older messages show the date', () => {
    expect(chatTime(new Date(2026, 10, 20, 8, 0).toISOString(), now)).toMatch(/Nov 20/);
    expect(chatTime(new Date(2025, 11, 31, 8, 0).toISOString(), now)).toMatch(/2025/);
  });
});
