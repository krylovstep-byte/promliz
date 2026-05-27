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
    // V58: динамическое кол-во колонок чтобы все строки влезли на 1 страницу A4 landscape.
    // На страницу вмещается ~16 строк (после header+summary+title). Поэтому:
    // n<=36 → 3 колонки (как в эталоне Стёпы), n=48 → 4, n=60 → 4 (по 16 строк).
    const cols = Math.max(3, Math.ceil(rows.length / 16));
    const perCol = Math.ceil(rows.length / cols);
    const result = [];
    for (let c = 0; c < cols; c++) {
      result.push(rows.slice(c * perCol, (c + 1) * perCol));
    }
    return result;
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

  // Реальный лого Промлизинг — оранжевые арки + полное слово «Промлизинг»
  // (синяя ПРОМЛИ + тёмно-синяя ЗИНГ). viewBox 2385×300 → aspect ~7.95:1.
  // Размер задаётся в CSS .pdf-logo-block svg { height: 40px }.
  const LOGO_SVG =
    '<svg viewBox="0 0 2385 300" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path fill-rule="evenodd" clip-rule="evenodd" d="M42.1741 177.128C36.593 204.423 3.47776 198.288 0.251536 177.686L0 2H423.954C522.821 5.47571 500.61 71.2771 503.184 176.934C503.758 200.436 462.041 201.848 461.179 177.981C459.874 141.885 463.919 93.5977 459.389 65.6313C457.361 53.129 451.676 47.2789 437.509 44.5474C284.724 44.1025 213.51 42.7531 42.5351 45.0689L42.1741 177.128Z" fill="#FF9545"/>' +
      '<path fill-rule="evenodd" clip-rule="evenodd" d="M20.4862 225.798C7.09652 227.107 1.02319 234.715 0.961213 247.524C0.906534 259.008 8.9885 265.209 16.4215 267.561C61.432 266.27 101.612 266.332 148.769 267.112C165.338 267.386 185.213 252.082 193.481 238.337L251.557 141.776L311.798 240.317C322.278 257.696 336.495 264.512 349.174 266.711H485.925C504.869 266.711 509.114 226.265 481.076 227.537L365.342 226.119C357.85 225.918 350.246 223.351 345.995 216.439L269.368 86.3429C259.726 73.6654 248.746 62.8515 229.793 93.3819L162.516 209.521C161.951 213.945 145.635 224.915 137.454 225.357L20.4862 225.798Z" fill="#0094DE"/>' +
      '<path d="M667.148 234H622.148V24H804.848V234H760.148V64.5H667.148V234ZM881.885 111C893.685 94.2 911.085 85.8 934.085 85.8C955.885 85.8 972.985 93.3 985.385 108.3C997.985 123.1 1004.29 141 1004.29 162C1004.29 183 997.985 201 985.385 216C972.985 230.8 955.885 238.2 934.085 238.2C914.285 238.2 898.485 231.7 886.685 218.7V300H844.985V90H881.885V111ZM951.485 191.4C958.285 183.4 961.685 173.6 961.685 162C961.685 150.4 958.285 140.7 951.485 132.9C944.685 124.9 935.485 120.9 923.885 120.9C915.285 120.9 907.585 123.2 900.785 127.8C894.185 132.4 889.385 138.1 886.385 144.9V179.1C889.385 185.9 894.185 191.6 900.785 196.2C907.585 200.8 915.285 203.1 923.885 203.1C935.485 203.1 944.685 199.2 951.485 191.4ZM1046.61 218.1C1031.21 204.7 1023.51 186 1023.51 162C1023.51 138 1031.21 119.3 1046.61 105.9C1062.01 92.5 1080.81 85.8 1103.01 85.8C1125.41 85.8 1144.21 92.5 1159.41 105.9C1174.81 119.3 1182.51 138 1182.51 162C1182.51 186 1174.81 204.7 1159.41 218.1C1144.21 231.5 1125.41 238.2 1103.01 238.2C1080.81 238.2 1062.01 231.5 1046.61 218.1ZM1130.31 190.2C1136.91 182.8 1140.21 173.4 1140.21 162C1140.21 150.6 1136.91 141.3 1130.31 134.1C1123.71 126.7 1114.61 123 1103.01 123C1091.41 123 1082.31 126.7 1075.71 134.1C1069.31 141.3 1066.11 150.6 1066.11 162C1066.11 173.4 1069.31 182.8 1075.71 190.2C1082.31 197.4 1091.41 201 1103.01 201C1114.61 201 1123.71 197.4 1130.31 190.2ZM1250.23 234H1209.73V90H1249.63L1294.33 161.4L1339.33 90H1378.93V234H1338.73V149.1L1304.83 202.8H1284.13L1250.23 149.1V234Z" fill="#0094DE"/>' +
      '<path d="M1478.12 123C1476.92 140.6 1475.22 155.8 1473.02 168.6C1471.02 181.2 1468.02 193 1464.02 204C1460.02 214.8 1454.62 223 1447.82 228.6C1441.02 234.2 1432.82 237 1423.22 237C1415.82 237 1408.22 235.6 1400.42 232.8V199.8C1403.42 201 1406.32 201.6 1409.12 201.6C1419.52 201.6 1426.82 192.3 1431.02 173.7C1435.22 155.1 1438.12 127.2 1439.72 90H1556.72V234H1515.02V123H1478.12ZM1628.36 234H1592.06V90H1633.76V171L1697.96 90H1733.96V234H1692.56V153L1628.36 234ZM1887.5 194.1C1887.5 206.3 1881.5 216.7 1869.5 225.3C1857.5 233.7 1839.9 237.9 1816.7 237.9C1795.1 237.9 1776.8 234 1761.8 226.2V192.9C1767.6 196.1 1775.2 199 1784.6 201.6C1794 204 1802.9 205.2 1811.3 205.2C1833.7 205.2 1844.9 199.8 1844.9 189C1844.9 183.4 1842.4 179.7 1837.4 177.9C1832.6 175.9 1825.9 174.9 1817.3 174.9H1790.6V147.3H1817.3C1833.7 147.3 1841.9 142.8 1841.9 133.8C1841.9 123.6 1832.5 118.5 1813.7 118.5C1805.7 118.5 1797 119.7 1787.6 122.1C1778.2 124.5 1770.5 127.3 1764.5 130.5V97.5C1779.5 89.5 1797.6 85.5 1818.8 85.5C1841.8 85.5 1858.5 89.7 1868.9 98.1C1879.3 106.3 1884.5 116.4 1884.5 128.4C1884.5 136.6 1882.2 143.4 1877.6 148.8C1873.2 154.2 1867.4 157.9 1860.2 159.9C1878.4 165.5 1887.5 176.9 1887.5 194.1ZM1951.79 234H1915.49V90H1957.19V171L2021.39 90H2057.39V234H2015.99V153L1951.79 234ZM2134.44 234H2092.74V90H2134.44V144.6H2192.64V90H2234.34V234H2192.64V179.4H2134.44V234ZM2311.39 234H2269.69V90H2379.49V125.1H2311.39V234Z" fill="#0069A1"/>' +
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
    /* Логотип — реальный SVG (две арки + полное слово Промлизинг) */
    '.pdf-doc .pdf-logo-block{display:block;line-height:0;}' +
    '.pdf-doc .pdf-logo-block svg{display:block;height:42px;width:auto;}' +
    '.pdf-doc .pdf-slogan{font-size:11px;color:#04384F;margin-top:6px;font-weight:700;}' +
    '.pdf-doc .pdf-contacts{font-size:10px;color:#0094DE;margin-top:4px;text-decoration:none;letter-spacing:0.01em;}' +
    /* Голубая плашка справа */
    '.pdf-doc .pdf-hr-badge{background:#0094DE !important;color:#FFFFFF !important;padding:10px 14px 12px;text-align:right;font-size:11px;line-height:1.5;}' +
    '.pdf-doc .pdf-hr-badge strong{display:block;font-size:13px;font-weight:700;color:#FFFFFF !important;}' +
    '.pdf-doc .pdf-hr-badge em{display:block;font-style:italic;font-weight:400;color:#FFFFFF !important;}' +
    /* Полоска под хедером */
    '.pdf-doc .pdf-accent-bar{height:3px;width:1067px;background:linear-gradient(90deg,#0094DE 0%,#0094DE 66%,#FF9545 66%,#FF9545 78%,transparent 78%) !important;}' +
    /* ====== ЗАГОЛОВКИ ====== */
    /* V60.4: H1 margin-top 20→8 (Стёпа просил выше на 12px) */
    '.pdf-doc h1{font-size:24px;text-align:center;margin:8px 0 12px;font-weight:700;color:#04384F;}' +
    '.pdf-doc h1.pdf-h1-left{text-align:left;margin:14px 0 12px;font-size:22px;color:#04384F;}' +
    /* V60.4: H2 без верхнего регистра (читабельнее) */
    '.pdf-doc h2{font-size:16px;text-align:center;color:#04384F;letter-spacing:0.02em;margin:10px 0 16px;font-weight:700;}' +
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
    '.pdf-doc table.pdf-sched-grid td{vertical-align:top;padding:0;border:0;background:transparent;}' +
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
          '<div class="pdf-logo-block">' + LOGO_SVG + '</div>' +
          (withSlogan ? '<div class="pdf-slogan">Работаем с 2001 года!</div>' : '') +
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
          // V58: цикл по N колонкам (3 для <=36 мес, 4 для 48/60). Inline width = (1067 - gaps) / N.
          (function () {
            const n = cols.length;
            const colW = Math.floor((1067 - (n - 1) * 14) / n);
            let html = '<table class="pdf-sched-grid"><tr>';
            for (let i = 0; i < n; i++) {
              html += '<td style="width:' + colW + 'px">' + renderSchedTable(cols[i]) + '</td>';
            }
            return html + '</tr></table>';
          })() +

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
                '<thead><tr><th colspan="2">Дополнительная выгода через налоговые льготы</th></tr></thead>' +
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
