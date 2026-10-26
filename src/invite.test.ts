import { describe, expect, it } from 'vitest';
import { auraUnlocked, headUnlocked, lookUnlocked, meta, noteFriends, noteInvitedBy, settleInvite, titleUnlocked } from './meta';
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
    expect(noteFriends(3)).toBe(3);
    expect(noteFriends(3)).toBe(0);
    expect(lookUnlocked(LOOK_BY_ID.kindred)).toBe(true);
    expect(auraUnlocked(AURA_BY_ID.kindredflame)).toBe(true);
    expect(headUnlocked(HEAD_BY_ID.lanternhood)).toBe(false);
    noteFriends(10);
    expect(headUnlocked(HEAD_BY_ID.lanternhood)).toBe(true);
    expect(titleUnlocked('invite:10')).toBe(true);
  });

  it('forgets an invite that cannot count', () => {
    meta.invite = { from: 'Nobody', claimed: false, friends: 0 };
    settleInvite(false);
    expect(meta.invite).toEqual({ from: '', claimed: false, friends: 0 });
  });
});
