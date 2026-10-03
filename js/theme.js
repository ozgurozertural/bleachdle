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

  buttons.forEach(b => b.addEventListener('click', () => {
    root.setAttribute('data-theme', b.dataset.setTheme);
    localStorage.setItem('bleachdle-theme', b.dataset.setTheme);
    sync();
  }));

  sync();
})();
