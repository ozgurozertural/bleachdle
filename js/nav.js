// Üst bardaki mod kısayolları. Tuş eşlemesi DOM'dan okunur (data-key),
// böylece mod listesi tek yerde — HTML'de — tanımlı kalır.
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // Oyun sayfalarında arama kutusu açılışta odaklı geliyor; kısayolu tümden
  // engellemek onu kullanılamaz kılardı. Kural: kutuda yazı varsa tuş yazıya
  // gider, boşsa kısayol çalışır. Karakter adlarının hiçbiri rakamla başlamıyor.
  const el = document.activeElement;
  const typing = el && (el.tagName === 'TEXTAREA' || el.isContentEditable ||
                        (el.tagName === 'INPUT' && el.value !== ''));
  if (typing) return;

  const link = document.querySelector(`.mode-nav a[data-key="${e.key}"]`);
  if (!link || link.hasAttribute('aria-current')) return;
  e.preventDefault();
  link.click();   // bağlantıyı etkinleştir: gezinme davranışı tek yerde kalsın
});
