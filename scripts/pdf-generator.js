/* V53: PDF-генератор графика лизинговых платежей.
   Шаблон 1:1 с «Шаблон 3 версия pdf.pdf» (ООО «МБ-Лизинг» / Промлизинг).

   КРИТИЧНО (V53 fix):
   - Все классы с префиксом pdf- чтобы изолироваться от сайтовых .header / .footer.
     Сайтовый .header { position: fixed } унёс PDF-таблицу в (0,0) → налезание.
     Сайтовый .footer { background: navy } → чёрный футер в PDF.
   - На корне .pdf-doc * сброс position: static !important и др. наследуемых
     потенциально опасных свойств от сайтовых стилей.
*/
(function () {
  const HTML2CANVAS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  let loadPromise = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  function getJsPdfCtor() {
    return (window.jspdf && window.jspdf.jsPDF) || window.jsPDF || null;
  }

  function loadLibs() {
    if (window.html2canvas && getJsPdfCtor()) return Promise.resolve();
    if (loadPromise) return loadPromise;
    const tasks = [];
    if (!window.html2canvas) tasks.push(loadScript(HTML2CANVAS_CDN));
    if (!getJsPdfCtor()) tasks.push(loadScript(JSPDF_CDN));
    loadPromise = Promise.all(tasks).then(() => {
      if (!window.html2canvas || !getJsPdfCtor()) {
        loadPromise = null;
        throw new Error('libs missing after load');
      }
    }).catch(e => { loadPromise = null; throw e; });
    return loadPromise;
  }

  const fmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
  const fmt2 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

  function paymentDates(n) {
    const arr = [];
    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth() + 1;
    if (m > 11) { m = 0; y += 1; }
    for (let i = 0; i < n; i++) {
      arr.push(MONTHS_RU[m] + ' ' + y);
      m += 1;
      if (m > 11) { m = 0; y += 1; }
    }
    return arr;
  }

  function todayStr() {
    const d = new Date();
    return String(d.getDate()).padStart(2, '0') + '.' +
           String(d.getMonth() + 1).padStart(2, '0') + '.' +
           d.getFullYear();
  }

  function buildScheduleColumns(monthly, n, advance, total) {
    const dates = paymentDates(n);
    const rows = [];
    rows.push({ label: 'Всего', val: total, isHeader: true });
    rows.push({ label: 'Первый взнос', val: advance, isHeader: true });
    for (let i = 0; i < n; i++) rows.push({ num: i + 1, date: dates[i], val: monthly });
    const perCol = Math.ceil(rows.length / 3);
    return [rows.slice(0, perCol), rows.slice(perCol, perCol * 2), rows.slice(perCol * 2)];
  }

  function renderSchedRow(r) {
    if (r.isHeader) {
      return '<tr class="pdf-rh"><td class="pdf-m"></td><td class="pdf-lbl">' + r.label +
             '</td><td class="pdf-n">' + fmt.format(r.val) + ' ₽</td></tr>';
    }
    return '<tr><td class="pdf-m">' + r.num + '</td><td>' + r.date +
           '</td><td class="pdf-n">' + fmt.format(r.val) + ' ₽</td></tr>';
  }

  function renderSchedTable(rows) {
    return '<table class="pdf-sched">' +
      '<colgroup><col style="width:36px"><col><col style="width:96px"></colgroup>' +
      '<thead><tr><th class="pdf-m">Мес.</th><th>Дата платежа</th><th class="pdf-n">Платеж, в т.ч.<br>НДС</th></tr></thead>' +
      '<tbody>' + rows.map(renderSchedRow).join('') + '</tbody></table>';
  }

  // SVG лого — две арки в стиле «Промлизинг»
  const LOGO_SVG = '<svg width="62" height="40" viewBox="0 0 82 54" xmlns="http://www.w3.org/2000/svg">' +
    '<g stroke="#0094DE" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M5 50 Q5 6 25 6 Q41 6 41 22"/>' +
      '<path d="M41 22 Q41 6 57 6 Q77 6 77 50"/>' +
      '<line x1="5" y1="50" x2="77" y2="50"/>' +
    '</g>' +
    '</svg>';

  // A4 landscape = 297×210mm = 1123×794px (96 dpi). Padding 24×28.
  // ВАЖНО: префикс pdf- на ВСЕХ классах + сброс position на корне.
  const PDF_CSS =
    /* ====== ИЗОЛЯЦИОННЫЙ СБРОС (V53) ====== */
    '.pdf-doc, .pdf-doc *, .pdf-doc *::before, .pdf-doc *::after{' +
      'position:static !important;float:none !important;transform:none !important;' +
      'box-shadow:none !important;text-shadow:none !important;filter:none !important;' +
      'backdrop-filter:none !important;clip-path:none !important;mask:none !important;' +
      'animation:none !important;transition:none !important;opacity:1 !important;' +
      'visibility:visible !important;z-index:auto !important;' +
    '}' +
    '.pdf-doc a{text-decoration:none !important;color:inherit !important;}' +
    /* ====== БАЗА ====== */
    '.pdf-doc{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#04384F;width:1123px;background:#FFFFFF;line-height:1.4;font-size:12px;font-weight:400;}' +
    '.pdf-doc *{box-sizing:border-box;margin:0;padding:0;border:0;background:transparent;}' +
    '.pdf-doc .pdf-page{width:1123px;height:794px;background:#FFFFFF;overflow:hidden;}' +
    '.pdf-doc .pdf-page-inner{width:1123px;height:794px;padding:24px 28px 18px;}' +
    /* ====== HEADER ====== */
    '.pdf-doc table.pdf-header{width:1067px;table-layout:fixed;border-collapse:collapse;}' +
    '.pdf-doc table.pdf-header td{vertical-align:top;padding:0;border:0;background:transparent;}' +
    '.pdf-doc table.pdf-header td.pdf-h-l{width:707px;padding-bottom:8px;}' +
    '.pdf-doc table.pdf-header td.pdf-h-r{width:360px;padding-bottom:8px;text-align:left;}' +
    /* Логотип */
    '.pdf-doc table.pdf-logo-row{border-collapse:collapse;}' +
    '.pdf-doc table.pdf-logo-row td{vertical-align:middle;padding:0;border:0;}' +
    '.pdf-doc table.pdf-logo-row td.pdf-l-svg{padding-right:10px;width:72px;}' +
    '.pdf-doc .pdf-brand-name{font-weight:800;font-size:28px;color:#0094DE;line-height:1;letter-spacing:-0.01em;}' +
    '.pdf-doc .pdf-slogan{font-size:11px;color:#04384F;margin-top:6px;font-weight:700;}' +
    '.pdf-doc .pdf-contacts{font-size:10px;color:#0094DE;margin-top:4px;text-decoration:underline;letter-spacing:0.01em;}' +
    /* Голубая плашка справа */
    '.pdf-doc .pdf-hr-badge{background:#0094DE !important;color:#FFFFFF !important;padding:10px 14px 12px;text-align:right;font-size:11px;line-height:1.5;}' +
    '.pdf-doc .pdf-hr-badge strong{display:block;font-size:13px;font-weight:700;color:#FFFFFF !important;}' +
    '.pdf-doc .pdf-hr-badge em{display:block;font-style:italic;font-weight:400;color:#FFFFFF !important;}' +
    /* Полоска под хедером */
    '.pdf-doc .pdf-accent-bar{height:3px;width:1067px;background:linear-gradient(90deg,#0094DE 0%,#0094DE 66%,#FF9545 66%,#FF9545 78%,transparent 78%) !important;}' +
    /* ====== ЗАГОЛОВКИ ====== */
    '.pdf-doc h1{font-size:24px;text-align:center;margin:20px 0 12px;font-weight:700;color:#04384F;}' +
    '.pdf-doc h1.pdf-h1-left{text-align:left;margin:14px 0 12px;font-size:22px;color:#04384F;}' +
    '.pdf-doc h2{font-size:16px;text-align:center;color:#04384F;text-transform:uppercase;letter-spacing:0.08em;margin:14px 0 8px;font-weight:700;}' +
    /* ====== СВОДНАЯ ТАБЛИЦА ====== */
    '.pdf-doc table.pdf-summary{width:1067px;table-layout:fixed;border-collapse:collapse;}' +
    '.pdf-doc table.pdf-summary th{background:#0094DE !important;color:#FFFFFF !important;padding:11px 8px;font-size:12px;font-weight:600;text-align:center;border:1px solid #0094DE;line-height:1.35;}' +
    '.pdf-doc table.pdf-summary td{padding:14px 8px;text-align:center;font-weight:700;font-size:14px;background:#FFFFFF !important;border:1px solid #C0CCD7;color:#04384F;}' +
    '.pdf-doc table.pdf-summary td.pdf-client{font-weight:700;letter-spacing:0.04em;}' +
    '.pdf-doc table.pdf-summary td.pdf-tax-benefit{color:#2A8556 !important;font-weight:700;font-size:14px;}' +
    /* Note */
    '.pdf-doc .pdf-note-line{font-size:10px;font-style:italic;margin-top:6px;color:#5A6B7A;}' +
    /* ====== ГРАФИК ====== */
    '.pdf-doc table.pdf-sched-grid{width:1067px;table-layout:fixed;border-collapse:separate;border-spacing:14px 0;margin-top:2px;margin-left:-7px;}' +
    '.pdf-doc table.pdf-sched-grid td{vertical-align:top;width:345px;padding:0;border:0;background:transparent;}' +
    '.pdf-doc table.pdf-sched{width:100%;table-layout:fixed;border-collapse:collapse;font-size:10px;}' +
    '.pdf-doc table.pdf-sched th{background:#0094DE !important;color:#FFFFFF !important;font-weight:600;padding:5px 4px;font-size:9.5px;border:1px solid #0094DE;text-align:center;line-height:1.2;}' +
    '.pdf-doc table.pdf-sched th.pdf-n{text-align:center;}' +
    '.pdf-doc table.pdf-sched td{padding:5px 6px;border:1px solid #E0E6EB;color:#04384F;font-size:10px;background:#FFFFFF !important;}' +
    '.pdf-doc table.pdf-sched td.pdf-m{text-align:center;color:#5A6B7A;}' +
    '.pdf-doc table.pdf-sched td.pdf-n{text-align:right;font-weight:600;white-space:nowrap;}' +
    '.pdf-doc table.pdf-sched td.pdf-lbl{font-weight:700;color:#0094DE !important;text-align:center;}' +
    '.pdf-doc table.pdf-sched .pdf-rh td{background:#FFFFFF !important;color:#0094DE !important;font-weight:700;}' +
    '.pdf-doc table.pdf-sched .pdf-rh td.pdf-n{color:#0094DE !important;font-weight:700;}' +
    '.pdf-doc table.pdf-sched .pdf-rh td.pdf-m{color:#0094DE !important;}' +
    /* ====== ФУТЕР ====== */
    '.pdf-doc .pdf-footer{margin-top:12px;text-align:center;font-size:11px;color:#0094DE !important;font-weight:700;width:1067px;letter-spacing:0.01em;background:#FFFFFF !important;padding:0;}' +
    '.pdf-doc .pdf-footer .pdf-u{text-decoration:underline;color:#0094DE !important;}' +
    /* ====== PAGE 2: 2 КОЛОНКИ ====== */
    '.pdf-doc table.pdf-twocols-grid{width:1067px;table-layout:fixed;border-collapse:collapse;margin-top:10px;}' +
    '.pdf-doc table.pdf-twocols-grid td{vertical-align:top;padding:0;border:0;background:transparent;}' +
    '.pdf-doc table.pdf-twocols-grid td.pdf-col-left{width:520px;padding-right:14px;}' +
    '.pdf-doc table.pdf-twocols-grid td.pdf-col-right{width:533px;padding-left:14px;}' +
    '.pdf-doc .pdf-panel-title{font-size:13px;font-weight:700;margin-bottom:10px;color:#0094DE;}' +
    /* Params слева */
    '.pdf-doc table.pdf-params{width:506px;table-layout:fixed;border-collapse:collapse;font-size:11px;}' +
    '.pdf-doc table.pdf-params col.pdf-c1{width:240px;}' +
    '.pdf-doc table.pdf-params col.pdf-c2{width:266px;}' +
    '.pdf-doc table.pdf-params th{background:#0094DE !important;padding:9px;font-weight:600;text-align:center;color:#FFFFFF !important;border:1px solid #0094DE;font-size:12px;}' +
    '.pdf-doc table.pdf-params td{padding:9px 12px;border:1px solid #C0CCD7;color:#04384F;vertical-align:middle;background:#FFFFFF !important;line-height:1.3;}' +
    '.pdf-doc table.pdf-params td:first-child{font-weight:500;}' +
    '.pdf-doc table.pdf-params td:last-child{font-weight:600;}' +
    '.pdf-doc table.pdf-params tr.pdf-highlight td{background:#0094DE !important;color:#FFFFFF !important;font-weight:700;border-color:#0094DE;}' +
    /* Tax effect справа */
    '.pdf-doc table.pdf-tax-eff{width:519px;table-layout:fixed;border-collapse:collapse;font-size:11px;}' +
    '.pdf-doc table.pdf-tax-eff col.pdf-c1{width:300px;}' +
    '.pdf-doc table.pdf-tax-eff col.pdf-c2{width:219px;}' +
    '.pdf-doc table.pdf-tax-eff th{background:#0094DE !important;color:#FFFFFF !important;padding:11px 14px;font-size:11.5px;font-weight:600;line-height:1.45;border:1px solid #0094DE;text-align:center;}' +
    '.pdf-doc table.pdf-tax-eff td{padding:11px 12px;border:1px solid #C0CCD7;vertical-align:middle;background:#FFFFFF !important;}' +
    '.pdf-doc table.pdf-tax-eff td.pdf-lbl{color:#04384F;font-size:11px;line-height:1.4;font-weight:500;}' +
    '.pdf-doc table.pdf-tax-eff td.pdf-lbl small{color:#5A6B7A;font-size:9.5px;display:block;margin-top:3px;font-weight:400;}' +
    '.pdf-doc table.pdf-tax-eff td.pdf-val{text-align:right;font-size:16px;font-weight:700;color:#0094DE !important;white-space:nowrap;}' +
    '.pdf-doc table.pdf-tax-eff tr.pdf-total td{background:#E8F4EE !important;}' +
    '.pdf-doc table.pdf-tax-eff tr.pdf-total td.pdf-lbl{color:#04384F;font-weight:700;font-size:11.5px;}' +
    '.pdf-doc table.pdf-tax-eff tr.pdf-total td.pdf-val{color:#2A8556 !important;font-size:17px;}' +
    /* Footnote */
    '.pdf-doc .pdf-footnote{font-size:10px;font-style:italic;color:#5A6B7A;margin-top:14px;line-height:1.5;}';

  function injectStyles() {
    if (document.getElementById('pdf-doc-styles')) return;
    const s = document.createElement('style');
    s.id = 'pdf-doc-styles';
    s.textContent = PDF_CSS;
    document.head.appendChild(s);
  }

  function buildHeader(date, rightHtml, withSlogan, withCyanBadge) {
    const rightBlock = withCyanBadge
      ? '<div class="pdf-hr-badge">' + rightHtml + '</div>'
      : rightHtml;
    return (
      '<table class="pdf-header"><tr>' +
        '<td class="pdf-h-l">' +
          '<table class="pdf-logo-row"><tr>' +
            '<td class="pdf-l-svg">' + LOGO_SVG + '</td>' +
            '<td>' +
              '<div class="pdf-brand-name">Промлизинг</div>' +
              (withSlogan ? '<div class="pdf-slogan">Работаем с 2001 года!</div>' : '') +
            '</td>' +
          '</tr></table>' +
          (withSlogan ? '<div class="pdf-contacts">promliz.com&nbsp;&nbsp;|&nbsp;&nbsp;promlizing@inbox.ru&nbsp;&nbsp;|&nbsp;&nbsp;т/ф (4852) 77-01-87, 58-50-60</div>' : '') +
        '</td>' +
        '<td class="pdf-h-r">' + rightBlock + '</td>' +
      '</tr></table>' +
      '<div class="pdf-accent-bar"></div>'
    );
  }

  function buildFooter() {
    return '<div class="pdf-footer">' +
      'т/ф (4852) 77-01-87, 58-50-60 | г. Ярославль, ул. Победы, д. 38/27, оф. 512 | ' +
      '<span class="pdf-u">promliz.com</span> | <span class="pdf-u">promlizing@inbox.ru</span>' +
      '</div>';
  }

  function buildPage1(d, date, cols) {
    return (
      '<div class="pdf-page pdf-page-1">' +
        '<div class="pdf-page-inner">' +
          buildHeader(date,
            '<strong>Приложение №2</strong>' +
            '<em>Конфиденциально</em>' +
            'ООО "МБ-Лизинг"<br>' +
            'Дата: ' + date,
            true, true) +

          '<h1>Предварительный расчет по договору лизинга</h1>' +

          '<table class="pdf-summary">' +
            '<colgroup>' +
              '<col style="width:170px">' +
              '<col style="width:220px">' +
              '<col style="width:185px">' +
              '<col style="width:170px">' +
              '<col style="width:322px">' +
            '</colgroup>' +
            '<thead><tr>' +
              '<th>Клиент</th>' +
              '<th>Стоимость имущества</th>' +
              '<th>Первый взнос</th>' +
              '<th>Срок лизинга</th>' +
              '<th>Потенциальная<br>налоговая выгода</th>' +
            '</tr></thead>' +
            '<tbody><tr>' +
              '<td class="pdf-client">ООО______</td>' +
              '<td>' + fmt.format(d.price) + ' ₽</td>' +
              '<td>' + fmt.format(d.advance) + ' ₽</td>' +
              '<td>' + d.n + ' мес.</td>' +
              '<td class="pdf-tax-benefit">' + fmt.format(d.taxSaving) + ' ₽</td>' +
            '</tr></tbody>' +
          '</table>' +
          '<p class="pdf-note-line">Для расчета условно принято: 360 дней в году, 30 дней в месяце.</p>' +

          '<h2>График лизинговых платежей</h2>' +
          '<table class="pdf-sched-grid"><tr>' +
            '<td>' + renderSchedTable(cols[0]) + '</td>' +
            '<td>' + renderSchedTable(cols[1]) + '</td>' +
            '<td>' + renderSchedTable(cols[2]) + '</td>' +
          '</tr></table>' +

          buildFooter() +
        '</div>' +
      '</div>'
    );
  }

  function buildPage2(d, date) {
    return (
      '<div class="pdf-page pdf-page-2">' +
        '<div class="pdf-page-inner">' +
          buildHeader(date,
            '<div style="text-align:right;font-size:13px;font-weight:700;color:#0094DE;line-height:1.4;padding-top:6px;">' +
              'Условия лизинга - продолжение' +
              '<div style="font-size:11px;color:#04384F;font-weight:500;margin-top:3px;">Дата: ' + date + '&nbsp;&nbsp;|&nbsp;&nbsp;Конфиденциально</div>' +
            '</div>',
            false, false) +

          '<h1 class="pdf-h1-left">Итоговые условия и налоговый эффект</h1>' +

          '<table class="pdf-twocols-grid"><tr>' +
            '<td class="pdf-col-left">' +
              '<div class="pdf-panel-title">Итоговые условия</div>' +
              '<table class="pdf-params">' +
                '<colgroup><col class="pdf-c1"><col class="pdf-c2"></colgroup>' +
                '<thead><tr><th colspan="2">Параметры договора</th></tr></thead>' +
                '<tbody>' +
                  '<tr><td>Стоимость предмета лизинга</td><td>' + fmt2.format(d.price) + ' ₽</td></tr>' +
                  '<tr><td>Авансовый платеж</td><td>' + d.advancePct + '% (' + fmt2.format(d.advance) + ' ₽)</td></tr>' +
                  '<tr><td>Срок договора лизинга</td><td>' + d.n + ' мес.</td></tr>' +
                  '<tr><td>Страхование имущества</td><td>Не включено в расчет. Страховые компании: АО СОГАЗ, СК СОГЛАСИЕ</td></tr>' +
                  '<tr class="pdf-highlight"><td>Сумма договора</td><td>' + fmt2.format(d.total) + ' ₽</td></tr>' +
                  '<tr><td>Выкупная стоимость</td><td>5 000 ₽</td></tr>' +
                  '<tr><td>Постановка на учет</td><td>Клиент</td></tr>' +
                  '<tr><td>Годовое удорожание</td><td>' + d.annualMarkup + '%</td></tr>' +
                '</tbody>' +
              '</table>' +
            '</td>' +
            '<td class="pdf-col-right">' +
              '<div class="pdf-panel-title">Налоговый эффект</div>' +
              '<table class="pdf-tax-eff">' +
                '<colgroup><col class="pdf-c1"><col class="pdf-c2"></colgroup>' +
                '<thead><tr><th colspan="2">Приобретайте автотранспорт, спецтехнику и оборудование в лизинг и получайте экономию на налогах в течение срока договора.</th></tr></thead>' +
                '<tbody>' +
                  '<tr><td class="pdf-lbl">Возврат НДС 22%<small>со всей суммы договора лизинга</small></td><td class="pdf-val">' + fmt2.format(d.vatReturn) + ' ₽</td></tr>' +
                  '<tr><td class="pdf-lbl">Экономия по налогу на прибыль<small>лизинговые платежи уменьшают налоговую базу</small></td><td class="pdf-val">' + fmt2.format(d.profitSaving) + ' ₽</td></tr>' +
                  '<tr class="pdf-total"><td class="pdf-lbl">Потенциальный совокупный налоговый<br>эффект</td><td class="pdf-val">' + fmt2.format(d.taxSaving) + ' ₽</td></tr>' +
                '</tbody>' +
              '</table>' +
              '<p class="pdf-footnote">Примечание: расчет предварительный. Финальные условия зависят от предмета лизинга, параметров клиента, страхования и условий поставщика.</p>' +
            '</td>' +
          '</tr></table>' +

          buildFooter() +
        '</div>' +
      '</div>'
    );
  }

  function buildHtml(d) {
    const date = todayStr();
    const cols = buildScheduleColumns(d.monthly, d.n, d.advance, d.total);
    return '<div class="pdf-doc">' + buildPage1(d, date, cols) + buildPage2(d, date) + '</div>';
  }

  function makeOverlay() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,0.96);' +
      'z-index:2147483647;display:flex;align-items:center;justify-content:center;' +
      'font-family:system-ui,sans-serif;font-size:18px;color:#04384F;font-weight:600;';
    overlay.innerHTML =
      '<div style="text-align:center;">' +
        '<div style="width:48px;height:48px;border:4px solid #E0E6EB;border-top-color:#0094DE;' +
          'border-radius:50%;animation:pdf-spin 0.9s linear infinite;margin:0 auto 16px;"></div>' +
        'Генерация PDF…' +
      '</div>' +
      '<style>@keyframes pdf-spin{to{transform:rotate(360deg)}}</style>';
    return overlay;
  }

  async function generatePdf(data) {
    let wrap = null;
    let overlay = null;
    try {
      overlay = makeOverlay();
      document.body.appendChild(overlay);

      injectStyles();
      await loadLibs();

      const html2canvas = window.html2canvas;
      const jsPDFCtor = getJsPdfCtor();
      if (!html2canvas || !jsPDFCtor) throw new Error('html2canvas/jsPDF not loaded');

      wrap = document.createElement('div');
      wrap.innerHTML = buildHtml(data);
      // Inline-стили wrap'а используют !important чтобы перебить любые внешние правила
      wrap.setAttribute('style',
        'position:fixed !important;top:0 !important;left:0 !important;width:1123px !important;' +
        'background:#FFFFFF !important;pointer-events:none !important;z-index:1 !important;' +
        'margin:0 !important;padding:0 !important;border:0 !important;'
      );
      document.body.appendChild(wrap);

      const pages = wrap.querySelectorAll('.pdf-doc .pdf-page');
      if (!pages || pages.length < 2) throw new Error('Pages not found');

      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const pdf = new jsPDFCtor({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true });

      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i];
        const canvas = await html2canvas(pageEl, {
          scale: 3,
          useCORS: true,
          allowTaint: true,
          letterRendering: true,
          backgroundColor: '#FFFFFF',
          width: 1123,
          height: 794,
          windowWidth: 1123,
          windowHeight: 794,
          scrollX: 0,
          scrollY: 0,
          logging: false
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.96);
        if (i > 0) pdf.addPage('a4', 'landscape');
        pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210, undefined, 'SLOW');
      }

      pdf.save('Расчет-лизинга-' + todayStr() + '.pdf');
    } catch (e) {
      console.error('PDF generation failed:', e);
      alert('Не удалось сгенерировать PDF. Проверьте интернет и попробуйте снова. (' + (e.message || e) + ')');
    } finally {
      if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
  }

  window.generateLeasingPdf = generatePdf;
})();
