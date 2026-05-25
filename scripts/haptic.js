/* V50: Haptic feedback на тапах мобильных устройств.
   Event delegation — один слушатель на document перехватывает все клики.
   Безопасно — если navigator.vibrate отсутствует (десктоп, iOS Safari),
   функция no-op. Включается только на ширине <=640px (мобиле).

   Тайминги:
   - 5ms — лёгкий тик (range input при отпускании)
   - 8-12ms — тап на кнопку/таб/dot
   - 15ms — открытие меню
   - 20ms — submit формы (подтверждающая вибрация)
*/
(function () {
  if (typeof navigator === 'undefined') return;
  if (!('vibrate' in navigator)) return;
  if (window.innerWidth > 640) return;

  const tap = (ms) => {
    try { navigator.vibrate(ms); } catch (e) { /* no-op */ }
  };

  // Делегированный клик на document
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t || !t.closest) return;

    // Step-selector (12/24/36/48/60 в обоих калькуляторах)
    if (t.closest('.step-selector button')) { tap(10); return; }

    // Категории типа имущества в hero-mini-calc
    if (t.closest('[data-category]')) { tap(10); return; }

    // Табы документов
    if (t.closest('.docs__tab, .docs__tabs button')) { tap(10); return; }

    // Точки ротатора hero (если когда-то вернутся видимыми)
    if (t.closest('.hero__rotator-dots button')) { tap(8); return; }

    // CTA-FAB круглая в калькуляторе hero
    if (t.closest('.hero__unit-cta')) { tap(12); return; }

    // Бургер-меню + FAB-messenger
    if (t.closest('.mobile-nav-toggle, .header__menu, .header__burger')) { tap(15); return; }
    if (t.closest('.fab, .messenger-fab')) { tap(12); return; }

    // Кнопки CTA (Оставить заявку, Подать заявку и т.п.)
    if (t.closest('.btn--accent, .btn--primary')) { tap(8); return; }
  }, { passive: true });

  // FAQ accordion (<details>)
  document.addEventListener('toggle', (e) => {
    if (e.target && e.target.matches && e.target.matches('details')) {
      tap(10);
    }
  }, true);

  // Range input slider — короткий tik при change (отпускании)
  document.querySelectorAll('input[type="range"]').forEach((r) => {
    r.addEventListener('change', () => tap(5));
  });

  // Submit формы — подтверждающая вибрация
  document.addEventListener('submit', () => tap(20), true);
})();
