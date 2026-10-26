import { it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Game } from './game';
const FK = 'bcdefghijklmnopq';
it('turns per floor', () => {
  for (const n of [363, 393, 517]) {
    const r = JSON.parse(readFileSync('/tmp/claude-0/-home-user/47115b14-a826-58c7-81a2-2706267996c0/scratchpad/promo3/pages/run' + n + '.json', 'utf8'));
    const { config, inputs } = Game.parseLog(r.log);
    const g = new Game(r.mode ?? 'endless', r.seed, r.daily_no ?? 0, config);
    const moves: Record<string, [number, number]> = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0], W: [0, 0] };
    let f = g.floor, t0 = g.turns; const per: number[] = [];
    for (const ch of inputs) {
      if (g.phase === 'dead') break;
      if (moves[ch]) g.act(moves[ch][0], moves[ch][1]); else if (ch === 'r') g.choose(-1); else if (ch === 'a' || ch === 'x') g.resolveEvent(ch === 'a'); else if (FK.includes(ch)) g.forge(FK.indexOf(ch)); else g.choose(Number(ch));
      if (g.floor !== f) { if (f >= 150) per.push(g.turns - t0); f = g.floor; t0 = g.turns; }
    }
    per.sort((a, b) => a - b);
    const q = (p: number) => per[Math.floor(per.length * p)];
    console.log('RUN', n, 'floors', per.length, 'p10', q(0.1), 'p25', q(0.25), 'med', q(0.5), 'p75', q(0.75), 'p90', q(0.9), 'max', per[per.length - 1]);
  }
});
