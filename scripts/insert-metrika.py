#!/usr/bin/env python3
"""
Вставляет код Яндекс.Метрики (ID 109552650) перед </head> во все HTML
проекта. Идемпотентен: если код уже есть — пропускает файл.

Запуск:
  python3 scripts/insert-metrika.py [--dry]

Опции:
  --dry — показать какие файлы будут изменены, не менять
"""

import argparse
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent

# Папки и одиночные файлы — те же что в build.mjs COPY_DIRS/FILES
TARGETS_DIRS = ['blog', 'seo', 'docs']
TARGETS_FILES = ['index.html']

METRIKA_ID = '109552650'

METRIKA_BLOCK = '''  <!-- Yandex.Metrika counter -->
  <script type="text/javascript">
    (function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
    })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=109552650', 'ym');

    ym(109552650, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
  </script>
  <noscript><div><img src="https://mc.yandex.ru/watch/109552650" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
  <!-- /Yandex.Metrika counter -->
'''


def collect_htmls() -> list[Path]:
    files: list[Path] = []
    for f in TARGETS_FILES:
        p = ROOT / f
        if p.is_file():
            files.append(p)
    for d in TARGETS_DIRS:
        dp = ROOT / d
        if not dp.exists():
            continue
        for p in sorted(dp.rglob('*.html')):
            files.append(p)
    return files


def process(path: Path, dry: bool) -> str:
    """Возвращает: 'skipped', 'inserted', 'error'."""
    try:
        text = path.read_text(encoding='utf-8')
    except Exception as e:
        return f'error:{e}'

    if METRIKA_ID in text:
        return 'skipped'

    # Вставляем перед </head>. Не делаем regex — простая подстановка строки
    idx = text.rfind('</head>')
    if idx < 0:
        return 'error:no </head>'

    new_text = text[:idx] + METRIKA_BLOCK + text[idx:]

    if dry:
        return 'inserted'

    path.write_text(new_text, encoding='utf-8')
    return 'inserted'


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry', action='store_true')
    args = ap.parse_args()

    files = collect_htmls()
    print(f'Файлов HTML: {len(files)}')

    counts = {'inserted': 0, 'skipped': 0, 'error': 0}
    for p in files:
        rel = p.relative_to(ROOT).as_posix()
        result = process(p, args.dry)
        if result.startswith('error'):
            print(f'  ERR  {rel}: {result}')
            counts['error'] += 1
        elif result == 'inserted':
            print(f'  ADD  {rel}')
            counts['inserted'] += 1
        else:
            print(f'  ok   {rel} (уже есть)')
            counts['skipped'] += 1

    print('')
    print(f'Добавлено: {counts["inserted"]}')
    print(f'Пропущено (уже было): {counts["skipped"]}')
    print(f'Ошибок: {counts["error"]}')
    if args.dry:
        print('\n(dry-run, ничего не менял)')
    return 0 if counts['error'] == 0 else 2


if __name__ == '__main__':
    sys.exit(main())
