/* V52: PDF-генератор графика лизинговых платежей.
   Шаблон 1:1 с «Шаблон 3 версия pdf.pdf» (ООО «МБ-Лизинг» / Промлизинг).

   КЛЮЧЕВЫЕ ПРИНЦИПЫ:
   1. Стили инжектятся в <head> через injectStyles() — html2canvas видит computed.
   2. Все multi-column layouts через настоящие <table>/<tr>/<td> с table-layout:fixed
      и фиксированными px-ширинами в <colgroup><col width=...>.
   3. .page {width:1123px; height:794px; overflow:hidden} — A4 landscape (96 dpi).
   4. Каждая страница рендерится отдельно html2canvas → jsPDF.addImage.
   5. scale=3 → ~290 DPI на A4. Резкое качество (файл ~600-800KB).
   6. Никаких отрицательных margin / left:-99999 / z-index:-1. Элемент видимо
      под overlay-спиннером.

   ЦВЕТА (точно из шаблона):
   - Brand blue: #0094DE
   - Dark blue text: #04384F
   - Light blue tint cell: #DCEEF8
   - Cyan badge bg (page 1 header right): #0094DE
   - Orange accent bar: #FF9545
   - Green tax savings: #2A8556
   - Light green panel: #E8F4EE
   - Light gray border: #C0CCD7
   - Soft border: #E0E6EB
*/
(function () {
  // html2pdf.bundle не экспортирует html2canvas/jsPDF в window — грузим отдельно
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
      return '<tr class="rh"><td class="m"></td><td class="lbl">' + r.label +
             '</td><td class="n">' + fmt.format(r.val) + ' ₽</td></tr>';
    }
    return '<tr><td class="m">' + r.num + '</td><td>' + r.date +
           '</td><td class="n">' + fmt.format(r.val) + ' ₽</td></tr>';
  }

  function renderSchedTable(rows) {
    return '<table class="sched">' +
      '<colgroup><col style="width:36px"><col><col style="width:96px"></colgroup>' +
      '<thead><tr><th class="m">Мес.</th><th>Дата платежа</th><th class="n">Платеж, в т.ч.<br>НДС</th></tr></thead>' +
      '<tbody>' + rows.map(renderSchedRow).join('') + '</tbody></table>';
  }

  // SVG лого — две арки в стиле «Промлизинг» (близко к оригиналу)
  const LOGO_SVG = '<svg width="62" height="40" viewBox="0 0 82 54" xmlns="http://www.w3.org/2000/svg">' +
    '<g stroke="#0094DE" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M5 50 Q5 6 25 6 Q41 6 41 22"/>' +
      '<path d="M41 22 Q41 6 57 6 Q77 6 77 50"/>' +
      '<line x1="5" y1="50" x2="77" y2="50"/>' +
    '</g>' +
    '</svg>';

  // A4 landscape = 297×210mm = 1123×794px (96 dpi). Padding 28px × бока.
  const PDF_CSS =
    '.pdf-doc{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#04384F;width:1123px;background:#FFFFFF;line-height:1.4;}' +
    '.pdf-doc *{box-sizing:border-box;margin:0;padding:0;}' +
    '.pdf-doc .page{width:1123px;height:794px;background:#FFFFFF;overflow:hidden;position:relative;}' +
    '.pdf-doc .page-inner{width:1123px;height:794px;padding:24px 28px 18px;}' +
    /* === HEADER === */
    '.pdf-doc table.header{width:1067px;table-layout:fixed;border-collapse:collapse;}' +
    '.pdf-doc table.header td{vertical-align:top;padding:0;}' +
    '.pdf-doc table.header td.h-l{width:707px;padding-bottom:8px;}' +
    '.pdf-doc table.header td.h-r{width:360px;padding-bottom:8px;text-align:left;}' +
    /* Logo row */
    '.pdf-doc table.logo-row{border-collapse:collapse;}' +
    '.pdf-doc table.logo-row td{vertical-align:middle;padding:0;}' +
    '.pdf-doc table.logo-row td.l-svg{padding-right:10px;width:72px;}' +
    '.pdf-doc .brand-name{font-weight:800;font-size:28px;color:#0094DE;line-height:1;letter-spacing:-0.01em;}' +
    '.pdf-doc .slogan{font-size:11px;color:#04384F;margin-top:6px;font-weight:700;}' +
    '.pdf-doc .contacts{font-size:10px;color:#0094DE;margin-top:4px;text-decoration:underline;letter-spacing:0.01em;}' +
    /* Right cyan badge */
    '.pdf-doc .hr-badge{background:#0094DE;color:#FFFFFF;padding:10px 14px 12px;text-align:right;font-size:11px;line-height:1.5;border-radius:0;}' +
    '.pdf-doc .hr-badge strong{display:block;font-size:13px;font-weight:700;}' +
    '.pdf-doc .hr-badge em{display:block;font-style:italic;font-weight:400;color:#FFFFFF;}' +
    /* Accent bar under header */
    '.pdf-doc .accent-bar{height:3px;width:1067px;background:linear-gradient(90deg,#0094DE 0%,#0094DE 66%,#FF9545 66%,#FF9545 78%,transparent 78%);margin-top:0;}' +
    /* === TITLES === */
    '.pdf-doc h1{font-size:24px;text-align:center;margin:18px 0 12px;font-weight:700;color:#04384F;}' +
    '.pdf-doc h1.h1-left{text-align:left;margin:14px 0 12px;font-size:22px;color:#04384F;}' +
    '.pdf-doc h2{font-size:16px;text-align:center;color:#04384F;text-transform:uppercase;letter-spacing:0.08em;margin:14px 0 8px;font-weight:700;}' +
    /* === SUMMARY 5-col table (page 1) === */
    '.pdf-doc table.summary{width:1067px;table-layout:fixed;border-collapse:collapse;}' +
    '.pdf-doc table.summary th{background:#0094DE;color:#FFFFFF;padding:11px 8px;font-size:12px;font-weight:600;text-align:center;border:1px solid #0094DE;line-height:1.35;}' +
    '.pdf-doc table.summary td{padding:14px 8px;text-align:center;font-weight:700;font-size:14px;background:#FFFFFF;border:1px solid #C0CCD7;color:#04384F;}' +
    '.pdf-doc table.summary td.client{font-weight:700;letter-spacing:0.04em;}' +
    '.pdf-doc table.summary td.tax-benefit{color:#2A8556;font-weight:700;font-size:14px;}' +
    /* Note */
    '.pdf-doc .note-line{font-size:10px;font-style:italic;margin-top:6px;color:#5A6B7A;}' +
    /* === SCHEDULE 3-col grid === */
    '.pdf-doc table.sched-grid{width:1067px;table-layout:fixed;border-collapse:separate;border-spacing:14px 0;margin-top:2px;margin-left:-7px;}' +
    '.pdf-doc table.sched-grid td{vertical-align:top;width:345px;padding:0;}' +
    '.pdf-doc table.sched{width:100%;table-layout:fixed;border-collapse:collapse;font-size:10px;}' +
    '.pdf-doc table.sched th{background:#0094DE;color:#FFFFFF;font-weight:600;padding:5px 4px;font-size:9.5px;border:1px solid #0094DE;text-align:center;line-height:1.2;}' +
    '.pdf-doc table.sched th.n{text-align:center;}' +
    '.pdf-doc table.sched td{padding:5px 6px;border:1px solid #E0E6EB;color:#04384F;font-size:10px;background:#FFFFFF;}' +
    '.pdf-doc table.sched td.m{text-align:center;color:#5A6B7A;}' +
    '.pdf-doc table.sched td.n{text-align:right;font-weight:600;white-space:nowrap;}' +
    '.pdf-doc table.sched td.lbl{font-weight:700;color:#0094DE;text-align:center;}' +
    '.pdf-doc table.sched .rh td{background:#FFFFFF;color:#0094DE;font-weight:700;}' +
    '.pdf-doc table.sched .rh td.n{color:#0094DE;font-weight:700;}' +
    '.pdf-doc table.sched .rh td.m{color:#0094DE;}' +
    /* Footer */
    '.pdf-doc .footer{margin-top:12px;text-align:center;font-size:11px;color:#0094DE;font-weight:700;width:1067px;letter-spacing:0.01em;}' +
    '.pdf-doc .footer .u{text-decoration:underline;}' +
    /* === PAGE 2: TWO COLUMNS === */
    '.pdf-doc table.twocols-grid{width:1067px;table-layout:fixed;border-collapse:collapse;margin-top:10px;}' +
    '.pdf-doc table.twocols-grid td{vertical-align:top;padding:0;}' +
    '.pdf-doc table.twocols-grid td.col-left{width:520px;padding-right:14px;}' +
    '.pdf-doc table.twocols-grid td.col-right{width:533px;padding-left:14px;}' +
    '.pdf-doc .panel-title{font-size:13px;font-weight:700;margin-bottom:10px;color:#0094DE;}' +
    /* Params left table */
    '.pdf-doc table.params{width:506px;table-layout:fixed;border-collapse:collapse;font-size:11px;}' +
    '.pdf-doc table.params col.c1{width:240px;}' +
    '.pdf-doc table.params col.c2{width:266px;}' +
    '.pdf-doc table.params th{background:#0094DE;padding:9px;font-weight:600;text-align:center;color:#FFFFFF;border:1px solid #0094DE;font-size:12px;}' +
    '.pdf-doc table.params td{padding:9px 12px;border:1px solid #C0CCD7;color:#04384F;vertical-align:middle;background:#FFFFFF;line-height:1.3;}' +
    '.pdf-doc table.params td:first-child{font-weight:500;}' +
    '.pdf-doc table.params td:last-child{font-weight:600;}' +
    '.pdf-doc table.params tr.highlight td{background:#0094DE;color:#FFFFFF;font-weight:700;border-color:#0094DE;}' +
    /* Tax effect right */
    '.pdf-doc table.tax-eff{width:519px;table-layout:fixed;border-collapse:collapse;font-size:11px;}' +
    '.pdf-doc table.tax-eff col.c1{width:300px;}' +
    '.pdf-doc table.tax-eff col.c2{width:219px;}' +
    '.pdf-doc table.tax-eff th{background:#0094DE;color:#FFFFFF;padding:11px 14px;font-size:11.5px;font-weight:600;line-height:1.45;border:1px solid #0094DE;text-align:center;}' +
    '.pdf-doc table.tax-eff td{padding:11px 12px;border:1px solid #C0CCD7;vertical-align:middle;background:#FFFFFF;}' +
    '.pdf-doc table.tax-eff td.lbl{color:#04384F;font-size:11px;line-height:1.4;font-weight:500;}' +
    '.pdf-doc table.tax-eff td.lbl small{color:#5A6B7A;font-size:9.5px;display:block;margin-top:3px;font-weight:400;}' +
    '.pdf-doc table.tax-eff td.val{text-align:right;font-size:16px;font-weight:700;color:#0094DE;white-space:nowrap;}' +
    '.pdf-doc table.tax-eff tr.total td{background:#E8F4EE;}' +
    '.pdf-doc table.tax-eff tr.total td.lbl{color:#04384F;font-weight:700;font-size:11.5px;}' +
    '.pdf-doc table.tax-eff tr.total td.val{color:#2A8556;font-size:17px;}' +
    /* Footnote */
    '.pdf-doc .footnote{font-size:10px;font-style:italic;color:#5A6B7A;margin-top:14px;line-height:1.5;}';

  function injectStyles() {
    if (document.getElementById('pdf-doc-styles')) return;
    const s = document.createElement('style');
    s.id = 'pdf-doc-styles';
    s.textContent = PDF_CSS;
    document.head.appendChild(s);
  }

  function buildHeader(date, rightHtml, withSlogan, withCyanBadge) {
    const rightBlock = withCyanBadge
      ? '<div class="hr-badge">' + rightHtml + '</div>'
      : rightHtml;
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
          (withSlogan ? '<div class="contacts">promliz.com&nbsp;&nbsp;|&nbsp;&nbsp;promlizing@inbox.ru&nbsp;&nbsp;|&nbsp;&nbsp;т/ф (4852) 77-01-87, 58-50-60</div>' : '') +
        '</td>' +
        '<td class="h-r">' + rightBlock + '</td>' +
      '</tr></table>' +
      '<div class="accent-bar"></div>'
    );
  }

  function buildFooter() {
    return '<div class="footer">' +
      'т/ф (4852) 77-01-87, 58-50-60 | г. Ярославль, ул. Победы, д. 38/27, оф. 512 | ' +
      '<span class="u">promliz.com</span> | <span class="u">promlizing@inbox.ru</span>' +
      '</div>';
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
            true, true) +

          '<h1>Предварительный расчет по договору лизинга</h1>' +

          '<table class="summary">' +
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
      '<div class="page page-2">' +
        '<div class="page-inner">' +
          buildHeader(date,
            '<div style="text-align:right;font-size:13px;font-weight:700;color:#0094DE;line-height:1.4;padding-top:6px;">' +
              'Условия лизинга - продолжение' +
              '<div style="font-size:11px;color:#04384F;font-weight:500;margin-top:3px;">Дата: ' + date + '&nbsp;&nbsp;|&nbsp;&nbsp;Конфиденциально</div>' +
            '</div>',
            false, false) +

          '<h1 class="h1-left">Итоговые условия и налоговый эффект</h1>' +

          '<table class="twocols-grid"><tr>' +
            '<td class="col-left">' +
              '<div class="panel-title">Итоговые условия</div>' +
              '<table class="params">' +
                '<colgroup><col class="c1"><col class="c2"></colgroup>' +
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
            '<td class="col-right">' +
              '<div class="panel-title">Налоговый эффект</div>' +
              '<table class="tax-eff">' +
                '<colgroup><col class="c1"><col class="c2"></colgroup>' +
                '<thead><tr><th colspan="2">Приобретайте автотранспорт, спецтехнику и оборудование в лизинг и получайте экономию на налогах в течение срока договора.</th></tr></thead>' +
                '<tbody>' +
                  '<tr><td class="lbl">Возврат НДС 22%<small>со всей суммы договора лизинга</small></td><td class="val">' + fmt2.format(d.vatReturn) + ' ₽</td></tr>' +
                  '<tr><td class="lbl">Экономия по налогу на прибыль<small>лизинговые платежи уменьшают налоговую базу</small></td><td class="val">' + fmt2.format(d.profitSaving) + ' ₽</td></tr>' +
                  '<tr class="total"><td class="lbl">Потенциальный совокупный налоговый<br>эффект</td><td class="val">' + fmt2.format(d.taxSaving) + ' ₽</td></tr>' +
                '</tbody>' +
              '</table>' +
              '<p class="footnote">Примечание: расчет предварительный. Финальные условия зависят от предмета лизинга, параметров клиента, страхования и условий поставщика.</p>' +
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

      // wrap видим (под overlay), позиционирован top:0 left:0
      wrap = document.createElement('div');
      wrap.innerHTML = buildHtml(data);
      wrap.style.cssText = 'position:fixed;top:0;left:0;width:1123px;background:#FFFFFF;pointer-events:none;z-index:1;';
      document.body.appendChild(wrap);

      const pages = wrap.querySelectorAll('.pdf-doc .page');
      if (!pages || pages.length < 2) throw new Error('Pages not found');

      // 2 RAF для применения стилей
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const pdf = new jsPDFCtor({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true });

      // Рендерим каждую страницу отдельно, scale=3 (~290 DPI)
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
        // PDF compression: 'SLOW' даёт меньший файл при той же резкости
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
