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
     sırası ve sabit stiller css/theme.css'te; burada lekenin kareleri
     clip-path yolları olarak üretilip Web Animations ile verilir:
       eski görüntü  — ekran eksi leke (evenodd): büyüyen delik
       çiftin zemini — delikten görünen siyah madde (CSS'te)
       hale katmanı  — lekenin kenarında ince kızıl halka
       yeni görüntü  — aynı leke, 0.2 geriden
     Hareket azaltma açıksa ya da tarayıcı desteklemiyorsa anlık geçiş. */

  const DURATION = 2100;
  const FRAMES = 36;

  function canAnimate() {
    return typeof document.startViewTransition === 'function'
      && !matchMedia('(prefers-reduced-motion: reduce)').matches
      && CSS.supports('clip-path', 'path("M0 0")');
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

  // Lekenin bir karesi, piksel cinsinden yol. phase 0..1 boyunca dalgalar
  // kayar, dokunaçlar uzayıp kısalır. r gövde yarıçapı, scale halka için
  // (ör. 1.045 hale dış kenarı). Komut yapısı her karede aynı, o yüzden
  // tarayıcı kareler arasını yumuşak doldurabiliyor.
  function blob(sh, phase, cx, cy, r, scale, drops) {
    const N = 90;
    const f = n => n.toFixed(1);
    let d = '';
    for (let i = 0; i <= N; i++) {
      const th = i / N * 6.2832;
      let k = 1;
      for (const w of sh.waves) k += w.a * Math.sin(w.f * th + w.p + w.v * phase);
      for (const t of sh.tendrils) {
        const a = Math.abs(((th - t.th - t.v * phase) % 6.2832 + 9.4248) % 6.2832 - 3.1416);
        k += t.len * (0.75 + 0.25 * Math.sin(phase * 7 + t.br)) * Math.exp(-(a * a) / (2 * t.w * t.w));
      }
      const rr = r * k * scale;
      d += (i ? 'L' : 'M') + f(cx + Math.cos(th) * rr) + ' ' + f(cy + Math.sin(th) * rr);
    }
    d += 'Z';
    if (drops) {
      for (const p of sh.drops) {
        const x = cx + Math.cos(p.th) * p.d * r, y = cy + Math.sin(p.th) * p.d * r;
        const q = Math.max(0.1, p.r * r * (0.6 + 0.4 * Math.sin(phase * 5 + p.th)));
        d += `M${f(x - q)} ${f(y)}a${f(q)} ${f(q)} 0 1 0 ${f(2 * q)} 0a${f(q)} ${f(q)} 0 1 0 ${f(-2 * q)} 0Z`;
      }
    }
    return d;
  }

  async function hollow(button, update) {
    const b = button.getBoundingClientRect();
    const ox = b.left + b.width / 2, oy = b.top + b.height / 2;
    const W = innerWidth, H = innerHeight;
    // Gövde yarıçapı + en uzun dokunaç ~1.6 r; gövde en uzak köşeyi örtsün.
    const Rmax = Math.max(Math.hypot(ox, oy), Math.hypot(W - ox, oy), Math.hypot(ox, H - oy), Math.hypot(W - ox, H - oy)) * 1.25;
    const screen = `M-50 -50H${W + 50}V${H + 50}H-50Z`;

    const sh = shape(Date.now());
    const k = { old: [], rim: [], neu: [] };
    for (let i = 0; i <= FRAMES; i++) {
      const p = i / FRAMES;
      const rf = Math.max(0.5, Rmax * ooze(Math.min(1, p / 0.82)));          // madde önde
      const rb = Math.max(0.5, Rmax * ooze(Math.max(0, (p - 0.2) / 0.8)));   // yeni tema geriden
      // Hale %80'den sonra söner, %93'te sıfır: katman ancak o zaman kaldırılıyor.
      const glow = p < 0.8 ? 1 : Math.max(0, 1 - (p - 0.8) / 0.13);
      k.old.push({ offset: p, clipPath: `path(evenodd, "${screen}${blob(sh, p, ox, oy, rf, 1, true)}")` });
      k.rim.push({ offset: p, opacity: glow,
        clipPath: `path(evenodd, "${blob(sh, p, ox, oy, rf, 1.03, false)}${blob(sh, p, ox, oy, rf, 0.997, false)}")` });
      k.neu.push({ offset: p, clipPath: `path("${blob(sh, p, ox, oy, rb, 1, true)}")` });
    }

    root.style.setProperty('--hv-x', ox + 'px');
    root.style.setProperty('--hv-y', oy + 'px');
    root.classList.add('hv-run');
    const rim = document.createElement('div');
    rim.className = 'hv-rim';
    rim.setAttribute('aria-hidden', 'true');
    try {
      // Hale yalnız yeni durumda var: güncellemeyle birlikte eklenir, geçiş
      // bitmeden kaldırılır (bittiği karede gerçek sayfada görünmesin).
      const t = document.startViewTransition(() => { update(); document.body.appendChild(rim); });
      try {
        await t.ready;
      } catch (e) {
        return;   // geçiş atlandı (ör. sekme gizli); güncelleme yine de yapıldı
      }
      const opts = el => ({ duration: DURATION, easing: 'linear', fill: 'both', pseudoElement: `::view-transition-${el}` });
      root.animate(k.old, opts('old(root)'));
      root.animate(k.rim, opts('new(hv-rim)'));
      root.animate(k.neu, opts('new(root)'));
      setTimeout(() => rim.remove(), DURATION * 0.96);
      await t.finished;
    } finally {
      rim.remove();
      root.classList.remove('hv-run');
      root.style.removeProperty('--hv-x');
      root.style.removeProperty('--hv-y');
    }
  }
})();
