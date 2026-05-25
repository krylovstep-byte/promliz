/* V51d: PDF-генератор графика лизинговых платежей. html2pdf.js (lazy CDN).
   2 страницы A4 landscape по шаблону Промлизинг / ООО «МБ-Лизинг».

   КЛЮЧЕВЫЕ ПРИНЦИПЫ (после серии неудачных попыток):
   1. Стили в <head> через injectStyles() — html2canvas видит computed через CSSOM.
   2. ВСЕ multi-column layouts через настоящие <table>/<tr>/<td> с table-layout:fixed
      и фиксированными px-ширинами (не % и не display:table). table-cell + % ломается.
   3. <colgroup><col width=...> для явного контроля ширины колонок.
   4. .page { height: 794px; overflow: hidden } — фиксированно 794px (A4 landscape).
   5. Каждая .page-N имеет свой класс, pagebreak.before: '.page-2' даёт явный разрыв.
   6. Padding на .page-inner, не на .page (html2pdf не сжимает корень страницы).
   7. Никаких отрицательных margin, никакого z-index:-1, никакого left:-99999.
      Элемент видимо за viewport (top:-20000) + overlay-спиннер для UX.
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
      return '<tr class="rh"><td class="m"></td><td class="lbl">' + r.label +
             '</td><td class="n">' + fmt.format(r.val) + ' ₽</td></tr>';
    }
    return '<tr><td class="m">' + r.num + '</td><td>' + r.date +
           '</td><td class="n">' + fmt.format(r.val) + ' ₽</td></tr>';
  }

  function renderSchedTable(rows) {
    return '<table class="sched">' +
      '<colgroup><col style="width:32px"><col><col style="width:90px"></colgroup>' +
      '<thead><tr><th class="m">Мес.</th><th>Дата платежа</th><th class="n">Платеж, в т.ч. НДС</th></tr></thead>' +
      '<tbody>' + rows.map(renderSchedRow).join('') + '</tbody></table>';
  }

  const LOGO_SVG = '<svg width="44" height="44" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">' +
    '<rect width="64" height="64" rx="12" fill="#0094DE"/>' +
    '<path d="M16 16h32v8h-12v24h-8V24H16z" fill="#FFFFFF"/>' +
    '<rect x="16" y="48" width="32" height="3" rx="1.5" fill="#FF9545"/>' +
    '</svg>';

  // A4 landscape = 297×210mm = 1123×794px (96 dpi). Padding-inner 30/44/20.
  // Доступная ширина: 1123 - 88 = 1035px.
  const PDF_CSS =
    '.pdf-doc{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#04384F;width:1123px;background:#FFFFFF;line-height:1.4;}' +
    '.pdf-doc *{box-sizing:border-box;margin:0;padding:0;}' +
    '.pdf-doc .page{width:1123px;height:794px;background:#FFFFFF;overflow:hidden;position:relative;}' +
    '.pdf-doc .page-2{page-break-before:always;break-before:page;}' +
    '.pdf-doc .page-inner{width:1123px;height:794px;padding:30px 44px 18px;}' +
    /* Header */
    '.pdf-doc table.header{width:1035px;table-layout:fixed;border-collapse:collapse;border-bottom:2px solid #0094DE;}' +
    '.pdf-doc table.header td{vertical-align:top;padding:0 0 8px 0;}' +
    '.pdf-doc table.header td.h-l{width:680px;}' +
    '.pdf-doc table.header td.h-r{width:355px;text-align:right;font-size:11px;line-height:1.5;color:#04384F;}' +
    '.pdf-doc table.header td.h-r strong{color:#04384F;font-size:13px;font-weight:700;display:block;}' +
    '.pdf-doc table.header td.h-r em{font-style:italic;color:#5A6B7A;display:block;}' +
    /* Logo */
    '.pdf-doc table.logo-row{border-collapse:collapse;}' +
    '.pdf-doc table.logo-row td{vertical-align:middle;padding:0;}' +
    '.pdf-doc table.logo-row td.l-svg{padding-right:10px;width:54px;}' +
    '.pdf-doc .brand-name{font-weight:800;font-size:22px;color:#0094DE;line-height:1;}' +
    '.pdf-doc .slogan{font-size:11px;color:#04384F;margin-top:3px;font-weight:600;}' +
    '.pdf-doc .contacts{font-size:10px;color:#0094DE;margin-top:6px;}' +
    '.pdf-doc .accent-bar{height:3px;width:1035px;background:linear-gradient(90deg,#0094DE 0%,#0094DE 70%,#FF9545 70%,#FF9545 95%,transparent 95%);}' +
    /* Titles */
    '.pdf-doc h1{font-size:22px;text-align:center;margin:14px 0 12px;font-weight:700;color:#04384F;}' +
    '.pdf-doc h1.h1-left{text-align:left;margin-top:18px;font-size:19px;}' +
    '.pdf-doc h2{font-size:15px;text-align:center;color:#04384F;text-transform:uppercase;letter-spacing:0.06em;margin:16px 0 8px;font-weight:700;}' +
    /* Summary 5-col */
    '.pdf-doc table.summary{width:1035px;table-layout:fixed;border-collapse:collapse;}' +
    '.pdf-doc table.summary th{background:#0094DE;color:#FFFFFF;padding:10px 6px;font-size:11px;font-weight:600;text-align:center;border:1px solid #0094DE;line-height:1.3;}' +
    '.pdf-doc table.summary td{padding:14px 6px;text-align:center;font-weight:700;font-size:13px;background:#F5F9FC;border:1px solid #E0E6EB;color:#04384F;}' +
    '.pdf-doc table.summary td.client{font-weight:600;}' +
    '.pdf-doc table.summary td.tax-benefit{color:#2A8556;font-weight:700;}' +
    /* Note */
    '.pdf-doc .note-line{font-size:10px;font-style:italic;margin-top:6px;color:#5A6B7A;}' +
    /* Schedule 3-col grid (real table) */
    '.pdf-doc table.sched-grid{width:1035px;table-layout:fixed;border-collapse:collapse;margin-top:4px;}' +
    '.pdf-doc table.sched-grid td{vertical-align:top;width:345px;padding:0;}' +
    '.pdf-doc table.sched-grid td.gap{width:0;}' +
    '.pdf-doc table.sched-grid td.col-mid{padding-left:12px;padding-right:12px;}' +
    '.pdf-doc table.sched{width:100%;table-layout:fixed;border-collapse:collapse;font-size:10px;}' +
    '.pdf-doc table.sched th{background:#F5F9FC;color:#04384F;font-weight:600;padding:5px 4px;font-size:9.5px;border-bottom:1px solid #C0CCD7;text-align:center;}' +
    '.pdf-doc table.sched th.n{text-align:right;padding-right:8px;}' +
    '.pdf-doc table.sched td{padding:4px 6px;border-bottom:1px solid #F0F3F5;color:#04384F;font-size:10px;}' +
    '.pdf-doc table.sched td.m{text-align:center;color:#5A6B7A;}' +
    '.pdf-doc table.sched td.n{text-align:right;font-weight:600;white-space:nowrap;}' +
    '.pdf-doc table.sched td.lbl{font-weight:700;color:#0094DE;}' +
    '.pdf-doc table.sched .rh td{background:#F5F9FC;color:#0094DE;font-weight:700;}' +
    '.pdf-doc table.sched .rh td.n{color:#0094DE;}' +
    /* Footer */
    '.pdf-doc .footer{margin-top:14px;padding-top:8px;border-top:1px solid #E0E6EB;text-align:center;font-size:10px;color:#0094DE;font-weight:600;width:1035px;}' +
    /* Page 2 two columns */
    '.pdf-doc table.twocols-grid{width:1035px;table-layout:fixed;border-collapse:collapse;margin-top:10px;}' +
    '.pdf-doc table.twocols-grid td{vertical-align:top;width:505px;padding:0;}' +
    '.pdf-doc table.twocols-grid td.col-right{padding-left:25px;}' +
    '.pdf-doc .panel-title{font-size:12px;font-weight:700;margin-bottom:8px;color:#04384F;}' +
    /* Params */
    '.pdf-doc table.params{width:505px;table-layout:fixed;border-collapse:collapse;font-size:11px;}' +
    '.pdf-doc table.params col.c1{width:230px;}' +
    '.pdf-doc table.params col.c2{width:275px;}' +
    '.pdf-doc table.params th{background:#E8F1F8;padding:8px;font-weight:700;text-align:center;color:#04384F;border:1px solid #C0CCD7;}' +
    '.pdf-doc table.params td{padding:8px 10px;border:1px solid #E0E6EB;color:#04384F;vertical-align:middle;}' +
    '.pdf-doc table.params td:first-child{font-weight:500;}' +
    '.pdf-doc table.params td:last-child{font-weight:600;}' +
    '.pdf-doc table.params tr.highlight td{background:#0094DE;color:#FFFFFF;font-weight:700;border-color:#0094DE;}' +
    /* Tax effect */
    '.pdf-doc table.tax-eff{width:480px;table-layout:fixed;border-collapse:collapse;font-size:11px;}' +
    '.pdf-doc table.tax-eff col.c1{width:280px;}' +
    '.pdf-doc table.tax-eff col.c2{width:200px;}' +
    '.pdf-doc table.tax-eff th{background:#0094DE;color:#FFFFFF;padding:10px;font-size:11px;font-weight:500;line-height:1.4;border:1px solid #0094DE;}' +
    '.pdf-doc table.tax-eff td{padding:10px;border:1px solid #E0E6EB;vertical-align:middle;}' +
    '.pdf-doc table.tax-eff td.lbl{color:#04384F;font-size:11px;line-height:1.35;}' +
    '.pdf-doc table.tax-eff td.lbl small{color:#5A6B7A;font-size:9.5px;display:block;margin-top:2px;}' +
    '.pdf-doc table.tax-eff td.val{text-align:right;font-size:14px;font-weight:700;color:#0094DE;white-space:nowrap;}' +
    '.pdf-doc table.tax-eff tr.total td{background:#E8F4EE;}' +
    '.pdf-doc table.tax-eff tr.total td.val{color:#2A8556;font-size:15px;}' +
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
      '<table class="header"><tr>' +
        '<td class="h-l">' +
          '<table class="logo-row"><tr>' +
            '<td class="l-svg">' + LOGO_SVG + '</td>' +
            '<td>' +
              '<div class="brand-name">Промлизинг</div>' +
              (withSlogan ? '<div class="slogan">Работаем с 2001 года!</div>' : '') +
            '</td>' +
          '</tr></table>' +
          (withSlogan ? '<div class="contacts">promliz.com | promlizing@inbox.ru | т/ф (4852) 77-01-87, 58-50-60</div>' : '') +
        '</td>' +
        '<td class="h-r">' + rightHtml + '</td>' +
      '</tr></table>' +
      '<div class="accent-bar"></div>'
    );
  }

  function buildPage1(d, date, cols) {
    return (
      '<div class="page page-1">' +
        '<div class="page-inner">' +
          buildHeader(date,
            '<strong>Приложение №2</strong>' +
            '<em>Конфиденциально</em>' +
            'ООО "МБ-Лизинг"<br>' +
            'Дата: ' + date,
            true) +

          '<h1>Предварительный расчет по договору лизинга</h1>' +

          '<table class="summary">' +
            '<colgroup>' +
              '<col style="width:160px">' +
              '<col style="width:215px">' +
              '<col style="width:180px">' +
              '<col style="width:170px">' +
              '<col style="width:310px">' +
            '</colgroup>' +
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
            '<td>' + renderSchedTable(cols[0]) + '</td>' +
            '<td class="col-mid">' + renderSchedTable(cols[1]) + '</td>' +
            '<td>' + renderSchedTable(cols[2]) + '</td>' +
          '</tr></table>' +

          '<div class="footer">т/ф (4852) 77-01-87, 58-50-60 | г. Ярославль, ул. Победы, д. 38/27, оф. 512 | promliz.com | promlizing@inbox.ru</div>' +
        '</div>' +
      '</div>'
    );
  }

  function buildPage2(d, date) {
    return (
      '<div class="page page-2">' +
        '<div class="page-inner">' +
          buildHeader(date,
            '<strong>Условия лизинга - продолжение</strong>' +
            'Дата: ' + date + ' | Конфиденциально',
            false) +

          '<h1 class="h1-left">Итоговые условия и налоговый эффект</h1>' +

          '<table class="twocols-grid"><tr>' +
            '<td>' +
              '<div class="panel-title">Итоговые условия</div>' +
              '<table class="params">' +
                '<colgroup><col class="c1"><col class="c2"></colgroup>' +
                '<thead><tr><th colspan="2">Параметры договора</th></tr></thead>' +
                '<tbody>' +
                  '<tr><td>Стоимость предмета лизинга</td><td>' + fmt2.format(d.price) + ' ₽</td></tr>' +
                  '<tr><td>Авансовый платеж</td><td>' + d.advancePct + '% (' + fmt2.format(d.advance) + ' ₽)</td></tr>' +
                  '<tr><td>Срок договора лизинга</td><td>' + d.n + ' мес.</td></tr>' +
                  '<tr><td>Страхование имущества</td><td>Не включено в расчет. АО СОГАЗ, СК СОГЛАСИЕ</td></tr>' +
                  '<tr class="highlight"><td>Сумма договора</td><td>' + fmt2.format(d.total) + ' ₽</td></tr>' +
                  '<tr><td>Выкупная стоимость</td><td>5 000 ₽</td></tr>' +
                  '<tr><td>Постановка на учет</td><td>Клиент</td></tr>' +
                  '<tr><td>Годовое удорожание</td><td>' + d.annualMarkup + '%</td></tr>' +
                '</tbody>' +
              '</table>' +
            '</td>' +
            '<td class="col-right">' +
              '<div class="panel-title">Налоговый эффект</div>' +
              '<table class="tax-eff">' +
                '<colgroup><col class="c1"><col class="c2"></colgroup>' +
                '<thead><tr><th colspan="2">Приобретайте автотранспорт, спецтехнику и оборудование в лизинг и получайте экономию на налогах в течение срока договора.</th></tr></thead>' +
                '<tbody>' +
                  '<tr><td class="lbl">Возврат НДС 22%<small>со всей суммы договора лизинга</small></td><td class="val">' + fmt2.format(d.vatReturn) + ' ₽</td></tr>' +
                  '<tr><td class="lbl">Экономия по налогу на прибыль<small>лизинговые платежи уменьшают налоговую базу</small></td><td class="val">' + fmt2.format(d.profitSaving) + ' ₽</td></tr>' +
                  '<tr class="total"><td class="lbl">Потенциальный совокупный налоговый эффект</td><td class="val">' + fmt2.format(d.taxSaving) + ' ₽</td></tr>' +
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
      await loadHtml2pdf(); // подгружает в window: html2pdf, html2canvas, jspdf

      const html2canvas = window.html2canvas;
      const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
      if (!html2canvas || !jsPDFCtor) throw new Error('html2canvas/jsPDF not loaded');

      // Создаём wrap с обеими страницами видимыми (position:fixed top:0 left:0,
      // под overlay чтобы юзер не видел). Каждая .page имеет фиксированные 1123×794.
      wrap = document.createElement('div');
      wrap.innerHTML = buildHtml(data);
      wrap.style.cssText = 'position:fixed;top:0;left:0;width:1123px;background:#FFFFFF;pointer-events:none;z-index:1;';
      document.body.appendChild(wrap);

      const pages = wrap.querySelectorAll('.pdf-doc .page');
      if (!pages || pages.length < 2) throw new Error('Pages not found');

      // Ждём 2 RAF для применения стилей
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      // Создаём jsPDF с A4 landscape (297×210mm)
      const pdf = new jsPDFCtor({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true });

      // Рендерим каждую страницу ОТДЕЛЬНО через html2canvas → addImage
      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i];
        const canvas = await html2canvas(pageEl, {
          scale: 2,
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
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        if (i > 0) pdf.addPage('a4', 'landscape');
        // addImage(data, format, x, y, width, height) — 297×210mm A4 landscape
        pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
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
