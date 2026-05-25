(function () {
  // ============ SCROLL REVEAL ============
  // Auto-tag key containers
  const autoRevealSelector = '.section__head, .case-card, .card, .benefit, .review, .process-track, .process-step, .scenarios, .docs__inner, .faq-item, .apply__form, .trust-strip__inner, .hero__signals, .hero__free, .process-track__cta';
  document.querySelectorAll(autoRevealSelector).forEach((el) => el.classList.add('reveal'));

  // Auto-tag photo containers for hover-zoom
  document.querySelectorAll('.card__photo, .case-card__photo').forEach((el) => el.classList.add('photo-zoom'));

  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const revealObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          revealObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach((el) => revealObs.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-revealed'));
  }

  const header = document.getElementById('header');

  function onScroll() {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 80);
  }

  // V19.8: убираем transitions на initial state — чтобы header не анимировался при загрузке со скроллом
  if (header) {
    header.classList.add('header--no-transition');
    onScroll();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        header.classList.remove('header--no-transition');
      });
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  // V17: smooth scroll с offset под sticky header
  function scrollToTarget(target) {
    const headerH = (header && header.offsetHeight) ? header.offsetHeight : 80;
    const targetTop = target.getBoundingClientRect().top + window.pageYOffset;
    window.scrollTo({ top: targetTop - headerH - 8, behavior: 'smooth' });
  }

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    const href = link.getAttribute('href');
    if (href === '#' || href.length < 2) return;

    link.addEventListener('click', (e) => {
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      scrollToTarget(target);
      history.replaceState(null, '', href);
    });
  });

  const timeline = document.querySelector('[data-timeline]');
  if (timeline) {
    const steps = timeline.querySelectorAll('.process-step');
    const stepCount = steps.length;
    let ticking = false;

    function updateTimeline() {
      const rect = timeline.getBoundingClientRect();
      const viewportH = window.innerHeight || document.documentElement.clientHeight;
      const middle = rect.top + rect.height / 2;
      const start = viewportH * 0.85;
      const end = viewportH * 0.18;
      let progress = (start - middle) / (start - end);
      progress = Math.max(0, Math.min(1, progress));

      timeline.style.setProperty('--timeline-progress', (progress * 100) + '%');

      steps.forEach((step, i) => {
        const threshold = (i + 0.5) / stepCount;
        step.classList.toggle('is-passed', progress >= threshold);
      });
    }

    function onScrollTimeline() {
      if (ticking) return;
      requestAnimationFrame(() => {
        updateTimeline();
        ticking = false;
      });
      ticking = true;
    }

    window.addEventListener('scroll', onScrollTimeline, { passive: true });
    window.addEventListener('resize', onScrollTimeline, { passive: true });
    updateTimeline();
  }

  const tabs = document.querySelectorAll('.docs-tab');
  const panes = document.querySelectorAll('.docs-pane');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
      panes.forEach((p) => p.classList.toggle('is-active', p.dataset.pane === target));
    });
  });

  // ============ SCENARIOS (TASKS) ============
  const SCENARIOS = {
    fleet: {
      kicker: 'Сценарий 01 · Обновление парка',
      title: 'Обновить автопарк',
      task: 'Заменить несколько единиц техники без остановки работы.',
      solution: 'Оформляем несколько объектов одной сделкой. Старую технику можно обсудить как часть аванса.',
      schedule: 'Равномерный или убывающий - подбираем под денежный поток.',
      result: 'Один договор, понятный платёж, техника выходит в работу без крупного разового платежа.',
      cta: 'Рассчитать автопарк',
      icon: '<rect x="14" y="40" width="64" height="32" rx="3"/><rect x="78" y="48" width="28" height="24" rx="2"/><circle cx="32" cy="78" r="8"/><circle cx="92" cy="78" r="8"/><path d="M20 40 V32 H66 V40"/>',
    },
    cashflow: {
      kicker: 'Сценарий 02 · Cash-flow',
      title: 'Купить без вывода денег из оборота',
      task: 'Сохранить оборотные средства бизнеса.',
      solution: 'Минимальный аванс и платёж, который укладывается в текущий cash-flow компании.',
      schedule: 'Платёж подбираем под выручку и нагрузку компании.',
      result: 'Оборотные деньги остаются в бизнесе. Техника работает, платёж не давит.',
      cta: 'Подобрать график',
      icon: '<path d="M20 60 Q40 30 60 60 T100 60"/><path d="M20 80 Q40 65 60 80 T100 80"/><circle cx="60" cy="22" r="10"/><path d="M55 22 H65 M60 17 V27"/>',
    },
    production: {
      kicker: 'Сценарий 03 · Производство',
      title: 'Расширить производство',
      task: 'Купить станки, линии, оборудование, организовать монтаж.',
      solution: 'Финансируем объект, поставщика и монтаж - одной сделкой.',
      schedule: 'Можно отложить старт платежей до запуска линии.',
      result: 'Производство выходит на мощность раньше, чем начинаются основные платежи.',
      cta: 'Рассчитать оборудование',
      icon: '<rect x="18" y="36" width="84" height="48" rx="3"/><path d="M30 36 V24 H60 V36"/><circle cx="42" cy="60" r="8"/><circle cx="80" cy="60" r="8"/><path d="M18 84 H102"/>',
    },
    used: {
      kicker: 'Сценарий 04 · Б/у техника',
      title: 'Купить б/у технику',
      task: 'Взять технику с пробегом и не нарваться на скрытые проблемы.',
      solution: 'Проверка объекта и поставщика - до сделки и за наш счёт.',
      schedule: 'Срок и ставку подбираем с учётом года выпуска и состояния.',
      result: 'Прозрачная сделка, объект с историей, без сюрпризов после подписания.',
      cta: 'Проверить объект',
      icon: '<circle cx="60" cy="58" r="28"/><path d="M48 58 L56 66 L74 48"/><path d="M88 92 L74 78"/>',
    },
    seasonal: {
      kicker: 'Сценарий 05 · Сезонный график',
      title: 'Получить сезонный график',
      task: 'Платить больше в сезон и меньше вне сезона.',
      solution: 'Сезонные платежи под выручку: агро, стройка, перевозки.',
      schedule: 'Календарь платежей строим под пики бизнеса.',
      result: 'Платежи синхронны с выручкой - в межсезонье минимальная нагрузка.',
      cta: 'Собрать сезонный график',
      icon: '<path d="M16 84 L36 64 L52 74 L72 44 L88 56 L104 32"/><circle cx="36" cy="64" r="3.5"/><circle cx="52" cy="74" r="3.5"/><circle cx="72" cy="44" r="3.5"/><circle cx="88" cy="56" r="3.5"/>',
    },
    compare: {
      kicker: 'Сценарий 06 · Сравнение',
      title: 'Сравнить лизинг и кредит',
      task: 'Понять налоговую и платёжную нагрузку до сделки.',
      solution: 'Покажем платёж, сумму договора, возврат НДС и расходы.',
      schedule: 'Сравним 2-3 структуры и выберем оптимальную.',
      result: 'Решение принимаете с числами на руках, а не вслепую.',
      cta: 'Сравнить варианты',
      icon: '<rect x="18" y="32" width="36" height="56" rx="3"/><rect x="66" y="40" width="36" height="48" rx="3"/><path d="M24 44 H48 M24 54 H42 M72 50 H96 M72 60 H88"/>',
    },
  };

  const scenariosContainer = document.querySelector('[data-scenarios]');
  if (scenariosContainer) {
    const railItems = scenariosContainer.querySelectorAll('.scenarios-rail__item');
    const detail = scenariosContainer.querySelector('.scenario-detail');
    const fields = {
      kicker: detail.querySelector('[data-field="kicker"]'),
      title: detail.querySelector('[data-field="title"]'),
      task: detail.querySelector('[data-field="task"]'),
      solution: detail.querySelector('[data-field="solution"]'),
      schedule: detail.querySelector('[data-field="schedule"]'),
      result: detail.querySelector('[data-field="result"]'),
      ctaText: detail.querySelector('[data-field="cta-text"]'),
    };
    const iconSvg = detail.querySelector('[data-scenario-icon]');
    const innerWrap = detail.querySelector('.scenario-detail__inner');

    function setScenario(key) {
      const data = SCENARIOS[key];
      if (!data) return;
      if (fields.kicker)   fields.kicker.textContent = data.kicker;
      if (fields.title)    fields.title.textContent = data.title;
      if (fields.task)     fields.task.textContent = data.task;
      if (fields.solution) fields.solution.textContent = data.solution;
      if (fields.schedule) fields.schedule.textContent = data.schedule;
      if (fields.result)   fields.result.textContent = data.result;
      if (fields.ctaText)  fields.ctaText.textContent = data.cta;
      if (iconSvg)         iconSvg.innerHTML = data.icon;
      // Re-trigger entry animation
      if (innerWrap) {
        innerWrap.style.animation = 'none';
        void innerWrap.offsetWidth;
        innerWrap.style.animation = '';
      }
    }

    railItems.forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.scenario;
        railItems.forEach((b) => {
          const active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        setScenario(key);
      });
    });

    // initial
    setScenario('fleet');
  }

  // V11: APPLY PROGRESS removed (form compaction)
  // V25: CASES FILTER removed (6 кейсов — фильтр не нужен)

  // V11: docs PDF button - заглушка (PDF подготовим, пока скроллим к форме)
  const docsPdfBtn = document.querySelector('[data-docs-pdf]');
  if (docsPdfBtn) {
    docsPdfBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const apply = document.getElementById('apply');
      if (apply) apply.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // ============ SCENARIOS ACCORDION (V7) - exclusive open ============
  const accContainer = document.querySelector('[data-scenarios-acc]');
  if (accContainer) {
    const items = accContainer.querySelectorAll('details.scenario-acc');
    items.forEach((d) => {
      d.addEventListener('toggle', () => {
        if (d.open) {
          items.forEach((other) => {
            if (other !== d && other.open) other.open = false;
          });
        }
      });
    });
  }

  document.querySelectorAll('[data-asset]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const asset = el.dataset.asset;
      if (!asset) return;
      const radio = document.querySelector(`input[name="c-type"][value="${asset}"]`);
      if (radio) radio.checked = true;
      const calcForm = document.getElementById('calc-form');
      if (calcForm) {
        calcForm.dispatchEvent(new Event('change', { bubbles: true }));
        const priceEl = document.getElementById('c-price');
        if (priceEl) priceEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  });

  // ============ HERO ROTATOR ============
  // V19.3: категория плашки по РЕАЛЬНОМУ порядку фото 1-5 (со слов Стёпы)
  const HERO_CATEGORIES = [
    { title: 'Спецтехника в лизинг' },        // 1.webp
    { title: 'Оборудование в лизинг' },       // 2.webp
    { title: 'Грузовой транспорт в лизинг' }, // 3.webp
    { title: 'Оборудование в лизинг' },       // 4.webp
    { title: 'Спецтехника в лизинг' },        // 5.webp
  ];

  const rotator = document.querySelector('[data-rotator]');
  if (rotator) {
    const slides = rotator.querySelectorAll('img');
    const dotsContainer = document.querySelector('.hero__rotator-dots');
    const dots = dotsContainer ? dotsContainer.querySelectorAll('button') : [];
    const categoryTitle = document.querySelector('[data-category-title]');
    const categorySub = document.querySelector('[data-category-sub]');
    const total = slides.length;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let current = 0;
    let timerId = null;

    function showSlide(index) {
      current = (index + total) % total;
      slides.forEach((img, i) => img.classList.toggle('is-active', i === current));
      dots.forEach((dot, i) => {
        const active = i === current;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-current', active ? 'true' : 'false');
      });
      const cat = HERO_CATEGORIES[current];
      if (cat && categoryTitle) {
        categoryTitle.textContent = cat.title;
      }
    }

    function nextSlide() {
      showSlide(current + 1);
    }

    function startAutoplay() {
      stopAutoplay();
      if (reduceMotion) return;
      timerId = setInterval(nextSlide, 3060);
    }

    function stopAutoplay() {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    }

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        showSlide(i);
        startAutoplay();
      });
    });

    // Pause on hover within hero unit
    const heroUnit = rotator.closest('.hero__unit');
    if (heroUnit) {
      heroUnit.addEventListener('mouseenter', stopAutoplay);
      heroUnit.addEventListener('mouseleave', startAutoplay);
    }

    startAutoplay();
  }

  // ============ V19.5: HERO H1 — циклическая подсветка ключевых слов ============
  const titleWords = document.querySelectorAll('.hero__title-word');
  if (titleWords.length > 0) {
    let activeIdx = 0;
    titleWords[activeIdx].classList.add('is-active');
    setInterval(() => {
      titleWords[activeIdx].classList.remove('is-active');
      activeIdx = (activeIdx + 1) % titleWords.length;
      titleWords[activeIdx].classList.add('is-active');
    }, 2100);
  }

  // ============ V11/V27: MESSENGER FAB (sticky-cta убран — CTA внутри fab) ============
  const messengerFab = document.getElementById('messenger-fab');
  const heroEl = document.querySelector('.hero');
  const applyEl = document.getElementById('apply');

  if ('IntersectionObserver' in window && heroEl) {
    const heroObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const passedHero = !entry.isIntersecting && entry.boundingClientRect.bottom < 0;
        if (messengerFab) messengerFab.classList.toggle('is-visible', passedHero);
      });
    }, { threshold: 0, rootMargin: '0px' });
    heroObs.observe(heroEl);
  }

  if ('IntersectionObserver' in window && applyEl) {
    const applyObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (messengerFab) messengerFab.classList.toggle('is-hidden', entry.isIntersecting);
      });
    }, { threshold: 0.15 });
    applyObs.observe(applyEl);
  }

  if (messengerFab) {
    const fabToggle = messengerFab.querySelector('.messenger-fab__toggle');
    if (fabToggle) {
      fabToggle.addEventListener('click', () => {
        const isOpen = messengerFab.classList.toggle('is-open');
        fabToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        const options = messengerFab.querySelector('.messenger-fab__options');
        if (options) options.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      });
      document.addEventListener('click', (e) => {
        if (!messengerFab.contains(e.target) && messengerFab.classList.contains('is-open')) {
          messengerFab.classList.remove('is-open');
          fabToggle.setAttribute('aria-expanded', 'false');
        }
      });
    }
    // V27: клик по «Получить расчёт» — smooth scroll и закрытие fab-меню
    const calcOpt = messengerFab.querySelector('.messenger-fab__option--calc');
    if (calcOpt) {
      calcOpt.addEventListener('click', (e) => {
        e.preventDefault();
        messengerFab.classList.remove('is-open');
        fabToggle?.setAttribute('aria-expanded', 'false');
        applyEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const nameField = document.getElementById('a-name');
        if (nameField) setTimeout(() => nameField.focus({ preventScroll: true }), 600);
      });
    }
  }

  const metrics = document.querySelectorAll('.metric__num[data-count]');
  if ('IntersectionObserver' in window && metrics.length) {
    const animated = new WeakSet();
    const fmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        if (animated.has(el)) return;
        animated.add(el);
        animateCount(el);
      });
    }, { threshold: 0.4 });

    metrics.forEach((m) => io.observe(m));

    function animateCount(el) {
      const target = parseInt(el.dataset.count, 10);
      if (isNaN(target)) return;
      const duration = 1200;
      const start = performance.now();
      const initial = 0;

      function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(initial + (target - initial) * eased);
        el.textContent = fmt.format(current);
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
  }

  // ============ V25: LIGHTBOX для категорийных галерей (#assets) ============
  const lightbox = document.getElementById('lightbox');
  if (lightbox) {
    const lbImg = lightbox.querySelector('.lightbox__img');
    const lbTitle = lightbox.querySelector('.lightbox__title');
    const lbCounter = lightbox.querySelector('.lightbox__counter');
    const lbClose = lightbox.querySelector('.lightbox__close');
    const lbPrev = lightbox.querySelector('.lightbox__nav--prev');
    const lbNext = lightbox.querySelector('.lightbox__nav--next');

    const galleries = {};
    document.querySelectorAll('[data-gallery]').forEach((g) => {
      const cat = g.dataset.gallery;
      galleries[cat] = [...g.querySelectorAll('.card__thumb img')].map((img) => ({
        src: img.src,
        alt: img.alt || cat,
      }));
    });

    const titles = {
      transport: 'Транспорт',
      special: 'Спецтехника',
      agro: 'Сельхозтехника',
      equipment: 'Оборудование',
      realty: 'Недвижимость',
      used: 'Б/у техника',
    };

    let currentCat = null;
    let currentIdx = 0;
    let lastFocused = null;

    function showPhoto() {
      const list = galleries[currentCat] || [];
      if (!list.length) return;
      currentIdx = (currentIdx + list.length) % list.length;
      const photo = list[currentIdx];
      lbImg.src = photo.src;
      lbImg.alt = photo.alt;
      lbTitle.textContent = titles[currentCat] || currentCat;
      lbCounter.textContent = `${currentIdx + 1} / ${list.length}`;
    }

    function openLb(category, idx, source) {
      currentCat = category;
      currentIdx = idx;
      lastFocused = source || document.activeElement;
      showPhoto();
      lightbox.hidden = false;
      document.body.style.overflow = 'hidden';
      lbClose.focus();
    }

    function closeLb() {
      lightbox.hidden = true;
      document.body.style.overflow = '';
      if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus();
      }
    }

    document.querySelectorAll('.card__thumb').forEach((btn) => {
      btn.addEventListener('click', () => {
        const gallery = btn.closest('[data-gallery]');
        if (!gallery) return;
        const cat = gallery.dataset.gallery;
        const idx = parseInt(btn.dataset.galleryPhoto, 10) || 0;
        openLb(cat, idx, btn);
      });
    });

    lbClose.addEventListener('click', closeLb);
    lbPrev.addEventListener('click', () => { currentIdx -= 1; showPhoto(); });
    lbNext.addEventListener('click', () => { currentIdx += 1; showPhoto(); });

    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLb();
    });

    document.addEventListener('keydown', (e) => {
      if (lightbox.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); closeLb(); }
      if (e.key === 'ArrowLeft') { currentIdx -= 1; showPhoto(); }
      if (e.key === 'ArrowRight') { currentIdx += 1; showPhoto(); }
    });
  }
})();
