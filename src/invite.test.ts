import { describe, expect, it } from 'vitest';
import { INVITE_PETS, INVITE_SOULS, PYRE_GOAL, acceptPlayerGift, buyPet, claimPyreHound, giftables, notePyre, pyreEvent, auraUnlocked, headUnlocked, lookUnlocked, meta, noteFriends, noteInvitedBy, settleInvite, titleUnlocked } from './meta';
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

  it('sells companions for Souls, once each, and never the ones friends bring', () => {
    meta.pets = [];
    meta.pet = '';
    meta.souls = 2000;
    expect(buyPet('bat')).toBe(false);
    expect(buyPet('lich')).toBe(false);
    expect(buyPet('ghoulpup')).toBe(true);
    expect(meta.souls).toBe(500);
    expect(meta.pet).toBe('ghoulpup');
    expect(buyPet('ghoulpup')).toBe(false);
    expect(meta.pets).toEqual(['ghoulpup']);
  });

  it('takes a gift from another player as if bought, or as Souls when already owned', () => {
    meta.vault = false;
    const all = giftables();
    expect(all.length).toBeGreaterThan(10);
    // every item is one the server will accept
    for (const g of all) expect(g.item).toMatch(/^p:(look|head|aura|pet):[a-z0-9]{1,24}$/);
    const cloak = all.find((g) => g.kind === 'look')!;
    meta.bought = meta.bought.filter((id) => id !== cloak.id);
    const souls = meta.souls;
    expect(acceptPlayerGift(cloak.item)).toEqual({ gift: cloak, refund: 0 });
    expect(meta.bought).toContain(cloak.id);
    expect(acceptPlayerGift(cloak.item)!.refund).toBe(Math.floor(cloak.cost / 2));
    expect(meta.souls).toBe(souls + Math.floor(cloak.cost / 2));
    const pet = all.find((g) => g.kind === 'pet')!;
    meta.pets = [];
    acceptPlayerGift(pet.item);
    expect(meta.pets).toEqual([pet.id]);
    expect(acceptPlayerGift('p:look:nosuchthing')).toBeNull();
    expect(acceptPlayerGift('exterminator')).toBeNull();
  });

  it('gives the Pyre Hound to those who fed a pyre that filled, and titles for giving', () => {
    meta.vault = false;
    meta.pyre = {};
    meta.pets = [];
    const event = pyreEvent(Date.UTC(2026, 10, 14));
    expect(event).toBe('2026-11');
    notePyre(event, 1200);
    notePyre(event, 800);
    expect(meta.pyre[event]).toBe(1200);
    expect(titleUnlocked('pyre:1000')).toBe(true);
    expect(titleUnlocked('pyre:10000')).toBe(false);
    expect(claimPyreHound(PYRE_GOAL - 1, 1200)).toBe(false);
    expect(claimPyreHound(PYRE_GOAL, 500)).toBe(false);
    expect(claimPyreHound(PYRE_GOAL, 1200)).toBe(true);
    expect(claimPyreHound(PYRE_GOAL, 1200)).toBe(false);
    expect(meta.pets).toEqual(['pyrehound']);
    // the hound is never one of the companions a friend brings
    expect(INVITE_PETS.some((p) => p.id === 'pyrehound')).toBe(false);
  });

  it('forgets an invite that cannot count', () => {
    meta.invite = { from: 'Nobody', claimed: false, friends: 0 };
    settleInvite(false);
    expect(meta.invite).toEqual({ from: '', claimed: false, friends: 0 });
  });
});
