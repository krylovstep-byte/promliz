/* V51c: PDF-генератор графика лизинговых платежей.
   Использует html2pdf.js (HTML → canvas → PDF). Кириллица поддерживается.
   Lib подгружается lazy при первом клике на кнопку «Скачать график PDF».

   КЛЮЧЕВЫЕ ФИКСЫ vs V51:
   - Стили инжектятся в <head> (не внутри клонируемого элемента) — html2canvas
     гарантированно видит computed styles через CSSOM.
   - Настоящие <table>/<tr>/<td> для 3-колонного графика и 2-колонной страницы 2
     (не div+display:table — это ломается в html2canvas 1.x).
   - Padding на .page-inner, не на .page — html2pdf не сжимает корень страницы.
   - Без отрицательных margin (V51 имел margin-left:-15px для border-spacing fix —
     это уносило контент за левый край PDF).
   - Видимое позиционирование top:-20000 (не left:-99999, не z-index:-1).
*/
(function () {
  const HTML2PDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js';
  let loadPromise = null;

  function loadHtml2pdf() {
    if (window.html2pdf) return Promise.resolve(window.html2pdf);
    if (loadPromise) return loadPromise;
    loadPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = HTML2PDF_CDN;
      s.async = true;
      s.onload = () => resolve(window.html2pdf);
      s.onerror = () => { loadPromise = null; reject(new Error('html2pdf failed to load')); };
      document.head.appendChild(s);
    });
    return loadPromise;
  }

  const fmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
  const fmt2 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const MONTHS_RU = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  function paymentDates(n) {
    const dates = [];
    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth() + 1;
    if (m > 11) { m = 0; y += 1; }
    for (let i = 0; i < n; i++) {
      dates.push(MONTHS_RU[m] + ' ' + y);
      m += 1;
      if (m > 11) { m = 0; y += 1; }
    }
    return dates;
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
    for (let i = 0; i < n; i++) {
      rows.push({ num: i + 1, date: dates[i], val: monthly });
    }
    const perCol = Math.ceil(rows.length / 3);
    return [rows.slice(0, perCol), rows.slice(perCol, perCol * 2), rows.slice(perCol * 2)];
  }

  function renderRow(r) {
    if (r.isHeader) {
      return '<tr class="row-header"><td class="mes"></td><td class="lbl">' + r.label +
             '</td><td class="num">' + fmt.format(r.val) + ' ₽</td></tr>';
    }
    return '<tr><td class="mes">' + r.num + '</td><td>' + r.date +
           '</td><td class="num">' + fmt.format(r.val) + ' ₽</td></tr>';
  }

  function renderColTable(rows) {
    return '<table class="sched">' +
      '<thead><tr><th class="th-mes">Мес.</th><th>Дата платежа</th><th class="th-num">Платеж, в т.ч. НДС</th></tr></thead>' +
      '<tbody>' + rows.map(renderRow).join('') + '</tbody></table>';
  }

  // Inline SVG логотип Промлизинг — синий квадрат с белой "П" + оранжевая полоска
  const LOGO_SVG = '<svg width="44" height="44" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">' +
    '<rect width="64" height="64" rx="12" fill="#0094DE"/>' +
    '<path d="M16 16h32v8h-12v24h-8V24H16z" fill="#FFFFFF"/>' +
    '<rect x="16" y="48" width="32" height="3" rx="1.5" fill="#FF9545"/>' +
    '</svg>';

  // CSS — инжектится в <head> при первом рендере. Селекторы все под .pdf-doc,
  // чтобы не зацепить страницу. Размеры в px (1mm = 3.7795px при 96 dpi).
  // 297mm = 1123px, 210mm = 794px (A4 landscape).
  const PDF_CSS =
    '.pdf-doc{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#04384F;width:1123px;background:#FFFFFF;line-height:1.4;}' +
    '.pdf-doc *{box-sizing:border-box;}' +
    '.pdf-doc .page{width:1123px;min-height:794px;background:#FFFFFF;page-break-after:always;position:relative;}' +
    '.pdf-doc .page:last-child{page-break-after:auto;}' +
    '.pdf-doc .page-inner{width:1123px;padding:36px 48px 24px;}' +
    /* header */
    '.pdf-doc .header{width:100%;display:table;border-bottom:2px solid #0094DE;padding-bottom:10px;}' +
    '.pdf-doc .header-left{display:table-cell;vertical-align:top;width:60%;}' +
    '.pdf-doc .header-right{display:table-cell;vertical-align:top;text-align:right;font-size:11px;line-height:1.5;color:#04384F;}' +
    '.pdf-doc .header-right strong{color:#04384F;font-size:13px;font-weight:700;}' +
    '.pdf-doc .header-right em{font-style:italic;color:#5A6B7A;}' +
    '.pdf-doc .logo-row{display:table;width:auto;}' +
    '.pdf-doc .logo-svg{display:table-cell;vertical-align:middle;padding-right:10px;}' +
    '.pdf-doc .logo-text{display:table-cell;vertical-align:middle;}' +
    '.pdf-doc .brand-name{font-weight:800;font-size:22px;color:#0094DE;line-height:1;}' +
    '.pdf-doc .slogan{font-size:11px;color:#04384F;margin-top:3px;font-weight:600;}' +
    '.pdf-doc .contacts{font-size:10px;color:#0094DE;margin-top:6px;}' +
    '.pdf-doc .accent-bar{height:3px;width:100%;background:linear-gradient(90deg,#0094DE 0%,#0094DE 70%,#FF9545 70%,#FF9545 95%,transparent 95%);margin-top:-2px;}' +
    /* h1 + h2 */
    '.pdf-doc h1{font-size:22px;text-align:center;margin:18px 0 14px;font-weight:700;color:#04384F;}' +
    '.pdf-doc h2{font-size:15px;text-align:center;color:#04384F;text-transform:uppercase;letter-spacing:0.06em;margin:18px 0 10px;font-weight:700;}' +
    /* summary table */
    '.pdf-doc .summary{width:100%;border-collapse:collapse;}' +
    '.pdf-doc .summary th{background:#0094DE;color:#FFFFFF;padding:10px 8px;font-size:11px;font-weight:600;text-align:center;border:1px solid #0094DE;}' +
    '.pdf-doc .summary td{padding:14px 8px;text-align:center;font-weight:700;font-size:13px;background:#F5F9FC;border:1px solid #E0E6EB;color:#04384F;}' +
    '.pdf-doc .summary td.client{font-weight:600;}' +
    '.pdf-doc .summary td.tax-benefit{color:#2A8556;font-weight:700;}' +
    /* note */
    '.pdf-doc .note-line{font-size:10px;font-style:italic;margin:8px 0 0;color:#5A6B7A;}' +
    /* schedule grid via real <table> */
    '.pdf-doc .sched-grid{width:100%;border-collapse:separate;border-spacing:12px 0;margin-top:6px;}' +
    '.pdf-doc .sched-cell{vertical-align:top;width:33.33%;padding:0;}' +
    '.pdf-doc .sched{width:100%;border-collapse:collapse;font-size:10px;}' +
    '.pdf-doc .sched th{background:#F5F9FC;color:#04384F;font-weight:600;padding:5px 4px;font-size:9.5px;border-bottom:1px solid #C0CCD7;text-align:center;}' +
    '.pdf-doc .sched th.th-mes{width:30px;}' +
    '.pdf-doc .sched th.th-num{width:90px;text-align:right;padding-right:8px;}' +
    '.pdf-doc .sched td{padding:4px 6px;border-bottom:1px solid #F0F3F5;color:#04384F;font-size:10px;}' +
    '.pdf-doc .sched td.mes{text-align:center;color:#5A6B7A;width:30px;}' +
    '.pdf-doc .sched td.num{text-align:right;font-weight:600;white-space:nowrap;width:90px;}' +
    '.pdf-doc .sched td.lbl{font-weight:700;color:#0094DE;}' +
    '.pdf-doc .sched .row-header td{background:#F5F9FC;color:#0094DE;font-weight:700;}' +
    '.pdf-doc .sched .row-header td.num{color:#0094DE;}' +
    /* footer */
    '.pdf-doc .footer{margin-top:20px;padding-top:10px;border-top:1px solid #E0E6EB;text-align:center;font-size:10px;color:#0094DE;font-weight:600;}' +
    /* page 2: two columns via real table */
    '.pdf-doc .twocols-grid{width:100%;border-collapse:separate;border-spacing:24px 0;margin-top:12px;}' +
    '.pdf-doc .twocols-cell{vertical-align:top;width:50%;padding:0;}' +
    '.pdf-doc .panel-title{font-size:12px;font-weight:700;margin-bottom:10px;color:#04384F;}' +
    '.pdf-doc .params,.pdf-doc .tax-eff{border-collapse:collapse;width:100%;font-size:11px;}' +
    '.pdf-doc .params th{background:#E8F1F8;padding:8px;font-weight:700;text-align:center;color:#04384F;border:1px solid #C0CCD7;}' +
    '.pdf-doc .params td{padding:8px 10px;border:1px solid #E0E6EB;color:#04384F;vertical-align:middle;}' +
    '.pdf-doc .params td:first-child{font-weight:500;width:45%;}' +
    '.pdf-doc .params td:last-child{font-weight:600;}' +
    '.pdf-doc .params tr.highlight td{background:#0094DE;color:#FFFFFF;font-weight:700;border-color:#0094DE;}' +
    '.pdf-doc .tax-eff th{background:#0094DE;color:#FFFFFF;padding:10px;font-size:11px;font-weight:500;line-height:1.4;border:1px solid #0094DE;}' +
    '.pdf-doc .tax-eff td{padding:10px;border:1px solid #E0E6EB;vertical-align:middle;}' +
    '.pdf-doc .tax-eff td.label{width:55%;color:#04384F;font-size:11px;line-height:1.35;}' +
    '.pdf-doc .tax-eff td.label small{color:#5A6B7A;font-size:9.5px;display:block;margin-top:2px;}' +
    '.pdf-doc .tax-eff td.value{text-align:right;font-size:14px;font-weight:700;color:#0094DE;white-space:nowrap;}' +
    '.pdf-doc .tax-eff tr.total td{background:#E8F4EE;}' +
    '.pdf-doc .tax-eff tr.total td.value{color:#2A8556;font-size:15px;}' +
    '.pdf-doc .footnote{font-size:9.5px;font-style:italic;color:#5A6B7A;margin-top:10px;line-height:1.4;}';

  function injectStyles() {
    if (document.getElementById('pdf-doc-styles')) return;
    const s = document.createElement('style');
    s.id = 'pdf-doc-styles';
    s.textContent = PDF_CSS;
    document.head.appendChild(s);
  }

  function buildHeader(date, rightHtml, withSlogan) {
    return (
      '<div class="header">' +
        '<div class="header-left">' +
          '<div class="logo-row">' +
            '<div class="logo-svg">' + LOGO_SVG + '</div>' +
            '<div class="logo-text">' +
              '<div class="brand-name">Промлизинг</div>' +
              (withSlogan ? '<div class="slogan">Работаем с 2001 года!</div>' : '') +
            '</div>' +
          '</div>' +
          (withSlogan ? '<div class="contacts">promliz.com | promlizing@inbox.ru | т/ф (4852) 77-01-87, 58-50-60</div>' : '') +
        '</div>' +
        '<div class="header-right">' + rightHtml + '</div>' +
      '</div>' +
      '<div class="accent-bar"></div>'
    );
  }

  function buildPage1(d, date, cols) {
    return (
      '<div class="page">' +
        '<div class="page-inner">' +
          buildHeader(date,
            '<strong>Приложение №2</strong><br>' +
            '<em>Конфиденциально</em><br>' +
            'ООО "МБ-Лизинг"<br>' +
            'Дата: ' + date,
            true) +

          '<h1>Предварительный расчет по договору лизинга</h1>' +

          '<table class="summary">' +
            '<thead><tr>' +
              '<th>Клиент</th>' +
              '<th>Стоимость имущества</th>' +
              '<th>Первый взнос</th>' +
              '<th>Срок лизинга</th>' +
              '<th>Потенциальная налоговая выгода</th>' +
            '</tr></thead>' +
            '<tbody><tr>' +
              '<td class="client">ООО______</td>' +
              '<td>' + fmt.format(d.price) + ' ₽</td>' +
              '<td>' + fmt.format(d.advance) + ' ₽</td>' +
              '<td>' + d.n + ' мес.</td>' +
              '<td class="tax-benefit">' + fmt.format(d.taxSaving) + ' ₽</td>' +
            '</tr></tbody>' +
          '</table>' +
          '<p class="note-line">Для расчета условно принято: 360 дней в году, 30 дней в месяце.</p>' +

          '<h2>График лизинговых платежей</h2>' +
          '<table class="sched-grid"><tr>' +
            '<td class="sched-cell">' + renderColTable(cols[0]) + '</td>' +
            '<td class="sched-cell">' + renderColTable(cols[1]) + '</td>' +
            '<td class="sched-cell">' + renderColTable(cols[2]) + '</td>' +
          '</tr></table>' +

          '<div class="footer">т/ф (4852) 77-01-87, 58-50-60 | г. Ярославль, ул. Победы, д. 38/27, оф. 512 | promliz.com | promlizing@inbox.ru</div>' +
        '</div>' +
      '</div>'
    );
  }

  function buildPage2(d, date) {
    return (
      '<div class="page">' +
        '<div class="page-inner">' +
          buildHeader(date,
            '<strong>Условия лизинга - продолжение</strong><br>' +
            'Дата: ' + date + ' | Конфиденциально',
            false) +

          '<h1 style="text-align:left;margin-top:20px;font-size:19px;">Итоговые условия и налоговый эффект</h1>' +

          '<table class="twocols-grid"><tr>' +
            '<td class="twocols-cell">' +
              '<div class="panel-title">Итоговые условия</div>' +
              '<table class="params">' +
                '<thead><tr><th colspan="2">Параметры договора</th></tr></thead>' +
                '<tbody>' +
                  '<tr><td>Стоимость предмета лизинга</td><td>' + fmt2.format(d.price) + ' ₽</td></tr>' +
                  '<tr><td>Авансовый платеж</td><td>' + d.advancePct + '% (' + fmt2.format(d.advance) + ' ₽)</td></tr>' +
                  '<tr><td>Срок договора лизинга</td><td>' + d.n + ' мес.</td></tr>' +
                  '<tr><td>Страхование имущества</td><td>Не включено в расчет. Страховые компании: АО СОГАЗ, СК СОГЛАСИЕ</td></tr>' +
                  '<tr class="highlight"><td>Сумма договора</td><td>' + fmt2.format(d.total) + ' ₽</td></tr>' +
                  '<tr><td>Выкупная стоимость</td><td>5 000 ₽</td></tr>' +
                  '<tr><td>Постановка на учет</td><td>Клиент</td></tr>' +
                  '<tr><td>Годовое удорожание</td><td>' + d.annualMarkup + '%</td></tr>' +
                '</tbody>' +
              '</table>' +
            '</td>' +
            '<td class="twocols-cell">' +
              '<div class="panel-title">Налоговый эффект</div>' +
              '<table class="tax-eff">' +
                '<thead><tr><th>Приобретайте автотранспорт, спецтехнику и оборудование в лизинг и получайте экономию на налогах в течение срока договора.</th></tr></thead>' +
                '<tbody>' +
                  '<tr><td class="label">Возврат НДС 22%<small>со всей суммы договора лизинга</small></td><td class="value">' + fmt2.format(d.vatReturn) + ' ₽</td></tr>' +
                  '<tr><td class="label">Экономия по налогу на прибыль<small>лизинговые платежи уменьшают налоговую базу</small></td><td class="value">' + fmt2.format(d.profitSaving) + ' ₽</td></tr>' +
                  '<tr class="total"><td class="label">Потенциальный совокупный налоговый эффект</td><td class="value">' + fmt2.format(d.taxSaving) + ' ₽</td></tr>' +
                '</tbody>' +
              '</table>' +
              '<p class="footnote">Примечание: расчет предварительный. Финальные условия зависят от предмета лизинга, параметров клиента, страхования и условий поставщика.</p>' +
            '</td>' +
          '</tr></table>' +

          '<div class="footer">т/ф (4852) 77-01-87, 58-50-60 | г. Ярославль, ул. Победы, д. 38/27, оф. 512 | promliz.com | promlizing@inbox.ru</div>' +
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
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,0.95);' +
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
      const html2pdf = await loadHtml2pdf();

      wrap = document.createElement('div');
      wrap.innerHTML = buildHtml(data);
      // Видимое позиционирование за viewport вертикально. БЕЗ left:-99999 и БЕЗ z-index:-1
      // (то и другое ломает html2canvas — выдаёт пустой canvas).
      wrap.style.cssText = 'position:absolute;top:-20000px;left:0;width:1123px;background:#FFFFFF;pointer-events:none;';
      document.body.appendChild(wrap);

      const pdfRoot = wrap.querySelector('.pdf-doc');
      if (!pdfRoot) throw new Error('PDF root not found');

      // 2 RAF чтобы CSS из <head> применился к свежедобавленному элементу
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const fileName = 'Расчет-лизинга-' + todayStr() + '.pdf';
      await html2pdf().from(pdfRoot).set({
        margin: 0,
        filename: fileName,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          letterRendering: true,
          backgroundColor: '#FFFFFF',
          windowWidth: 1123,
          width: 1123,
          scrollX: 0,
          scrollY: 0,
          logging: false
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape', compress: true },
        pagebreak: { mode: ['css', 'legacy'] }
      }).save();
    } catch (e) {
      console.error('PDF generation failed:', e);
      alert('Не удалось сгенерировать PDF. Проверьте интернет и попробуйте снова.');
    } finally {
      if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
  }

  window.generateLeasingPdf = generatePdf;
})();
