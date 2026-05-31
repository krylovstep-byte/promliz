// admin/assets/admin.js — интерактив админки.
// Без зависимостей, vanilla. Подключается на каждой странице.

(function () {
  initRowLinks();
  initChart();
  initAppForm();
})();

// ────────── Row click → navigate (заменяет inline onclick, чтобы не ломать CSP) ──────────
function initRowLinks() {
  document.querySelectorAll('tr[data-href]').forEach((tr) => {
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', (e) => {
      // Клик по ссылке/кнопке внутри строки — не переходим.
      if (e.target.closest('a, button, [data-no-row-click]')) return;
      location.href = tr.dataset.href;
    });
  });
}

// ────────── Dashboard chart ──────────
function initChart() {
  const canvas = document.getElementById('dash-chart');
  if (!canvas) return;

  const values = canvas.dataset.values.split(',').map(Number);
  const labels = canvas.dataset.labels.split(',');
  const max = Math.max(1, Number(canvas.dataset.max));

  // HiDPI
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || canvas.width;
  const cssH = canvas.clientHeight || canvas.height;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const padL = 40, padR = 16, padT = 16, padB = 28;
  const W = cssW - padL - padR;
  const H = cssH - padT - padB;
  const n = values.length;
  const stepX = W / Math.max(1, n - 1);

  ctx.clearRect(0, 0, cssW, cssH);

  // Сетка
  ctx.strokeStyle = '#E5E2DA';
  ctx.lineWidth = 1;
  ctx.font = '11px Onest, system-ui, sans-serif';
  ctx.fillStyle = '#98A2B3';
  for (let i = 0; i <= 4; i++) {
    const y = padT + (H / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + W, y);
    ctx.stroke();
    const v = Math.round(max - (max / 4) * i);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(v), padL - 6, y);
  }

  // Заливка под линией
  ctx.beginPath();
  ctx.moveTo(padL, padT + H);
  for (let i = 0; i < n; i++) {
    const x = padL + i * stepX;
    const y = padT + H - (values[i] / max) * H;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(padL + (n - 1) * stepX, padT + H);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, padT, 0, padT + H);
  grad.addColorStop(0, 'rgba(0, 148, 222, 0.22)');
  grad.addColorStop(1, 'rgba(0, 148, 222, 0)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Линия
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = padL + i * stepX;
    const y = padT + H - (values[i] / max) * H;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#0094DE';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Точки + всплывашка над ненулевыми
  ctx.fillStyle = '#0094DE';
  for (let i = 0; i < n; i++) {
    if (values[i] === 0) continue;
    const x = padL + i * stepX;
    const y = padT + H - (values[i] / max) * H;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Подписи оси X — каждый 5-й день
  ctx.fillStyle = '#98A2B3';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i < n; i += 5) {
    const x = padL + i * stepX;
    const d = labels[i].slice(5).replace('-', '.');
    ctx.fillText(d, x, padT + H + 8);
  }
  // Последняя дата
  if ((n - 1) % 5 !== 0) {
    const x = padL + (n - 1) * stepX;
    const d = labels[n - 1].slice(5).replace('-', '.');
    ctx.fillText(d, x, padT + H + 8);
  }
}

// ────────── Application form (update status / note / delete) ──────────
function initAppForm() {
  const form = document.getElementById('app-form');
  if (!form) return;

  const id = form.dataset.id;
  const hint = document.getElementById('app-save-hint');
  const badge = document.getElementById('app-status-badge');
  const deleteBtn = document.getElementById('app-delete');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    fd.append('id', id);

    try {
      const res = await fetch('/admin/api/update.php', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'update failed');

      hint.textContent = 'Сохранено';
      hint.classList.add('is-visible');
      setTimeout(() => hint.classList.remove('is-visible'), 2000);

      // Обновим бейдж статуса
      if (badge) {
        const sel = form.querySelector('select[name="status"]');
        const opt = sel.options[sel.selectedIndex];
        const status = sel.value;
        badge.textContent = opt.textContent;
        badge.className = 'badge badge--lg badge--' + statusColor(status);
      }
    } catch (err) {
      hint.textContent = 'Ошибка: ' + err.message;
      hint.style.color = '#D64545';
      hint.classList.add('is-visible');
    }
  });

  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Удалить эту заявку? Это действие нельзя отменить.')) return;

      const fd = new FormData();
      fd.append('id', id);
      fd.append('delete', '1');
      fd.append('csrf', form.querySelector('input[name="csrf"]').value);

      try {
        const res = await fetch('/admin/api/update.php', { method: 'POST', body: fd });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'delete failed');
        location.href = '/admin/applications.php';
      } catch (err) {
        alert('Не удалось удалить: ' + err.message);
      }
    });
  }
}

function statusColor(s) {
  // Legacy 'in_progress' и 'rejected' могут встретиться до миграции —
  // показываем зелёным, как и 'done'.
  return ({
    'new': 'blue',
    'done': 'green',
    'in_progress': 'green',
    'rejected': 'green',
  })[s] || 'gray';
}
