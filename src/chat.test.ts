import { describe, expect, it } from 'vitest';
import { chatProblem, rude, tidyChat } from './chat-filter';

describe('chat filter', () => {
  it('lets ordinary talk through', () => {
    for (const t of ['gg everyone', 'Death got me on floor 151', 'I passed the assassin', 'the cockatrice is rough', 'class assist pistol', 'good night', 'as if', 'Hello from Nigeria', 'Scunthorpe? no, I live in Essex', 'this hit hard'])
      expect(chatProblem(t), t).toBeNull();
  });
  it('blocks swearing, however it is spelled', () => {
    for (const t of ['fuck this', 'FUUUCK', 'f u c k', 'sh1t', 'what a b!tch', 'you ass', 'a$$hole', 'kys', 'motherfucker', 'f.u.c.k'])
      expect(rude(t), t).toBe(true);
  });
  it('blocks links', () => {
    expect(chatProblem('join discord.gg/abc')).toMatch(/links/);
    expect(chatProblem('see https://x.y')).toMatch(/links/);
    expect(chatProblem('free gems at scam.xyz')).toMatch(/links/);
  });
  it('tidies spam and limits length', () => {
    expect(tidyChat('  hiiiiiiii   there  ')).toBe('hiii there');
    expect(chatProblem('   ')).toBeTruthy();
    expect(chatProblem('a'.repeat(5) + ' b'.repeat(120))).toMatch(/under/);
  });
});
