// Marble-music scene. Driven frame by frame from Node: setup(data) then renderFrame(t).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const TUBE_R = 0.3, TUBE_L = 1.7, BALL_R = 0.17;
const CONTACT_Y = 2 * TUBE_R + BALL_R;
const UP = new THREE.Vector3(0, 1, 0);

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let S = null; // all state

function pitchColor(pitch, theme) {
  const hue = theme === 'rainbow-octave' ? (((pitch - 36) * 0.045) % 1 + 1) % 1 : (((pitch % 12) / 12) * 0.92 + 0.0) % 1;
  return new THREE.Color().setHSL(hue, 0.95, 0.55);
}

function ballTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#d4141c'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#f4f4f4'; g.fillRect(0, 52, 256, 24);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Build the course: one tube per hit, arcs / rails between them. */
function buildCourse(hits, rng) {
  const F = new THREE.Vector3(Math.cos(S.baseAngle), 0, Math.sin(S.baseAngle));
  const L = new THREE.Vector3(-F.z, 0, F.x);
  const pitches = hits.map((h) => h.pitch).sort((a, b) => a - b);
  const pMed = pitches[Math.floor(pitches.length / 2)] ?? 60;
  const phase = rng() * 10;
  const tubes = [];
  let s = 0;
  for (let i = 0; i < hits.length; i++) {
    if (i > 0) {
      const gap = hits[i].t - hits[i - 1].t;
      const rail = gap > S.railGap;
      s += rail ? clamp(gap * 1.6, 2.6, 6) : clamp(0.75 + gap * 2.2, 0.95, 3.0);
      tubes[i - 1].railAfter = rail;
    }
    const lat = 1.4 * Math.sin(s * 0.33 + phase) + clamp((hits[i].pitch - pMed) * 0.09, -1.3, 1.3);
    const pos = F.clone().multiplyScalar(s).addScaledVector(L, lat);
    tubes.push({ pos, t: hits[i].t, pitch: hits[i].pitch, color: pitchColor(hits[i].pitch, S.theme), railAfter: false });
  }
  return { tubes, F, L };
}

function contact(tube) { return new THREE.Vector3(tube.pos.x, CONTACT_Y, tube.pos.z); }

/** Ball path segments; each has t0,t1 and a pos(u) function. */
function buildPath(course) {
  const { tubes, F, L } = course;
  const segs = [];
  const arc = (A, B, t0, t1, g = 14) => {
    const T = t1 - t0, h = Math.min(0.5 * g * (T / 2) ** 2, 2.4);
    segs.push({ t0, t1, pos: (u) => new THREE.Vector3().lerpVectors(A, B, u).addScaledVector(UP, 4 * h * u * (1 - u)) });
  };
  // Intro: drop in from above-behind.
  const first = tubes[0];
  const introStart = Math.min(first.t - 0.6, -0.1);
  const A0 = contact(first).addScaledVector(F, -2.4).addScaledVector(UP, 1.2);
  segs.push({ t0: -1e9, t1: introStart, pos: () => A0.clone() });
  arc(A0, contact(first), introStart, first.t);
  for (let i = 0; i < tubes.length - 1; i++) {
    const a = tubes[i], b = tubes[i + 1];
    const A = contact(a), B = contact(b);
    if (!a.railAfter) { arc(A, B, a.t, b.t); continue; }
    // Rail: hop on, roll along a sagging wire, drop onto the next tube.
    const dir = B.clone().sub(A).setY(0); const len = dir.length(); dir.normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const R0 = A.clone().addScaledVector(dir, 0.45).addScaledVector(UP, 0.55);
    const R1 = B.clone().addScaledVector(dir, -0.55).addScaledVector(UP, 0.7);
    const wig = (S.rng() - 0.5) * 1.6;
    const mid1 = new THREE.Vector3().lerpVectors(R0, R1, 0.33).addScaledVector(side, wig).addScaledVector(UP, -0.25);
    const mid2 = new THREE.Vector3().lerpVectors(R0, R1, 0.66).addScaledVector(side, -wig * 0.7).addScaledVector(UP, 0.1);
    const curve = new THREE.CatmullRomCurve3([R0, mid1, mid2, R1]);
    const T = b.t - a.t;
    const hop = Math.min(0.22, T * 0.15), drop = Math.min(0.28, T * 0.2);
    arc(A, R0, a.t, a.t + hop, 10);
    const rt0 = a.t + hop, rt1 = b.t - drop;
    segs.push({ t0: rt0, t1: rt1, pos: (u) => curve.getPointAt(0.55 * u + 0.45 * (0.5 - 0.5 * Math.cos(Math.PI * u))) });
    arc(R1, B, rt1, b.t, 10);
    S.rails.push(curve);
  }
  // Outro: bounce off ahead and settle on the floor.
  const last = tubes[tubes.length - 1];
  const E = contact(last).addScaledVector(F, 2.2).setY(BALL_R);
  arc(contact(last), E, last.t, last.t + 0.55);
  const E2 = E.clone().addScaledVector(F, 1.5);
  segs.push({ t0: last.t + 0.55, t1: last.t + 2.5, pos: (u) => new THREE.Vector3().lerpVectors(E, E2, 1 - (1 - u) ** 2) });
  segs.push({ t0: last.t + 2.5, t1: 1e9, pos: () => E2.clone() });
  return segs;
}

