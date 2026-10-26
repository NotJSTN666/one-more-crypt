import { describe, expect, it } from 'vitest';
import { auraUnlocked, headUnlocked, lookUnlocked, meta, titleUnlocked } from './meta';
import { AURAS, AURA_BY_ID, HEADS, LOOKS, TITLES } from './progression';
import { QUESTS } from './story';

describe('story-only rewards', () => {
  it('unlock quest by quest, and the last aura and title need every quest', () => {
    meta.vault = false;
    meta.story.done = [];
    expect(lookUnlocked(LOOKS.find((l) => l.id === 'gravecoat')!)).toBe(false);
    meta.story.done = [1, 2, 3, 4];
    expect(lookUnlocked(LOOKS.find((l) => l.id === 'gravecoat')!)).toBe(true);
    expect(auraUnlocked(AURA_BY_ID.belltoll)).toBe(true);
    expect(auraUnlocked(AURA_BY_ID.wishingwell)).toBe(false);
    expect(titleUnlocked('story:2')).toBe(true);
    expect(auraUnlocked(AURA_BY_ID.gravesendlight)).toBe(false);
    expect(titleUnlocked('story:all')).toBe(false);
    meta.story.done = QUESTS.map((q) => q.n);
    expect(auraUnlocked(AURA_BY_ID.gravesendlight)).toBe(true);
    expect(titleUnlocked('story:all')).toBe(true);
    expect(headUnlocked(HEADS.find((h) => h.id === 'tavernkerchief')!)).toBe(true);
  });

  it('are never sold', () => {
    const story = [...LOOKS, ...HEADS, ...AURAS].filter((x) => x.unlock && 'story' in x.unlock);
    expect(story.length).toBeGreaterThanOrEqual(11);
    for (const x of story) expect('cost' in x.unlock!).toBe(false);
    expect(TITLES.filter((t) => t.id.startsWith('story:')).length).toBe(7);
  });
});
