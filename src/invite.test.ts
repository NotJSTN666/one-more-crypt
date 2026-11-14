import { describe, expect, it } from 'vitest';
import { INVITE_PETS, INVITE_SOULS, auraUnlocked, headUnlocked, lookUnlocked, meta, noteFriends, noteInvitedBy, settleInvite, titleUnlocked } from './meta';
import { AURA_BY_ID, HEAD_BY_ID, LOOK_BY_ID } from './progression';

describe('bring a friend', () => {
  it('gives the invited friend the Kindred Cloak once their run counts', () => {
    meta.vault = false;
    meta.invite = { from: '', claimed: false, friends: 0 };
    noteInvitedBy('JSTN');
    noteInvitedBy('Someone else');
    expect(meta.invite.from).toBe('JSTN');
    expect(lookUnlocked(LOOK_BY_ID.kindred)).toBe(false);
    settleInvite(true);
    expect(lookUnlocked(LOOK_BY_ID.kindred)).toBe(true);
    expect(auraUnlocked(AURA_BY_ID.kindredflame)).toBe(false);
  });

  it('pays the inviter more for every few friends brought', () => {
    meta.vault = false;
    meta.invite = { from: '', claimed: false, friends: 0 };
    expect(noteFriends(3).fresh).toBe(3);
    expect(noteFriends(3).fresh).toBe(0);
    expect(lookUnlocked(LOOK_BY_ID.kindred)).toBe(true);
    expect(auraUnlocked(AURA_BY_ID.kindredflame)).toBe(true);
    expect(headUnlocked(HEAD_BY_ID.lanternhood)).toBe(false);
    noteFriends(10);
    expect(headUnlocked(HEAD_BY_ID.lanternhood)).toBe(true);
    expect(titleUnlocked('invite:10')).toBe(true);
  });

  it('pays both sides Souls and a random companion, once per friend', () => {
    meta.invite = { from: 'JSTN', claimed: false, friends: 0 };
    meta.pets = [];
    meta.pet = '';
    const souls = meta.souls;
    // the invited friend: paid once, however often it settles
    const mine = settleInvite(true);
    expect(mine.souls).toBe(INVITE_SOULS);
    expect(mine.pets).toHaveLength(1);
    expect(meta.pet).toBe(mine.pets[0].id);
    expect(settleInvite(true)).toEqual({ souls: 0, pets: [] });
    expect(meta.souls).toBe(souls + INVITE_SOULS);
    // the inviter: each new friend pays, and companions never repeat or run past the set
    const { gain } = noteFriends(2);
    expect(gain.souls).toBe(2 * INVITE_SOULS);
    expect(new Set(meta.pets).size).toBe(3);
    noteFriends(6);
    expect(meta.pets.slice().sort()).toEqual(INVITE_PETS.map((p) => p.id).sort());
    expect(noteFriends(6).gain).toEqual({ souls: 0, pets: [] });
  });

  it('forgets an invite that cannot count', () => {
    meta.invite = { from: 'Nobody', claimed: false, friends: 0 };
    settleInvite(false);
    expect(meta.invite).toEqual({ from: '', claimed: false, friends: 0 });
  });
});
