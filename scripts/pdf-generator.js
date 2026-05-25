/* V51: PDF-генератор графика лизинговых платежей.
   Использует html2pdf.js (HTML → canvas → PDF). Кириллица поддерживается.
   Lib подгружается lazy при первом клике на кнопку «Скачать график PDF».

   Источник данных — большой калькулятор #calc. Шаблон 1:1 как у Промлизинг
   (Приложение №2, ООО "МБ-Лизинг"): сводная таблица + график 36 платежей
   в 3 колонки + страница 2 с итоговыми условиями и налоговым эффектом.

   Использование: window.generateLeasingPdf({ price, advance, advancePct, n,
   monthly, total, vatReturn, profitSaving, taxSaving, annualMarkup, taxMode })
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
    let m = now.getMonth() + 1; // следующий месяц
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
      return '<tr class="row-header"><td colspan="2">' + r.label +
             '</td><td class="num">' + fmt.format(r.val) + ' ₽</td></tr>';
    }
    return '<tr><td class="mes">' + r.num + '</td><td>' + r.date +
           '</td><td class="num">' + fmt.format(r.val) + ' ₽</td></tr>';
  }

  function renderColTable(rows) {
    return '<table class="sched">' +
      '<thead><tr><th>Мес.</th><th>Дата платежа</th><th>Платеж, в т.ч. НДС</th></tr></thead>' +
      '<tbody>' + rows.map(renderRow).join('') + '</tbody></table>';
  }

  // Inline SVG логотип Промлизинг — стилизованная буква "П" в синем круге + оранжевая полоска
  const LOGO_SVG = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">' +
    '<rect width="64" height="64" rx="12" fill="#0094DE"/>' +
    '<path d="M16 16h32v8h-12v24h-8V24H16z" fill="#FFFFFF"/>' +
    '<rect x="16" y="48" width="32" height="3" rx="1.5" fill="#FF9545"/>' +
    '</svg>';

  function buildHtml(d) {
    const date = todayStr();
    const cols = buildScheduleColumns(d.monthly, d.n, d.advance, d.total);

    return [
      '<style>',
      '.pdf-doc { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #04384F; width: 297mm; }',
      '.pdf-doc .page { width: 297mm; height: 210mm; padding: 12mm 14mm; box-sizing: border-box; page-break-after: always; position: relative; background: #FFF; }',
      '.pdf-doc .page:last-child { page-break-after: auto; }',
      '.pdf-doc .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 5mm; border-bottom: 2px solid #0094DE; position: relative; }',
      '.pdf-doc .header::after { content: ""; position: absolute; left: 0; bottom: -2px; width: 72%; height: 2px; background: #0094DE; }',
      '.pdf-doc .header::before { content: ""; position: absolute; left: 72%; bottom: -2px; width: 18%; height: 2px; background: #FF9545; }',
      '.pdf-doc .logo-wrap { display: flex; align-items: center; gap: 10px; }',
      '.pdf-doc .logo-wrap svg { width: 44px; height: 44px; flex-shrink: 0; }',
      '.pdf-doc .brand-name { font-weight: 800; font-size: 22px; color: #0094DE; line-height: 1; }',
      '.pdf-doc .slogan { font-size: 11px; color: #04384F; margin-top: 3px; font-weight: 600; }',
      '.pdf-doc .contacts { font-size: 10px; color: #0094DE; margin-top: 6px; text-decoration: underline; }',
      '.pdf-doc .header-right { text-align: right; font-size: 11px; line-height: 1.5; color: #04384F; }',
      '.pdf-doc .header-right strong { color: #04384F; font-size: 13px; font-weight: 700; }',
      '.pdf-doc .header-right em { font-style: italic; color: #5A6B7A; }',
      '.pdf-doc h1 { font-size: 22px; text-align: center; margin: 7mm 0 4mm; font-weight: 700; color: #04384F; }',
      '.pdf-doc h2 { font-size: 15px; text-align: center; color: #04384F; text-transform: uppercase; letter-spacing: 0.06em; margin: 5mm 0 3mm; font-weight: 700; }',
      '.pdf-doc .summary { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 2mm; }',
      '.pdf-doc .summary th { background: #0094DE; color: #FFF; padding: 9px 10px; font-size: 11px; font-weight: 600; text-align: center; border: 1px solid #0094DE; }',
      '.pdf-doc .summary td { padding: 13px 10px; text-align: center; font-weight: 700; font-size: 14px; background: #F5F9FC; border: 1px solid #E0E6EB; color: #04384F; }',
      '.pdf-doc .summary td.client { font-weight: 600; }',
      '.pdf-doc .summary td.tax-benefit { color: #2A8556; font-weight: 700; }',
      '.pdf-doc .note-line { font-size: 10px; font-style: italic; margin: 2mm 0 0; color: #5A6B7A; }',
      '.pdf-doc .sched-wrap { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4mm; margin-top: 2mm; }',
      '.pdf-doc .sched { width: 100%; border-collapse: collapse; font-size: 10px; }',
      '.pdf-doc .sched th { background: #F5F9FC; color: #04384F; font-weight: 600; padding: 5px 4px; font-size: 9.5px; border-bottom: 1px solid #C0CCD7; text-align: center; }',
      '.pdf-doc .sched th:first-child { width: 28px; }',
      '.pdf-doc .sched th:last-child { width: 70px; }',
      '.pdf-doc .sched td { padding: 4px 6px; border-bottom: 1px solid #F0F3F5; color: #04384F; }',
      '.pdf-doc .sched td.mes { text-align: center; color: #5A6B7A; width: 28px; }',
      '.pdf-doc .sched td.num { text-align: right; font-weight: 600; white-space: nowrap; }',
      '.pdf-doc .sched .row-header td { background: #F5F9FC; font-weight: 700; color: #0094DE; text-align: center; }',
      '.pdf-doc .sched .row-header td.num { color: #0094DE; }',
      '.pdf-doc .footer { position: absolute; bottom: 7mm; left: 14mm; right: 14mm; text-align: center; font-size: 10px; color: #0094DE; font-weight: 600; }',
      '.pdf-doc .twocols { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; margin-top: 4mm; }',
      '.pdf-doc .panel-title { font-size: 12px; font-weight: 700; margin-bottom: 3mm; color: #04384F; }',
      '.pdf-doc .params, .pdf-doc .tax-eff { border-collapse: separate; border-spacing: 0; width: 100%; font-size: 11px; }',
      '.pdf-doc .params th { background: #E8F1F8; padding: 8px; font-weight: 700; text-align: center; color: #04384F; border: 1px solid #C0CCD7; }',
      '.pdf-doc .params td { padding: 7px 10px; border: 1px solid #E0E6EB; color: #04384F; }',
      '.pdf-doc .params td:first-child { font-weight: 500; }',
      '.pdf-doc .params td:last-child { font-weight: 600; }',
      '.pdf-doc .params tr.highlight td { background: #0094DE; color: #FFF; font-weight: 700; border-color: #0094DE; }',
      '.pdf-doc .tax-eff th { background: #0094DE; color: #FFF; padding: 10px; font-size: 11px; font-weight: 500; line-height: 1.4; border: 1px solid #0094DE; }',
      '.pdf-doc .tax-eff td { padding: 10px; border: 1px solid #E0E6EB; }',
      '.pdf-doc .tax-eff td.label { width: 60%; color: #04384F; font-size: 11px; line-height: 1.35; }',
      '.pdf-doc .tax-eff td.label small { color: #5A6B7A; font-size: 9.5px; }',
      '.pdf-doc .tax-eff td.value { text-align: right; font-size: 15px; font-weight: 700; color: #0094DE; white-space: nowrap; }',
      '.pdf-doc .tax-eff tr.total td { background: #E8F4EE; }',
      '.pdf-doc .tax-eff tr.total td.value { color: #2A8556; font-size: 16px; }',
      '.pdf-doc .footnote { font-size: 9.5px; font-style: italic; color: #5A6B7A; margin-top: 4mm; line-height: 1.4; }',
      '.pdf-doc .footer a, .pdf-doc .contacts a { color: #0094DE; text-decoration: underline; }',
      '</style>',

      '<div class="pdf-doc">',

      // ===== PAGE 1 =====
      '<div class="page">',
        '<div class="header">',
          '<div>',
            '<div class="logo-wrap">',
              LOGO_SVG,
              '<div>',
                '<div class="brand-name">Промлизинг</div>',
                '<div class="slogan">Работаем с 2001 года!</div>',
              '</div>',
            '</div>',
            '<div class="contacts">promliz.com | promlizing@inbox.ru | т/ф (4852) 77-01-87, 58-50-60</div>',
          '</div>',
          '<div class="header-right">',
            '<strong>Приложение №2</strong><br>',
            '<em>Конфиденциально</em><br>',
            'ООО "МБ-Лизинг"<br>',
            'Дата: ' + date,
          '</div>',
        '</div>',

        '<h1>Предварительный расчет по договору лизинга</h1>',

        '<table class="summary">',
          '<thead><tr>',
            '<th>Клиент</th>',
            '<th>Стоимость имущества</th>',
            '<th>Первый взнос</th>',
            '<th>Срок лизинга</th>',
            '<th>Потенциальная налоговая выгода</th>',
          '</tr></thead>',
          '<tbody><tr>',
            '<td class="client">ООО______</td>',
            '<td>' + fmt.format(d.price) + ' ₽</td>',
            '<td>' + fmt.format(d.advance) + ' ₽</td>',
            '<td>' + d.n + ' мес.</td>',
            '<td class="tax-benefit">' + fmt.format(d.taxSaving) + ' ₽</td>',
          '</tr></tbody>',
        '</table>',
        '<p class="note-line">Для расчета условно принято: 360 дней в году, 30 дней в месяце.</p>',

        '<h2>График лизинговых платежей</h2>',
        '<div class="sched-wrap">',
          renderColTable(cols[0]),
          renderColTable(cols[1]),
          renderColTable(cols[2]),
        '</div>',

        '<div class="footer">т/ф (4852) 77-01-87, 58-50-60 | г. Ярославль, ул. Победы, д. 38/27, оф. 512 | promliz.com | promlizing@inbox.ru</div>',
      '</div>',

      // ===== PAGE 2 =====
      '<div class="page">',
        '<div class="header">',
          '<div>',
            '<div class="logo-wrap">',
              LOGO_SVG,
              '<div class="brand-name">Промлизинг</div>',
            '</div>',
          '</div>',
          '<div class="header-right">',
            '<strong>Условия лизинга - продолжение</strong><br>',
            'Дата: ' + date + ' | Конфиденциально',
          '</div>',
        '</div>',

        '<h1 style="text-align:left;margin-top:7mm;font-size:19px;">Итоговые условия и налоговый эффект</h1>',

        '<div class="twocols">',
          '<div>',
            '<div class="panel-title">Итоговые условия</div>',
            '<table class="params">',
              '<thead><tr><th colspan="2">Параметры договора</th></tr></thead>',
              '<tbody>',
                '<tr><td>Стоимость предмета лизинга</td><td>' + fmt2.format(d.price) + ' ₽</td></tr>',
                '<tr><td>Авансовый платеж</td><td>' + d.advancePct + '% (' + fmt2.format(d.advance) + ' ₽)</td></tr>',
                '<tr><td>Срок договора лизинга</td><td>' + d.n + ' мес.</td></tr>',
                '<tr><td>Страхование имущества</td><td>Не включено в расчет. Страховые компании: АО СОГАЗ, СК СОГЛАСИЕ</td></tr>',
                '<tr class="highlight"><td>Сумма договора</td><td>' + fmt2.format(d.total) + ' ₽</td></tr>',
                '<tr><td>Выкупная стоимость</td><td>5 000 ₽</td></tr>',
                '<tr><td>Постановка на учет</td><td>Клиент</td></tr>',
                '<tr><td>Годовое удорожание</td><td>' + d.annualMarkup + '%</td></tr>',
              '</tbody>',
            '</table>',
          '</div>',
          '<div>',
            '<div class="panel-title">Налоговый эффект</div>',
            '<table class="tax-eff">',
              '<thead><tr><th>Приобретайте автотранспорт, спецтехнику и оборудование в лизинг и получайте экономию на налогах в течение срока договора.</th></tr></thead>',
              '<tbody>',
                '<tr><td class="label">Возврат НДС 22%<br><small>со всей суммы договора лизинга</small></td><td class="value">' + fmt2.format(d.vatReturn) + ' ₽</td></tr>',
                '<tr><td class="label">Экономия по налогу на прибыль<br><small>лизинговые платежи уменьшают налоговую базу</small></td><td class="value">' + fmt2.format(d.profitSaving) + ' ₽</td></tr>',
                '<tr class="total"><td class="label">Потенциальный совокупный налоговый эффект</td><td class="value">' + fmt2.format(d.taxSaving) + ' ₽</td></tr>',
              '</tbody>',
            '</table>',
            '<p class="footnote">Примечание: расчет предварительный. Финальные условия зависят от предмета лизинга, параметров клиента, страхования и условий поставщика.</p>',
          '</div>',
        '</div>',

        '<div class="footer">т/ф (4852) 77-01-87, 58-50-60 | г. Ярославль, ул. Победы, д. 38/27, оф. 512 | promliz.com | promlizing@inbox.ru</div>',
      '</div>',

      '</div>'
    ].join('');
  }

  async function generatePdf(data) {
    let wrap = null;
    try {
      const html2pdf = await loadHtml2pdf();
      wrap = document.createElement('div');
      wrap.innerHTML = buildHtml(data);
      wrap.style.cssText = 'position:fixed;left:-99999px;top:0;width:297mm;z-index:-1;';
      document.body.appendChild(wrap);
      const node = wrap.firstElementChild;
      // .pdf-doc — это последний child (style идёт первым в строке, его не считаем)
      const pdfRoot = wrap.querySelector('.pdf-doc');
      if (!pdfRoot) throw new Error('PDF root not found');

      const fileName = 'Расчет-лизинга-' + todayStr() + '.pdf';
      await html2pdf().from(pdfRoot).set({
        margin: 0,
        filename: fileName,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#FFFFFF' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
        pagebreak: { mode: ['css', 'legacy'] }
      }).save();
    } catch (e) {
      console.error('PDF generation failed:', e);
      alert('Не удалось сгенерировать PDF. Проверьте интернет и попробуйте снова.');
    } finally {
      if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }
  }

  window.generateLeasingPdf = generatePdf;
})();
