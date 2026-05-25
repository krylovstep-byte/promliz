/* V41: JS-fallback marquee партнёров.
   CSS-animation отключается на iPhone из-за prefers-reduced-motion (часто
   включено по умолчанию). JS-scroller не подчиняется этой настройке —
   работает гарантированно. Time-based: постоянная скорость независимо от FPS.

   HTML предполагает дублированный track (22 + 22 лого, см. index.html ~376-420).
   Анимация двигает X от 0 до -50% (т.е. до середины), потом обнуляется —
   получается бесшовная лента.
*/
(function () {
  const track = document.querySelector('.partners__track');
  if (!track) return;

  const isMobile = () => window.innerWidth <= 640;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // На мобиле всегда JS (CSS-anim не надёжен). На десктопе — только если у
  // пользователя включено prefers-reduced-motion, иначе оставляем CSS-anim.
  if (!isMobile() && !reducedMotion) return;

  // V42: перебиваем CSS !important через setProperty('...', '...', 'important')
  track.style.setProperty('animation', 'none', 'important');
  track.style.setProperty('will-change', 'transform', 'important');
  track.style.setProperty('transform', 'translateX(0)', 'important');

  let offset = 0;
  let half = 0;
  let lastTime = 0;
  let speed = isMobile() ? 60 : 50; // px/sec
  let rafId = 0;
  let visible = true;

  function measure() {
    half = track.scrollWidth / 2;
    speed = isMobile() ? 60 : 50;
  }

  function tick(now) {
    if (!visible) {
      lastTime = now;
      rafId = requestAnimationFrame(tick);
      return;
    }
    if (lastTime === 0) lastTime = now;
    const dt = Math.min((now - lastTime) / 1000, 0.05); // clamp 50ms (предотвращает прыжок при возврате на вкладку)
    lastTime = now;
    if (half > 0) {
      offset += speed * dt;
      if (offset >= half) offset -= half;
      track.style.setProperty('transform', 'translateX(' + (-offset).toFixed(2) + 'px)', 'important');
    }
    rafId = requestAnimationFrame(tick);
  }

  // Пауза при скрытой вкладке — экономит CPU
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (visible) lastTime = 0;
  });

  // Стартуем после полной загрузки изображений (чтобы scrollWidth был корректный)
  function start() {
    measure();
    rafId = requestAnimationFrame(tick);
  }

  if (document.readyState === 'complete') {
    start();
  } else {
    window.addEventListener('load', start, { once: true });
  }

  window.addEventListener('resize', () => {
    measure();
    offset = 0;
  }, { passive: true });
})();
