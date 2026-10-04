/* Tema: iki durumlu segment. Düğmelerden biri doğrudan o temaya geçirir,
   etkin olan aria-pressed ile işaretlenir (CSS mühür dolgusunu oradan okur). */
(function() {
  const root = document.documentElement;
  const saved = localStorage.getItem('bleachdle-theme') || 'light';
  root.setAttribute('data-theme', saved);

  const buttons = document.querySelectorAll('.theme-toggle button[data-set-theme]');

  function sync() {
    const cur = root.getAttribute('data-theme');
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.setTheme === cur)));
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    localStorage.setItem('bleachdle-theme', theme);
    sync();
  }

  let busy = false;
  buttons.forEach(b => b.addEventListener('click', () => {
    const next = b.dataset.setTheme;
    if (busy || next === root.getAttribute('data-theme')) return;
    if (!canAnimate()) return apply(next);
    busy = true;
    hollow(b, () => apply(next)).finally(() => { busy = false; });
  }));

  sync();

  /* ---- 虚 Hollow maddesi ----
     Tema düğmesinden kızıl haleli siyah bir madde sızar, yeni tema onun
     içinden biraz geriden açılır. Prototipte seçildi (Ekim 2026). Katmanların
     sırası ve sabit stiller css/theme.css'te; burada lekenin kareleri üretilip
     Web Animations ile üç sözde öğeye veriliyor:
       eski görüntü  — maskesinde büyüyen yumuşak kenarlı delik
       çiftin zemini — madde + hale (delikle aynı ölçüde)
       yeni görüntü  — aynı leke, 0.2 geriden
     Hareket azaltma açıksa ya da tarayıcı desteklemiyorsa anlık geçiş. */

  const DURATION = 2100;
  const FRAMES = 36;

  function canAnimate() {
    return typeof document.startViewTransition === 'function'
      && !matchMedia('(prefers-reduced-motion: reduce)').matches
      && CSS.supports('mask-composite', 'exclude');
  }

  // Seed'li PRNG (game-core.js'teki mulberry32'nin aynısı; bu dosya ondan
  // bağımsız yükleniyor, ana sayfada game-core yok).
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Kübik bezier yumuşatma (CSS'in cubic-bezier'iyle aynı eğri).
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    return x => {
      let t = x;
      for (let i = 0; i < 8; i++) {
        const e = ((ax * t + bx) * t + cx) * t - x, d = (3 * ax * t + 2 * bx) * t + cx;
        if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      t = Math.min(1, Math.max(0, t));
      return ((ay * t + by) * t + cy) * t;
    };
  }
  // Yavaş başlar, hızlanır, yumuşak durur: sızan bir madde.
  const ooze = bezier(0.5, 0.05, 0.25, 1);

  // Lekenin iskeleti: kenar dalgaları, dokunaçlar (dar, uzun çıkıntılar) ve
  // sıçrantılar. Her geçişte yeni tohum — iki geçiş aynı görünmez.
  function shape(seed) {
    const R = rng(seed);
    return {
      waves: Array.from({ length: 6 }, (_, i) => ({
        f: 3 + i * 2 + Math.floor(R() * 3), a: 0.075 / (i + 1) + R() * 0.03, p: R() * 6.283, v: (R() - 0.5) * 5,
      })),
      tendrils: Array.from({ length: 11 }, () => ({
        th: R() * 6.283, len: 0.18 + R() * 0.5, w: 0.035 + R() * 0.05, v: (R() - 0.5) * 0.5, br: R() * 6.283,
      })),
      drops: Array.from({ length: 14 }, () => ({ th: R() * 6.283, d: 1.05 + R() * 0.28, r: 0.012 + R() * 0.04 })),
    };
  }

  // Bir kare: phase 0..1 boyunca dalgalar kayar, dokunaçlar uzayıp kısalır.
  // Koordinatlar -1.5..1.5 kutusunda, gövde yarıçapı ~1.
  function frame(sh, phase) {
    const N = 160;
    const rad = th => {
      let r = 1;
      for (const w of sh.waves) r += w.a * Math.sin(w.f * th + w.p + w.v * phase);
      for (const t of sh.tendrils) {
        const d = Math.abs(((th - t.th - t.v * phase) % 6.2832 + 9.4248) % 6.2832 - 3.1416);
        r += t.len * (0.75 + 0.25 * Math.sin(phase * 7 + t.br)) * Math.exp(-(d * d) / (2 * t.w * t.w));
      }
      return r;
    };
    const path = k => {
      let d = '';
      for (let i = 0; i <= N; i++) {
        const th = i / N * 6.2832, r = 1 + (rad(th) - 1) * k;
        d += (i ? 'L' : 'M') + (Math.cos(th) * r).toFixed(4) + ' ' + (Math.sin(th) * r).toFixed(4);
      }
      return d + 'Z';
    };
    const drops = sh.drops.map(p =>
      `<circle cx="${(Math.cos(p.th) * p.d).toFixed(3)}" cy="${(Math.sin(p.th) * p.d).toFixed(3)}" r="${(p.r * (0.6 + 0.4 * Math.sin(phase * 5 + p.th))).toFixed(3)}"/>`
    ).join('');
    return { body: path(1), halo: path(1.15), drops };
  }

  const svg = inner => 'url("data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.5 -1.5 3 3">${inner}</svg>`) + '")';

  // Yeni temanın maskesi: gövde + yarı saydam ıslak hale + sıçrantılar.
  const newMask = f =>
    svg(`<g fill="#000"><path d="${f.halo}" transform="scale(1.03)" fill-opacity=".45"/><path d="${f.body}"/>${f.drops}</g>`);

  // Eski görüntüdeki delik: kenarı yumuşak (iç içe soluklaşan kopyalar), hale
  // eskinin kenarına bu yumuşak bantta karışıyor.
  const hole = f =>
    svg(`<g fill="#000"><path d="${f.body}" transform="scale(1.06)" fill-opacity=".25"/><path d="${f.body}" transform="scale(1.035)" fill-opacity=".5"/><path d="${f.body}" transform="scale(1.015)" fill-opacity=".8"/><path d="${f.body}"/>${f.drops}</g>`);

  // Madde: kızıl hale (dıştan içe koyulaşan halkalar) ve üstünde siyah gövde;
  // gövdenin kenarına doğru koyu kızıl damar rengi. glow sona doğru söner.
  const matter = (f, glow) =>
    svg(`<defs><radialGradient id="m"><stop offset=".45" stop-color="#050407"/><stop offset="1" stop-color="#2a0508"/></radialGradient></defs>` +
      `<g opacity="${glow.toFixed(3)}"><path d="${f.body}" transform="scale(1.06)" fill="#6d0408" fill-opacity=".55"/><path d="${f.body}" transform="scale(1.035)" fill="#c3120c" fill-opacity=".75"/><path d="${f.body}" transform="scale(1.015)" fill="#ff5a2f"/></g>` +
      `<path d="${f.body}" fill="url(#m)"/><g fill="#050407">${f.drops}</g>`);

  async function hollow(button, update) {
    const b = button.getBoundingClientRect();
    const ox = b.left + b.width / 2, oy = b.top + b.height / 2;
    const W = innerWidth, H = innerHeight;
    // Gövde yarıçapı kutunun 1/3'ü; en uzak köşeyi örtecek kadar büyüt.
    const S = Math.max(Math.hypot(ox, oy), Math.hypot(W - ox, oy), Math.hypot(ox, H - oy), Math.hypot(W - ox, H - oy)) * 3.75;

    const sh = shape(Date.now());
    const k = { old: [], pair: [], neu: [] };
    for (let i = 0; i <= FRAMES; i++) {
      const p = i / FRAMES, f = frame(sh, p);
      const sf = Math.max(1, S * ooze(Math.min(1, p / 0.82)));          // madde önde
      const sb = Math.max(1, S * ooze(Math.max(0, (p - 0.2) / 0.8)));   // yeni tema geriden
      const glow = p < 0.85 ? 1 : 1 - (p - 0.85) / 0.15;
      const at = s => `${(ox - s / 2).toFixed(1)}px ${(oy - s / 2).toFixed(1)}px`;
      k.old.push({ offset: p, maskImage: `linear-gradient(#000, #000), ${hole(f)}`, maskSize: `100% 100%, ${sf.toFixed(1)}px ${sf.toFixed(1)}px`, maskPosition: `0 0, ${at(sf)}` });
      k.pair.push({ offset: p, backgroundImage: matter(f, glow), backgroundSize: `${sf.toFixed(1)}px ${sf.toFixed(1)}px`, backgroundPosition: at(sf) });
      k.neu.push({ offset: p, maskImage: newMask(f), maskSize: `${sb.toFixed(1)}px ${sb.toFixed(1)}px`, maskPosition: at(sb) });
    }

    const t = document.startViewTransition(update);
    try {
      await t.ready;
    } catch (e) {
      return;   // geçiş atlandı (ör. sekme gizli); güncelleme yine de yapıldı
    }
    const opts = el => ({ duration: DURATION, easing: 'linear', fill: 'both', pseudoElement: `::view-transition-${el}(root)` });
    root.animate(k.old, opts('old'));
    root.animate(k.pair, opts('image-pair'));
    root.animate(k.neu, opts('new'));
    await t.finished;
  }
})();
