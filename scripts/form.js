(function () {
  const form = document.getElementById('apply-form');
  const thanks = document.getElementById('apply-thanks');
  if (!form) return;

  const fmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

  document.querySelectorAll('input[data-mask="phone"]').forEach(setupPhoneMask);
  document.querySelectorAll('input[data-mask="money"]').forEach(setupMoneyMask);
  document.querySelectorAll('input[data-mask="inn"]').forEach(setupInnMask);

  function setupPhoneMask(input) {
    function format(digits) {
      let d = digits.replace(/\D/g, '');
      if (d.startsWith('8')) d = '7' + d.slice(1);
      if (!d.startsWith('7')) d = '7' + d;
      d = d.slice(0, 11);

      let out = '+7';
      if (d.length > 1) out += ' (' + d.slice(1, 4);
      if (d.length >= 4) out += ') ' + d.slice(4, 7);
      if (d.length >= 7) out += '-' + d.slice(7, 9);
      if (d.length >= 9) out += '-' + d.slice(9, 11);
      return out;
    }

    input.addEventListener('focus', () => {
      if (!input.value) input.value = '+7 ';
    });

    input.addEventListener('input', () => {
      input.value = format(input.value);
      validateField(input);
    });

    input.addEventListener('blur', () => {
      const digits = input.value.replace(/\D/g, '');
      if (digits.length <= 1) input.value = '';
    });
  }

  function setupMoneyMask(input) {
    input.addEventListener('input', () => {
      const num = parseInt(input.value.replace(/\D/g, ''), 10);
      input.value = isNaN(num) ? '' : fmt.format(num);
    });
  }

  function setupInnMask(input) {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 12);
      validateField(input);
    });
  }

  const consent = document.getElementById('a-consent');
  const submitBtn = document.getElementById('a-submit');

  function syncSubmit() {
    submitBtn.disabled = !consent.checked;
  }

  consent.addEventListener('change', syncSubmit);
  syncSubmit();

  function validateField(input) {
    let valid = true;

    if (input.required && !input.value.trim()) valid = false;

    if (input.dataset.mask === 'phone') {
      const digits = input.value.replace(/\D/g, '');
      valid = digits.length === 11;
    }

    if (input.dataset.mask === 'inn' && input.value) {
      const len = input.value.length;
      valid = len === 10 || len === 12;
    }

    input.classList.toggle('is-invalid', !valid && input.value.length > 0);
    return valid;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    let allValid = true;
    form.querySelectorAll('input[required], select[required]').forEach((field) => {
      if (!validateField(field) || !field.value.trim()) {
        field.classList.add('is-invalid');
        allValid = false;
      }
    });

    if (!consent.checked) allValid = false;

    if (!allValid) {
      const firstInvalid = form.querySelector('.is-invalid, input:invalid');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправляем…';

    setTimeout(() => {
      form.hidden = true;
      thanks.hidden = false;
      thanks.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 600);
  });

  form.addEventListener('input', (e) => {
    if (e.target.matches('input, textarea, select')) {
      e.target.classList.remove('is-invalid');
    }
  });
})();