function ballPos(t) {
  const segs = S.segs;
  let lo = 0, hi = segs.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (segs[m].t0 <= t) lo = m; else hi = m - 1; }
  const sg = segs[lo];
  const u = sg.t1 - sg.t0 > 1e6 || sg.t0 < -1e6 ? 0 : clamp((t - sg.t0) / (sg.t1 - sg.t0), 0, 1);
  return sg.pos(u);
}

function makeTubeMesh(color) {
  const geo = new THREE.CylinderGeometry(TUBE_R, TUBE_R, TUBE_L, 40, 1, true);
  const mat = new THREE.MeshStandardMaterial({ color: 0x24262b, metalness: 0.35, roughness: 0.42, side: THREE.DoubleSide, emissive: 0x000000 });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  // rim ring so the open end reads clearly
  const rim = new THREE.Mesh(new THREE.TorusGeometry(TUBE_R, 0.018, 8, 40), mat);
  rim.rotation.x = Math.PI / 2; rim.position.y = TUBE_L / 2; m.add(rim);
  const rim2 = rim.clone(); rim2.position.y = -TUBE_L / 2; m.add(rim2);
  m.userData.color = color;
  return m;
}

function placeTube(mesh, pos, angle, y = TUBE_R) {
  mesh.position.set(pos.x, y, pos.z);
  mesh.rotation.set(0, 0, 0);
  mesh.rotateY(-angle);
  mesh.rotateZ(Math.PI / 2); // lie down; axis now along local X rotated by angle
}

function buildRail(curve) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a8f99, metalness: 0.9, roughness: 0.3 });
  const N = 80; const off = 0.1;
  const left = [], right = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N; const p = curve.getPointAt(u); const tan = curve.getTangentAt(u);
    const side = new THREE.Vector3().crossVectors(tan, UP).normalize();
    const base = p.clone().addScaledVector(UP, -BALL_R * 0.75);
    left.push(base.clone().addScaledVector(side, off)); right.push(base.clone().addScaledVector(side, -off));
    if (i % 6 === 3) {
      const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 6), mat);
      tie.position.copy(base).addScaledVector(UP, -0.02);
      tie.quaternion.setFromUnitVectors(UP, side); S.scene.add(tie);
    }
  }
  for (const pts of [left, right]) {
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.016, 6), mat);
    tube.castShadow = true; S.scene.add(tube);
  }
}

