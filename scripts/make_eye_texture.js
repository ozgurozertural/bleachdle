#!/usr/bin/env node
// Tema geçişindeki maddenin dokusu: Yhwach'ın gözleri, kenarları birbirine
// uyan (dikişsiz) kare SVG. css/theme.css'teki ::view-transition-image-pair(root)
// arka planına yapıştırılacak url("...") değerini basar.
//
//   node scripts/make_eye_texture.js [tohum=11] [kare=480]
//
// Referans: TYBW'de Yhwach'ın gözleri — uçuk pembe, düzensiz, uzamış, bazen
// bir ucu sivri lekeler; koyu, çizik bir dış çizgi; küçük koyu kızıl gözbebeği
// her gözde başka yerde (ortada değil). Hepsi bozulmuş ve hafif bulanık,
// büyüklerin bir kısmı damlalarla aşağı eriyor.
//
// Dikişsizlik: kenara taşan göz karşı kenarda da çiziliyor; gürültü ve bozulma
// filtrelerinde stitchTiles var ve filtre bölgesi tam kare (yoksa her tekrarda
// dikiş görünür).

function rnd(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = n => n.toFixed(1);

// Kapalı, yumuşak yol: noktalardan Catmull-Rom eğrisi.
function smooth(pts) {
  const n = pts.length;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ` +
         `${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
}

// Bir göz: merkezde (0,0), yatay yarıçap a, dikey b. Kenar birkaç dalgayla
// düzensiz; tear > 0 ise bir ucu sivrilir (damla biçimi).
function eyeShape(R, a, b) {
  const N = 14, waves = [2, 3, 5].map(k => ({ k, amp: (0.05 + R() * 0.07) / (k / 2), ph: R() * 6.283 }));
  const tear = R() < 0.35 ? 0.35 + R() * 0.4 : 0, tearAt = R() * 6.283;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const th = i / N * 6.2832;
    let r = 1;
    for (const w of waves) r += w.amp * Math.sin(w.k * th + w.ph);
    if (tear) { const d = Math.cos(th - tearAt); if (d > 0.6) r += tear * (d - 0.6) / 0.4; }
    pts.push([Math.cos(th) * a * r, Math.sin(th) * b * r]);
  }
  return smooth(pts);
}

function tile(T, seed) {
  const R = rnd(seed), eyes = [];
  let tries = 0;
  while (eyes.length < 20 && tries++ < 6000) {
    const a = 10 + Math.pow(R(), 1.5) * 34;
    const e = { x: R() * T, y: R() * T, a, b: a * (0.55 + R() * 0.3), rot: (R() - 0.5) * 80 };
    // Üst üste binmesin; mesafe sarmalı ölçülüyor (dikişsiz kare)
    const ok = eyes.every(o => {
      let dx = Math.abs(o.x - e.x), dy = Math.abs(o.y - e.y);
      dx = Math.min(dx, T - dx); dy = Math.min(dy, T - dy);
      return Math.hypot(dx, dy) > (o.a + e.a) * 0.85;
    });
    if (!ok) continue;
    e.shape = eyeShape(R, e.a, e.b);
    // Gözbebeği: küçük, koyu kızıl, gözün içinde rastgele bir yerde
    const pa = R() * 6.283, pd = Math.sqrt(R()) * 0.55;
    e.pupil = { x: Math.cos(pa) * pd * e.a, y: Math.sin(pa) * pd * e.b, r: e.a * (0.11 + R() * 0.1), s: 0.8 + R() * 0.45 };
    e.melt = R() < 0.5 && a > 16;
    e.drips = Array.from({ length: 1 + Math.floor(R() * 3) }, () => ({ x: (R() - 0.5) * 1.1, len: 0.7 + R() * 1.6, w: 0.1 + R() * 0.12 }));
    eyes.push(e);
  }

  // Eriyen göz: alt kenarından aşağı süzülen damlalar (döndürülmeden, hep aşağı)
  const drips = (e, x, y) => e.drips.map(d => {
    const dx = x + d.x * e.a * 0.8, top = y + e.b * 0.15, w = d.w * e.a * 0.7, L = d.len * e.b + e.b * 0.6;
    return `<path d="M${f(dx - w)} ${f(top)}C${f(dx - w)} ${f(top + L * .6)} ${f(dx - w * .5)} ${f(top + L)} ${f(dx)} ${f(top + L)}` +
           `C${f(dx + w * .5)} ${f(top + L)} ${f(dx + w)} ${f(top + L * .6)} ${f(dx + w)} ${f(top)}Z" fill="#c9708f"/>`;
  }).join('');

  const eye = (e, x, y) => {
    const p = e.pupil;
    return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(e.rot)})">` +
      `<path d="${e.shape}" fill="#f2b6cc" opacity=".35" filter="url(#glow)"/>` +
      `<path d="${e.shape}" fill="url(#sclera)" stroke="#1a0408" stroke-width="${f(e.a * .1)}" stroke-linejoin="round"/>` +
      `<ellipse cx="${f(p.x)}" cy="${f(p.y)}" rx="${f(p.r)}" ry="${f(p.r * p.s)}" fill="url(#pupil)"/>` +
      `</g>`;
  };

  // Kenara taşan göz karşı kenarda da çizilir. Eriyenler ayrı grupta: daha
  // güçlü, dikey akan bir bozulma alıyorlar.
  let solid = '', melted = '';
  for (const e of eyes) {
    const m = e.a * 1.8 + (e.melt ? e.b * 2.4 : 0);
    for (const dx of [-T, 0, T]) for (const dy of [-T, 0, T]) {
      const x = e.x + dx, y = e.y + dy;
      if (x > -m && x < T + m && y > -m && y < T + m) {
        if (e.melt) melted += drips(e, x, y) + eye(e, x, y); else solid += eye(e, x, y);
      }
    }
  }

  const region = `filterUnits="userSpaceOnUse" x="0" y="0" width="${T}" height="${T}"`;
  // Bozulma filtreleri karenin dışına taşar (M kadar): kenardaki piksel, karşı
  // kenardaki kopyadan okunabilsin. Gürültü tam karede üretilip feTile ile
  // döşeniyor, yani bozulma da T periyotlu — kenarlar birbirini tutuyor.
  const M = 60;
  const wide = `filterUnits="userSpaceOnUse" x="${-M}" y="${-M}" width="${T + 2 * M}" height="${T + 2 * M}"`;
  const noise = (freq, sd) => `<feTurbulence x="0" y="0" width="${T}" height="${T}" type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="${sd}" stitchTiles="stitch"/><feTile result="n"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${T}" height="${T}"><defs>` +
    `<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>` +
    // koyu kızıl bulut zemini
    `<filter id="w" ${region}><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="3" stitchTiles="stitch"/>` +
    `<feColorMatrix values="0 0 0 0 0.33  0 0 0 0 0.02  0 0 0 0 0.08  0 0 0 1.6 -0.75"/></filter>` +
    // bozulma: normal gözler hafif, eriyenler aşağı akan güçlü bozulma
    `<filter id="warp" ${wide}>${noise('0.035', 5)}` +
    `<feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="1.1"/></filter>` +
    `<filter id="melt" ${wide}>${noise('0.025 0.07', 9)}` +
    `<feDisplacementMap in="SourceGraphic" in2="n" scale="20" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="1.7"/></filter>` +
    `<radialGradient id="sclera" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#fbd6e2"/><stop offset=".65" stop-color="#f1b0c8"/><stop offset="1" stop-color="#d985a6"/></radialGradient>` +
    `<radialGradient id="pupil"><stop offset="0" stop-color="#6a0618"/><stop offset=".7" stop-color="#a3122f"/><stop offset="1" stop-color="#c0294a"/></radialGradient>` +
    `</defs><rect width="${T}" height="${T}" filter="url(#w)"/>` +
    `<g filter="url(#warp)">${solid}</g><g filter="url(#melt)">${melted}</g></svg>`;
}

module.exports = { tile };

if (require.main === module) {
  const seed = +process.argv[2] || 11, T = +process.argv[3] || 480;
  process.stdout.write(`url("data:image/svg+xml,${encodeURIComponent(tile(T, seed))}") 0 0 / ${T}px ${T}px\n`);
}
