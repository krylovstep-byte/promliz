/**
 * V63.0 — обработчик формы заявки #apply-form.
 *
 * Что делает:
 *   1. Маски на #a-phone (+7 (XXX) XXX-XX-XX) и #a-inn (только цифры, до 12).
 *   2. Чекбокс #a-consent контролирует disabled у кнопки submit.
 *   3. Клиентская валидация (name, phone=11 цифр, email regex, inn=10/12 цифр).
 *   4. POST на /admin/api/submit.php в multipart/form-data через FormData.
 *   5. На success — скрывает форму, показывает #apply-thanks, скроллит к нему.
 *      На ошибку — показывает #apply-error и/или подсвечивает поля .is-invalid.
 *
 * Бэкенд: admin/api/submit.php (PHP + SQLite + mail() на notify_email).
 * Honeypot-поле name="botcheck" уже есть в HTML — бэк сам его обрабатывает.
 */

(function () {
  'use strict';

  const SUBMIT_URL = '/admin/api/submit.php';
  const PHONE_DIGITS_NEEDED = 11;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  // ────────────────────────────────────────────────────────────────────
  // Маски
  // ────────────────────────────────────────────────────────────────────

  function formatPhone(raw) {
    let d = String(raw || '').replace(/\D/g, '');
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (d.length > 0 && !d.startsWith('7')) d = '7' + d;
    d = d.slice(0, PHONE_DIGITS_NEEDED);
    if (d.length === 0) return '';
    let out = '+7';
    if (d.length > 1)  out += ' (' + d.slice(1, 4);
    if (d.length >= 4) out += ') ' + d.slice(4, 7);
    if (d.length >= 7) out += '-'  + d.slice(7, 9);
    if (d.length >= 9) out += '-'  + d.slice(9, 11);
    return out;
  }

  function setupPhoneMask(input) {
    input.addEventListener('focus', function () {
      if (!input.value) input.value = '+7 ';
    });
    input.addEventListener('input', function () {
      input.value = formatPhone(input.value);
    });
    input.addEventListener('blur', function () {
      // Если в фокусе оставили только "+7" / "+7 " — очистить, чтобы placeholder вернулся
      if (input.value.replace(/\D/g, '').length <= 1) input.value = '';
    });
  }

  function setupInnMask(input) {
    input.addEventListener('input', function () {
      input.value = input.value.replace(/\D/g, '').slice(0, 12);
    });
  }

  function setupAllMasks(form) {
    form.querySelectorAll('input[data-mask]').forEach(function (el) {
      const type = el.dataset.mask;
      if (type === 'phone') setupPhoneMask(el);
      else if (type === 'inn') setupInnMask(el);
    });
  }

  // ────────────────────────────────────────────────────────────────────
  // Валидация
  // ────────────────────────────────────────────────────────────────────

  function markInvalid(input, on) {
    if (input) input.classList.toggle('is-invalid', !!on);
  }

  function validate(form) {
    const name  = form.querySelector('#a-name');
    const phone = form.querySelector('#a-phone');
    const email = form.querySelector('#a-email');
    const inn   = form.querySelector('#a-inn');

    const bad = {
      name:  !name.value.trim(),
      phone: phone.value.replace(/\D/g, '').length !== PHONE_DIGITS_NEEDED,
      email: !EMAIL_RE.test(email.value.trim()),
      inn:   ![10, 12].includes(inn.value.replace(/\D/g, '').length),
    };

    markInvalid(name,  bad.name);
    markInvalid(phone, bad.phone);
    markInvalid(email, bad.email);
    markInvalid(inn,   bad.inn);

    return !Object.values(bad).some(Boolean);
  }

  // При повторном вводе в инвалидное поле — снимаем красный бордер,
  // юзер видит что его правка зачтена
  function wireFieldRevalidate(form) {
    form.querySelectorAll('input, textarea').forEach(function (el) {
      el.addEventListener('input', function () {
        if (el.classList.contains('is-invalid')) markInvalid(el, false);
      });
    });
  }

  // ────────────────────────────────────────────────────────────────────
  // Чекбокс согласия → disabled кнопки submit
  // ────────────────────────────────────────────────────────────────────

  function wireConsent(form) {
    const consent = form.querySelector('#a-consent');
    const submit  = form.querySelector('#a-submit');
    if (!consent || !submit) return;
    const sync = function () { submit.disabled = !consent.checked; };
    consent.addEventListener('change', sync);
    sync();
  }

  // ────────────────────────────────────────────────────────────────────
  // Отправка
  // ────────────────────────────────────────────────────────────────────

  async function postFormData(fd) {
    // Не выставляем Content-Type вручную — браузер сам сделает
    // multipart/form-data с правильным boundary.
    return fetch(SUBMIT_URL, {
      method: 'POST',
      body: fd,
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
  }

  async function readResponse(response, fd) {
    const ct = response.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      return response.json();
    }
    // Anti-bot REG.RU может ответить HTML с <meta http-equiv="Refresh">,
    // когда у клиента ещё нет cookies. Браузер обычно сам отрабатывает редирект,
    // но из fetch это нужно повторить вручную — cookies уже подцепились к
    // первому ответу.
    const text = await response.text();
    if (/<meta[^>]+http-equiv=["']?Refresh/i.test(text)) {
      const retry = await postFormData(fd);
      return retry.json();
    }
    throw new Error('non-json response: ' + text.slice(0, 80));
  }

  function highlightServerErrors(form, fields) {
    if (!fields) return;
    Object.keys(fields).forEach(function (name) {
      const input = form.querySelector('[name="' + name + '"]');
      if (input) markInvalid(input, true);
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const form    = e.target;
    const submit  = form.querySelector('#a-submit');
    const errBox  = document.getElementById('apply-error');
    const thanks  = document.getElementById('apply-thanks');
    const consent = form.querySelector('#a-consent');

    if (!validate(form)) {
      const firstInvalid = form.querySelector('.is-invalid');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    if (errBox) errBox.hidden = true;

    const fd = new FormData(form);
    fd.set('source_page', location.href);

    const originalHtml = submit.innerHTML;
    submit.disabled = true;
    submit.textContent = 'Отправляем…';

    try {
      const response = await postFormData(fd);
      const json = await readResponse(response, fd);

      if (json && json.success) {
        form.hidden = true;
        if (thanks) {
          thanks.hidden = false;
          thanks.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }

      if (json && json.error === 'validation') {
        highlightServerErrors(form, json.fields);
        const first = form.querySelector('.is-invalid');
        if (first) first.focus();
        return;
      }

      // rate_limited, too_long:X, всё прочее → общая ошибка
      if (errBox) errBox.hidden = false;
    } catch (err) {
      // Сетевая ошибка / нестандартный ответ
      if (errBox) errBox.hidden = false;
      // eslint-disable-next-line no-console
      console.error('[apply-form]', err);
    } finally {
      submit.innerHTML = originalHtml;
      submit.disabled = consent ? !consent.checked : false;
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // Init
  // ────────────────────────────────────────────────────────────────────

  function init() {
    const form = document.getElementById('apply-form');
    if (!form) return;
    setupAllMasks(form);
    wireConsent(form);
    wireFieldRevalidate(form);
    form.addEventListener('submit', handleSubmit);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
