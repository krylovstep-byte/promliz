(function () {
  const RATES = {
    transport:  0.20,
    special:    0.21,
    agro:       0.20,
    equipment:  0.21,
    realty:     0.19,
    used:       0.23,
  };

  const SCHEDULE_FACTOR = {
    annuity:    1.00,
    decreasing: 0.94,
    seasonal:   1.06,
  };

  const fmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
  const fmtPct = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

  function renderMoney(num, prefix) {
    const pfx = prefix ? `<span class="money__prefix">${prefix}</span>` : '';
    return `<span class="money">${pfx}<span class="money__amount">${fmt.format(num)}</span><span class="money__currency">₽</span></span>`;
  }

  function pulse(el) {
    if (!el) return;
    el.classList.remove('is-updated');
    void el.offsetWidth;
    el.classList.add('is-updated');
  }

  // V26: Counter-animation для money-значений (плавный одометр от старого к новому)
  const ANIM_DURATION = 180;
  const reduceMotionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

  function setMoneyValue(el, newValue, prefix) {
    if (!el) return;
    const amountEl = el.querySelector('.money__amount');
    if (!amountEl || reduceMotionMQ.matches) {
      // первый рендер или reduced motion — без анимации
      el.innerHTML = renderMoney(newValue, prefix);
      return;
    }
    // префикс: если изменился — перерендерить и анимировать на месте
    const pfxEl = el.querySelector('.money__prefix');
    const hasPfx = !!pfxEl;
    const needsPfx = !!prefix;
    if (hasPfx !== needsPfx) {
      el.innerHTML = renderMoney(newValue, prefix);
      return;
    }
    if (pfxEl && prefix && pfxEl.textContent !== prefix) pfxEl.textContent = prefix;

    const fromValue = parseMoney(amountEl.textContent);
    if (fromValue === newValue) return;

    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / ANIM_DURATION, 1);
      // ease-out-quart — резче, динамичнее
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(fromValue + (newValue - fromValue) * eased);
      amountEl.textContent = fmt.format(current);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // Counter для произвольного числа в .money__amount span (без обёртки .money)
  function setSimpleMoney(el, newValue, suffixHtml) {
    if (!el) return;
    let amountEl = el.querySelector('.money__amount');
    if (!amountEl || reduceMotionMQ.matches) {
      el.innerHTML = `<span class="money__amount">${fmt.format(newValue)}</span>${suffixHtml || ''}`;
      return;
    }
    const fromValue = parseMoney(amountEl.textContent);
    if (fromValue === newValue) return;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / ANIM_DURATION, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(fromValue + (newValue - fromValue) * eased);
      amountEl.textContent = fmt.format(current);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const form = document.getElementById('calc-form');
  if (!form) return;

  const priceEl    = document.getElementById('c-price');
  const advanceEl  = document.getElementById('c-advance');
  const termStepsEl = document.getElementById('c-term-steps');
  const taxModeEl  = document.getElementById('c-tax-mode');
  const advanceOut = document.getElementById('c-advance-out');
  const termOut    = document.getElementById('c-term-out');

  let taxMode = 'osno'; // 'osno' | 'usn'
  function getTaxMode() { return taxMode; }
  function setTaxMode(value) {
    taxMode = (value === 'usn') ? 'usn' : 'osno';
    if (taxModeEl) {
      taxModeEl.querySelectorAll('button').forEach((b) => {
        const active = b.dataset.value === taxMode;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
  }

  let cTerm = 36;
  function getCTerm() { return cTerm; }
  function setCTerm(value) {
    cTerm = parseInt(value, 10) || 36;
    if (termStepsEl) {
      termStepsEl.querySelectorAll('button').forEach((b) => {
        const active = parseInt(b.dataset.value, 10) === cTerm;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
    if (termOut) termOut.textContent = cTerm + (cTerm === 1 ? ' месяц' : (cTerm < 5 ? ' месяца' : ' месяцев'));
  }

  const monthlyOut = document.getElementById('r-monthly');
  const totalOut   = document.getElementById('r-total');
  const rateOut    = document.getElementById('r-rate');
  const taxOut     = document.getElementById('r-tax');
  const benefitOut = document.getElementById('r-benefit');
  const advanceOutBig = document.getElementById('r-advance');
  const termOutBig    = document.getElementById('r-term');
  const typeOutBig    = document.getElementById('r-type');
  const scheduleOutBig= document.getElementById('r-schedule');
  const chartLine     = document.getElementById('calc-chart-line');
  const chartFill     = document.getElementById('calc-chart-fill');
  const chartMidMonth = document.getElementById('chart-mid-month');
  const chartEndMonth = document.getElementById('chart-end-month');

  const TYPE_LABEL = {
    transport: 'Транспорт',
    special: 'Спецтехника',
    agro: 'Сельхоз',
    equipment: 'Оборудование',
    realty: 'Недвижимость',
    used: 'Б/у техника',
  };
  const SCHEDULE_LABEL = {
    annuity: 'Аннуитет',
    decreasing: 'Убывающий',
    seasonal: 'Сезонный',
  };

  function parseMoney(value) {
    if (!value) return 0;
    const digits = String(value).replace(/\D/g, '');
    return parseInt(digits, 10) || 0;
  }

  function maskMoney(input) {
    const num = parseMoney(input.value);
    input.value = num === 0 ? '' : fmt.format(num);
  }

  priceEl.addEventListener('input', () => {
    const caretEnd = priceEl.value.length;
    maskMoney(priceEl);
    update();
    if (document.activeElement === priceEl) {
      const newLen = priceEl.value.length;
      priceEl.setSelectionRange(newLen, newLen);
    }
  });

  function setRangeFill(el) {
    const min = parseFloat(el.min) || 0;
    const max = parseFloat(el.max) || 100;
    const val = parseFloat(el.value);
    const pct = ((val - min) / (max - min)) * 100;
    el.style.setProperty('--fill', pct + '%');
  }

  advanceEl.addEventListener('input', () => {
    advanceOut.textContent = advanceEl.value + '%';
    setRangeFill(advanceEl);
    update();
  });

  if (termStepsEl) {
    termStepsEl.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        setCTerm(btn.dataset.value);
        update();
      });
    });
  }

  setRangeFill(advanceEl);
  setCTerm(cTerm);
  setTaxMode(taxMode);

  // Tax-mode step-selector
  if (taxModeEl) {
    taxModeEl.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        setTaxMode(btn.dataset.value);
        update();
      });
    });
  }

  // Popover toggle (УСН/ОСНО объяснение)
  const popoverTrigger = document.querySelector('[data-popover-trigger="tax"]');
  const popover = document.querySelector('[data-popover="tax"]');
  if (popoverTrigger && popover) {
    popoverTrigger.addEventListener('click', () => {
      const isOpen = !popover.hidden;
      popover.hidden = isOpen;
      popoverTrigger.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      popoverTrigger.classList.toggle('is-open', !isOpen);
    });
    document.addEventListener('click', (e) => {
      if (!popover.contains(e.target) && e.target !== popoverTrigger) {
        popover.hidden = true;
        popoverTrigger.setAttribute('aria-expanded', 'false');
        popoverTrigger.classList.remove('is-open');
      }
    });
  }

  form.querySelectorAll('input[name="c-type"], input[name="c-schedule"]').forEach((radio) => {
    radio.addEventListener('change', update);
  });

  function getSelected(name) {
    const checked = form.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : '';
  }

  function calculate() {
    const price = parseMoney(priceEl.value);
    if (price <= 0) return null;

    const advancePct = parseInt(advanceEl.value, 10) / 100;
    const advance = price * advancePct;
    const principal = price - advance;
    const n = getCTerm();
    const type = getSelected('c-type');
    const schedule = getSelected('c-schedule');
    const mode = getTaxMode();

    const baseRate = RATES[type] || 0.17;
    const rate = baseRate * SCHEDULE_FACTOR[schedule];
    const i = rate / 12;

    const monthly = principal * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
    const total = monthly * n + advance;

    // V29: актуальные ставки 2026 — НДС 22%, налог на прибыль 25% (ОСНО), УСН 15%
    let vatReturn, profitSaving;
    if (mode === 'osno') {
      // Возврат НДС со ВСЕХ лизинговых платежей (а не только с цены покупки):
      // лизинговая компания каждый месяц выставляет счёт-фактуру с НДС 22%
      vatReturn = total * 0.22 / 1.22;
      // Все лизинговые платежи относятся на расходы 1:1 → экономия налога на прибыль 25%
      profitSaving = total * 0.25;
    } else {
      // УСН «Доходы минус расходы»: НДС не возмещается, налог 15% от расходов
      vatReturn = 0;
      profitSaving = total * 0.15;
    }
    const taxSaving = vatReturn + profitSaving;

    // Сравнение с банковским кредитом ~ 25% годовых (КС ЦБ + спред 2026)
    const creditRate = 0.25;
    const ci = creditRate / 12;
    const creditMonthly = principal * (ci * Math.pow(1 + ci, n)) / (Math.pow(1 + ci, n) - 1);
    const creditTotal = creditMonthly * n + advance;
    // Лизинг "дешевле" = (что заплатил бы в кредите) − (что заплатит в лизинге) + (вернул НДС/налоги)
    const leasingBenefit = Math.max(0, creditTotal - total + taxSaving);

    return {
      monthly: Math.round(monthly),
      total: Math.round(total),
      rate: rate,
      taxSaving: Math.round(taxSaving),
      leasingBenefit: Math.round(leasingBenefit),
    };
  }

  function update() {
    const result = calculate();

    if (!result) {
      monthlyOut.textContent = '—';
      totalOut.textContent = '—';
      rateOut.textContent = '—';
      taxOut.textContent = '—';
      if (benefitOut) benefitOut.textContent = '—';
      return;
    }

    setMoneyValue(monthlyOut, result.monthly);
    setMoneyValue(totalOut, result.total);
    rateOut.innerHTML = `<span class="money">${fmtPct.format(result.rate * 100)}%</span>`;
    setMoneyValue(taxOut, result.taxSaving, '~');
    if (benefitOut) setMoneyValue(benefitOut, result.leasingBenefit, '~');

    if (advanceOutBig)  advanceOutBig.textContent = advanceEl.value + '%';
    if (termOutBig)     termOutBig.textContent = getCTerm() + ' мес';
    if (typeOutBig)     typeOutBig.textContent = TYPE_LABEL[getSelected('c-type')] || '—';
    if (scheduleOutBig) scheduleOutBig.textContent = SCHEDULE_LABEL[getSelected('c-schedule')] || '—';

    drawChart(result.monthly, getCTerm(), getSelected('c-schedule'));
    pulse(monthlyOut);
  }

  function drawChart(monthly, n, schedule) {
    if (!chartLine || !chartFill) return;
    const w = 320, h = 64, pad = 4;
    const points = [];
    for (let i = 0; i < n; i++) {
      const x = pad + (i / Math.max(n - 1, 1)) * (w - pad * 2);
      let val = monthly;
      if (schedule === 'decreasing') {
        val = monthly * (1.35 - 0.7 * (i / Math.max(n - 1, 1)));
      } else if (schedule === 'seasonal') {
        const seasonAmp = 0.28;
        val = monthly * (1 + seasonAmp * Math.sin((i / 12) * 2 * Math.PI));
      }
      points.push({ x, val });
    }
    const max = Math.max(...points.map(p => p.val));
    const min = Math.min(...points.map(p => p.val));
    const range = Math.max(max - min, 1);
    const top = 6, bottom = h - 6;
    const coords = points.map(p => ({
      x: p.x,
      y: bottom - ((p.val - min) / range) * (bottom - top),
    }));
    const linePath = coords.map((p, i) => (i === 0 ? `M${p.x},${p.y.toFixed(1)}` : `L${p.x},${p.y.toFixed(1)}`)).join(' ');
    const fillPath = `${linePath} L${coords[coords.length - 1].x},${h} L${coords[0].x},${h} Z`;
    chartLine.setAttribute('d', linePath);
    chartFill.setAttribute('d', fillPath);
    if (chartMidMonth) chartMidMonth.textContent = Math.round(n / 2) + ' мес';
    if (chartEndMonth) chartEndMonth.textContent = n + ' мес';
  }

  document.querySelectorAll('.result__cta [data-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const action = btn.dataset.action;
      const applyForm = document.getElementById('apply-form');

      if (action === 'pdf') {
        if (parseMoney(priceEl.value) <= 0) {
          alert('Сначала укажите стоимость объекта');
          return;
        }
        alert('График платежей отправим на email после оформления заявки');
        return;
      }

      if (applyForm) {
        const assetSelect = applyForm.querySelector('#a-asset');
        const priceInput = applyForm.querySelector('#a-price');
        const commentInput = applyForm.querySelector('#a-comment');

        const type = getSelected('c-type');
        const price = parseMoney(priceEl.value);

        if (assetSelect && type) {
          assetSelect.value = type;
        }
        if (priceInput && price > 0) {
          priceInput.value = fmt.format(price);
        }

        if (action === 'supplier' && commentInput) {
          commentInput.value = 'Прошу проверить поставщика. Объект: ' + (assetSelect.options[assetSelect.selectedIndex]?.text || '');
        }

        document.getElementById('apply').scrollIntoView({ behavior: 'smooth', block: 'start' });

        const nameField = applyForm.querySelector('#a-name');
        if (nameField) {
          setTimeout(() => nameField.focus({ preventScroll: true }), 600);
        }
      }
    });
  });

  maskMoney(priceEl);
  update();

  // ============ MINI CALC IN HERO ============
  const miniForm = document.getElementById('mini-calc');
  if (miniForm) {
    const mPrice = document.getElementById('m-price');
    const mAdv = document.getElementById('m-advance');
    const mTermSteps = document.getElementById('m-term-steps');
    const mAdvOut = document.getElementById('m-advance-out');
    const mTermOut = document.getElementById('m-term-out');
    const mMonthly = document.getElementById('m-monthly');
    const mTotal = document.getElementById('m-total');
    const mTax = document.getElementById('m-tax');

    let currentTerm = 36;

    function getTerm() {
      return currentTerm;
    }

    function setTerm(value) {
      currentTerm = parseInt(value, 10) || 36;
      if (mTermSteps) {
        mTermSteps.querySelectorAll('button').forEach((b) => {
          const active = parseInt(b.dataset.value, 10) === currentTerm;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
      }
      if (mTermOut) mTermOut.textContent = currentTerm + (currentTerm === 1 ? ' месяц' : (currentTerm < 5 ? ' месяца' : ' месяцев'));
    }

    function miniCalc() {
      const price = parseMoney(mPrice.value);
      if (price <= 0) {
        mMonthly.textContent = '—';
        mTotal.textContent = '—';
        mTax.textContent = '—';
        return;
      }
      const advancePct = parseInt(mAdv.value, 10) / 100;
      const advance = price * advancePct;
      const principal = price - advance;
      const n = getTerm();
      const i = 0.20 / 12;
      const monthly = principal * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
      const total = monthly * n + advance;
      // V29: HERO mini-calc — те же актуальные формулы (предполагаем ОСНО)
      const taxSaving = total * 0.22 / 1.22 + total * 0.25;

      setSimpleMoney(mMonthly, Math.round(monthly), '<small class="money__suffix">₽ / мес</small>');
      setMoneyValue(mTotal, Math.round(total));
      mTax.textContent = fmt.format(Math.round(taxSaving)) + ' ₽';
      pulse(mMonthly);
    }

    mPrice.addEventListener('input', () => {
      const num = parseMoney(mPrice.value);
      mPrice.value = num === 0 ? '' : fmt.format(num);
      miniCalc();
    });

    mAdv.addEventListener('input', () => {
      mAdvOut.textContent = mAdv.value + '%';
      setRangeFill(mAdv);
      miniCalc();
    });

    if (mTermSteps) {
      mTermSteps.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', () => {
          setTerm(btn.dataset.value);
          miniCalc();
        });
      });
    }

    setRangeFill(mAdv);
    setTerm(currentTerm);

    document.querySelector('.hero__unit-cta')?.addEventListener('click', (e) => {
      e.preventDefault();
      // sync big calc in background
      priceEl.value = mPrice.value;
      advanceEl.value = mAdv.value;
      setCTerm(getTerm());
      document.getElementById('c-advance-out').textContent = mAdv.value + '%';
      setRangeFill(advanceEl);
      update();
      // prefill apply form
      const aPrice = document.getElementById('a-price');
      if (aPrice && parseMoney(mPrice.value) > 0) aPrice.value = mPrice.value;
      document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const nameField = document.getElementById('a-name');
      if (nameField) setTimeout(() => nameField.focus({ preventScroll: true }), 600);
    });

    miniCalc();
  }
})();