window.setup = async (data) => {
  const { width, height } = data;
  const rng = mulberry32(data.seed ?? 7);
  S = { data, rng, rails: [], baseAngle: -Math.PI / 2 + (rng() - 0.5) * 0.6, railGap: data.railGap ?? 0.9, theme: data.colorMode ?? 'pitch-class' };

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(width, height);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const bg = new THREE.Color(data.background ?? '#2b2d33');
  scene.background = bg; scene.fog = new THREE.Fog(bg, 20, 42);
  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
  S.renderer = renderer; S.scene = scene; S.camera = camera;

  scene.add(new THREE.HemisphereLight(0xd8deff, 0x34343a, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 50 });
  sun.shadow.bias = -0.0005; sun.shadow.radius = 4;
  scene.add(sun); scene.add(sun.target); S.sun = sun;
  S.glows = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffffff, 0, 5, 2); scene.add(l); return l; });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: data.floor ?? '#30323a', roughness: 0.85, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const course = buildCourse(data.hits, rng);
  S.course = course;
  S.segs = buildPath(course);
  for (const c of S.rails) buildRail(c);

  // Course tubes: axis roughly perpendicular to the direction of travel.
  S.tubes = course.tubes.map((tb, i) => {
    const m = makeTubeMesh(tb.color);
    const nxt = course.tubes[i + 1] || course.tubes[i - 1] || tb;
    const d = nxt.pos.clone().sub(tb.pos); if (i + 1 >= course.tubes.length) d.negate();
    const travel = d.lengthSq() > 1e-6 ? Math.atan2(d.z, d.x) : S.baseAngle;
    const ang = travel + Math.PI / 2 + (rng() - 0.5) * 0.7;
    placeTube(m, tb.pos, ang); m.userData.baseY = TUBE_R; scene.add(m);
    return { mesh: m, ...tb };
  });

  // Decorative unlit tubes scattered around the course.
  const pts = course.tubes.map((t) => t.pos);
  const nDeco = Math.min(500, Math.round(pts.length * (data.decoration ?? 1.6)));
  const decoMat = new THREE.MeshStandardMaterial({ color: 0x232529, metalness: 0.35, roughness: 0.45, side: THREE.DoubleSide });
  const decoGeo = new THREE.CylinderGeometry(TUBE_R, TUBE_R, TUBE_L, 32, 1, true);
  const placed = [];
  for (let k = 0; k < nDeco; k++) {
    const base = pts[Math.floor(rng() * pts.length)];
    const p = base.clone().addScaledVector(course.L, (rng() < 0.5 ? -1 : 1) * (2.2 + rng() * 4.5)).addScaledVector(course.F, (rng() - 0.5) * 3);
    if (pts.some((q) => q.distanceTo(p) < 1.6) || placed.some((q) => q.distanceTo(p) < 1.95)) continue;
    placed.push(p);
    const m = new THREE.Mesh(decoGeo, decoMat); m.castShadow = true; m.receiveShadow = true;
    placeTube(m, p, rng() * Math.PI); scene.add(m);
  }

  // Ball
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 48, 32), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.18, metalness: 0.05 }));
  ball.castShadow = true; scene.add(ball); S.ball = ball; S.prevBall = null;

  // Smoothed camera target track.
  const dt = 1 / 30, end = (data.duration ?? 10) + 1;
  const raw = []; for (let t = -1; t <= end; t += dt) raw.push(ballPos(t).setY(0));
  const sigma = 0.55 / dt, rad = Math.ceil(sigma * 2.5), wts = [];
  for (let j = -rad; j <= rad; j++) wts.push(Math.exp(-(j * j) / (2 * sigma * sigma)));
  S.camTrack = raw.map((_, i) => { const v = new THREE.Vector3(); let w = 0; for (let j = -rad; j <= rad; j++) { const q = raw[clamp(i + j, 0, raw.length - 1)]; v.addScaledVector(q, wts[j + rad]); w += wts[j + rad]; } return v.multiplyScalar(1 / w); });
  S.camT0 = -1; S.camDt = dt;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), data.bloom ?? 0.55, 0.5, 0.8));
  composer.addPass(new OutputPass());
  S.composer = composer;

  // Overlay canvas (text) + output canvas
  S.out = document.createElement('canvas'); S.out.width = width; S.out.height = height;
  S.ctx = S.out.getContext('2d');
  await document.fonts.load(`800 40px ${data.font ?? 'Inter'}`).catch(() => {});
  return { tubes: S.tubes.length, rails: S.rails.length };
};

function camTarget(t) {
  const f = (t - S.camT0) / S.camDt; const i = clamp(Math.floor(f), 0, S.camTrack.length - 2); const u = clamp(f - i, 0, 1);
  return new THREE.Vector3().lerpVectors(S.camTrack[i], S.camTrack[i + 1], u);
}

