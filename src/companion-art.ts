// A companion's art: its creature's two idle frames, washed in its own colour when it has one.

import { COMPANION_BY_ID } from './companions';
import type { EnemyKind } from './game';
import { enemyFrames } from './sprites';

type Frame = { normal: HTMLCanvasElement; white: HTMLCanvasElement };
const cache = new Map<string, Frame[]>();

/** The two idle frames for a companion id ('hound' or anything unknown is the plain Crypt Hound). */
export function companionFrames(id: string): { frames: Frame[]; kind: EnemyKind; plainHound: boolean } {
  const def = COMPANION_BY_ID[id];
  const kind: EnemyKind = def?.kind ?? 'hound';
  const base = enemyFrames(kind).idle;
  if (!def?.tint) return { frames: base, kind, plainHound: !def };
  let frames = cache.get(id);
  if (!frames) {
    frames = base.map((f) => {
      const c = document.createElement('canvas');
      c.width = f.normal.width;
      c.height = f.normal.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(f.normal, 0, 0);
      // keep the shading, take the colour
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = def.tint!;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(f.normal, 0, 0);
      return { normal: c, white: f.white };
    });
    cache.set(id, frames);
  }
  return { frames, kind, plainHound: false };
}

const portraits = new Map<string, string>();

/** A still of the companion as an image address, for shop rows and cards. */
export function companionPortrait(id: string, scale = 3): string {
  const key = `${id}:${scale}`;
  let url = portraits.get(key);
  if (!url) {
    const img = companionFrames(id).frames[0].normal;
    const c = document.createElement('canvas');
    c.width = img.width * scale;
    c.height = img.height * scale;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    url = c.toDataURL();
    portraits.set(key, url);
  }
  return url;
}
