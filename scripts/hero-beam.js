/* V48: JS-driven beam обводка для калькулятора hero.
   На мобиле iOS Safari < 16.4 не поддерживает @property --beam-angle
   (CSS Houdini) — оригинальная CSS-animation beam-rotate из components.css
   не работает, beam застывает. Здесь обновляем custom property напрямую
   через requestAnimationFrame — работает в любом браузере.

   Time-based: 60 deg/sec (полный круг за 6s — как в оригинале).
   Pause при document.hidden — экономит CPU.
*/
(function () {
  const el = document.querySelector('.hero__unit.beam-wrap');
  if (!el) return;

  const isMobile = () => window.innerWidth <= 640;

  // На десктопе оставляем родное CSS-animation (там @property работает)
  if (!isMobile()) return;

  let angle = 0;
  let lastTime = 0;
  let visible = true;
  const speed = 60; // deg/sec → 360deg за 6s

  function tick(now) {
    if (!visible) {
      lastTime = now;
      requestAnimationFrame(tick);
      return;
    }
    if (lastTime === 0) lastTime = now;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    angle = (angle + speed * dt) % 360;
    el.style.setProperty('--beam-angle', angle.toFixed(2) + 'deg');
    requestAnimationFrame(tick);
  }

  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (visible) lastTime = 0;
  });

  // Стартуем после загрузки (чтобы DOM-ready и стили подхватились)
  if (document.readyState === 'complete') {
    requestAnimationFrame(tick);
  } else {
    window.addEventListener('load', () => {
      requestAnimationFrame(tick);
    }, { once: true });
  }
})();