function updateScene(t) {
  const { F } = S.course;
  // Tubes
  const lit = [];
  for (const tb of S.tubes) {
    const m = tb.mesh, mat = m.material;
    if (t >= tb.t) {
      const k = t - tb.t, flash = Math.exp(-k * 5);
      mat.color.copy(tb.color).multiplyScalar(0.8); mat.emissive.copy(tb.color);
      mat.emissiveIntensity = (S.data.litGlow ?? 0.55) + 1.1 * flash;
      m.position.y = m.userData.baseY - 0.06 * Math.exp(-k * 9) * Math.cos(k * 40);
      lit.push(tb);
    } else { mat.color.set(0x24262b); mat.emissive.set(0x000000); mat.emissiveIntensity = 0; m.position.y = m.userData.baseY; }
  }
  // Colored floor wash from the most recent hits
  const recent = lit.slice(-3);
  S.glows.forEach((l, j) => {
    const tb = recent[recent.length - 1 - j];
    if (!tb) { l.intensity = 0; return; }
    l.color.copy(tb.color); l.position.set(tb.pos.x, 0.9, tb.pos.z);
    l.intensity = (j === 0 ? 2.2 : 1.2) * (0.5 + 0.5 * Math.exp(-(t - tb.t) * 3));
  });
  // Ball + rolling spin
  const p = ballPos(t); S.ball.position.copy(p);
  if (S.prevBall) {
    const d = p.clone().sub(S.prevBall).setY(0); const dist = d.length();
    if (dist > 1e-5) { const axis = new THREE.Vector3().crossVectors(UP, d.normalize()); S.ball.rotateOnWorldAxis(axis, dist / BALL_R); }
  }
  S.prevBall = p.clone();
  // Camera
  const tg = camTarget(t);
  const az = 0.22 * Math.sin(t * 0.13);
  const back = F.clone().applyAxisAngle(UP, az);
  const dist = 1.45 * (S.data.cameraDistance ?? 1);
  S.camera.position.copy(tg).addScaledVector(back, -5.2 * dist).addScaledVector(UP, 9.5 * dist);
  S.camera.lookAt(tg.clone().addScaledVector(back, 1.6));
  S.sun.position.copy(tg).add(new THREE.Vector3(-4, 12, 3)); S.sun.target.position.copy(tg);
}

function fitFont(ctx, text, weight, size, family, maxW) {
  let s = size; ctx.font = `${weight} ${s}px ${family}`;
  while (s > 10 && ctx.measureText(text).width > maxW) { s -= 1; ctx.font = `${weight} ${s}px ${family}`; }
  return s;
}

function drawOverlay(t) {
  const { ctx } = S; const { width: W, height: H, title = '', entries = [], handle, font = 'Inter', showList = true } = S.data;
  const k = W / 1080;
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 14 * k; ctx.shadowOffsetY = 3 * k;
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  const lines = String(title).split('\n');
  let y = 170 * k;
  for (const ln of lines) { fitFont(ctx, ln, 800, 66 * k, font, W - 80 * k); ctx.fillText(ln, W / 2, y); y += 78 * k; }
  if (showList && entries.length) {
    const rows = entries.length <= 3 ? entries.length : Math.ceil(entries.length / 2);
    const colX = [44 * k, W / 2 + 6 * k]; const colW = W / 2 - 54 * k;
    const lh = 58 * k; y += 2 * k;
    const sorted = [...entries].sort((a, b) => a.rank - b.rank);
    sorted.forEach((e, i) => {
      const col = i < rows ? 0 : 1, row = i < rows ? i : i - rows;
      const x = colX[col], yy = y + row * lh;
      ctx.textAlign = 'left'; ctx.globalAlpha = 1;
      ctx.font = `800 ${44 * k}px ${font}`; const label = `${e.rank}:`; ctx.fillText(label, x, yy);
      const nx = x + ctx.measureText('00:').width + 4 * k;
      if (t >= e.revealAt) {
        const a = clamp((t - e.revealAt) / 0.22, 0, 1); const pop = 1 + 0.35 * (1 - a) ** 2;
        const s = fitFont(ctx, e.name, 700, 42 * k, font, colW - (nx - x));
        ctx.save(); ctx.globalAlpha = a; ctx.translate(nx, yy - s * 0.35); ctx.scale(pop, pop);
        ctx.font = `700 ${s}px ${font}`; ctx.fillText(e.name, 0, s * 0.35); ctx.restore();
      }
    });
  } else if (S.data.current) {
    const cur = S.data.current.filter((c) => t >= c.at).pop();
    if (cur) { ctx.textAlign = 'center'; fitFont(ctx, cur.name, 700, 44 * k, font, W - 80 * k); ctx.fillText(cur.name, W / 2, y + 10 * k); }
  }
  if (handle) {
    ctx.textAlign = 'right'; ctx.globalAlpha = 0.85; ctx.font = `700 ${34 * k}px ${font}`;
    ctx.fillText(handle, W - 36 * k, H * 0.78); ctx.globalAlpha = 1;
  }
  ctx.shadowColor = 'transparent';
}

window.renderFrame = (t, quality = 0.92) => {
  updateScene(t);
  S.composer.render();
  S.ctx.drawImage(S.renderer.domElement, 0, 0);
  drawOverlay(t);
  return S.out.toDataURL('image/jpeg', quality);
};
window.sceneReady = true;
