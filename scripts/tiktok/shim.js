(() => {
  const R = { now: performance.now.bind(performance), date: Date.now, raf: window.requestAnimationFrame.bind(window), caf: window.cancelAnimationFrame.bind(window), st: window.setTimeout.bind(window), si: window.setInterval.bind(window), ct: window.clearTimeout.bind(window), ci: window.clearInterval.bind(window) };
  let frozen = false, now = 0, dateOff = 0;
  performance.now = () => (frozen ? now : R.now());
  Date.now = () => (frozen ? now + dateOff : R.date());
  let raf = [], rid = 1e9;
  window.requestAnimationFrame = (cb) => { if (!frozen) return R.raf(cb); raf.push([++rid, cb]); return rid; };
  window.cancelAnimationFrame = (id) => { if (id > 1e9) raf = raf.filter((r) => r[0] !== id); else R.caf(id); };
  const timers = new Map(); let tid = 1e9;
  window.setTimeout = (cb, ms = 0, ...a) => { if (!frozen) return R.st(cb, ms, ...a); const id = ++tid; timers.set(id, { at: now + Math.max(0, +ms || 0), cb, a }); return id; };
  window.setInterval = (cb, ms = 0, ...a) => { if (!frozen) return R.si(cb, ms, ...a); const id = ++tid; const every = Math.max(1, +ms || 0); timers.set(id, { at: now + every, cb, a, every }); return id; };
  window.clearTimeout = window.clearInterval = (id) => { if (id > 1e9) timers.delete(id); else { R.ct(id); R.ci(id); } };
  window.__freeze = () => { now = R.now(); dateOff = R.date() - now; frozen = true; };
  window.__advance = (ms) => {
    const end = now + ms;
    for (let guard = 0; guard < 10000; guard++) {
      let id = null, t = null;
      for (const [k, v] of timers) if (v.at <= end && (!t || v.at < t.at)) { id = k; t = v; }
      if (!t) break;
      now = Math.max(now, t.at);
      if (t.every) t.at += t.every; else timers.delete(id);
      try { if (typeof t.cb === 'function') t.cb(...t.a); } catch (e) { console.error(e); }
    }
    now = end;
    const q = raf; raf = [];
    for (const [, cb] of q) { try { cb(now); } catch (e) { console.error(e); } }
  };
})();
