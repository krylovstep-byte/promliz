/* V35: Mobile navigation drawer
   Toggle, focus-trap, close on overlay/Esc/in-page-link.
*/
(function () {
  'use strict';

  const burger = document.querySelector('.header__burger');
  const nav = document.getElementById('mobile-nav');
  const overlay = document.getElementById('mobile-nav-overlay');
  const closeBtn = nav?.querySelector('.mobile-nav__close');

  if (!burger || !nav || !overlay) return;

  let lastFocused = null;

  function getFocusable() {
    return nav.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
  }

  function openNav() {
    if (nav.classList.contains('is-open')) return;
    lastFocused = document.activeElement;

    nav.hidden = false;
    overlay.hidden = false;

    // Force reflow so transition runs
    void nav.offsetWidth;

    nav.classList.add('is-open');
    overlay.classList.add('is-open');
    burger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('has-mobile-nav');

    // Focus first interactive element (close button)
    requestAnimationFrame(() => {
      closeBtn?.focus();
    });

    document.addEventListener('keydown', onKeydown);
  }

  function closeNav() {
    if (!nav.classList.contains('is-open')) return;

    nav.classList.remove('is-open');
    overlay.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('has-mobile-nav');

    document.removeEventListener('keydown', onKeydown);

    // Hide elements after transition
    setTimeout(() => {
      if (!nav.classList.contains('is-open')) {
        nav.hidden = true;
        overlay.hidden = true;
      }
    }, 340);

    // Return focus
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    } else {
      burger.focus();
    }
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeNav();
      return;
    }

    // Focus trap on Tab
    if (e.key === 'Tab') {
      const focusable = Array.from(getFocusable());
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // Toggle burger
  burger.addEventListener('click', (e) => {
    e.preventDefault();
    if (nav.classList.contains('is-open')) closeNav();
    else openNav();
  });

  // Close button
  closeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    closeNav();
  });

  // Overlay click
  overlay.addEventListener('click', closeNav);

  // Close when clicking any link in nav (anchor or external)
  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      // Small delay so scroll happens before close
      setTimeout(closeNav, 50);
    });
  });

  // Close if resized to desktop while open
  let resizeTimer;
  window.addEventListener('resize', () => {
    if (!nav.classList.contains('is-open')) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.innerWidth > 640) closeNav();
    }, 150);
  });
})();
