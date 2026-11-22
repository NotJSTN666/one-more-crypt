import { describe, expect, it } from 'vitest';
import { messageHref, messageText } from './share';

describe('Message button', () => {
  const r = { floor: 14, kills: 30, turns: 200, relics: '', killedBy: 'a ghoul' };
  it('dares a friend, with a tagged link', () => {
    const t = messageText(r, true);
    expect(t).toContain("floor 14 in today's One More Crypt Daily");
    expect(t).toMatch(/\?ref=sms$/);
  });
  it('opens Messages with the note filled in, on iPhone and Android', () => {
    const h = messageHref('Floor 14? Beat that & more');
    expect(h.startsWith('sms:?&body=')).toBe(true);
    expect(decodeURIComponent(h.slice('sms:?&body='.length))).toBe('Floor 14? Beat that & more');
  });
});
