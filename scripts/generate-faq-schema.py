#!/usr/bin/env python3
"""
Генерирует FAQPage JSON-LD из СУЩЕСТВУЮЩЕГО FAQ-контента на seo-страницах.

На seo/*.html есть видимый FAQ-блок (<details class="faq-item">), но он не
размечен structured data. Этот скрипт парсит вопросы-ответы прямо из HTML
и добавляет <script type="application/ld+json"> с FAQPage — чтобы Google и
Яндекс показывали расширенные сниппеты (FAQ-аккордеоны в выдаче).

ВАЖНО: контент НЕ выдумывается — берётся 1-в-1 из видимого текста страницы.
Это требование Schema.org (FAQ-разметка должна совпадать с видимым контентом).

Идемпотентно: если FAQPage уже есть на странице — пропускает.

Запуск:
  python3 scripts/generate-faq-schema.py [--dry] [--only seo/lizing-transporta.html]
"""

import argparse
import html as html_mod
import json
import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
SEO_DIR = ROOT / 'seo'

# Маркер, перед которым вставляем FAQPage-блок (есть на всех страницах).
INSERT_BEFORE = '  <!-- Yandex.Metrika counter -->'

# Один FAQ-элемент: <details ...><summary>ВОПРОС<span...></span></summary>
#                    <div class="faq-item__body">ОТВЕТ</div></details>
FAQ_ITEM_RE = re.compile(
    r'<details[^>]*class="faq-item"[^>]*>'
    r'<summary>(?P<q>.*?)<span[^>]*class="faq-item__icon"',
    re.S,
)
# Ответ ловим отдельно — от body до закрытия details
FAQ_FULL_RE = re.compile(
    r'<details[^>]*class="faq-item"[^>]*>'
    r'<summary>(?P<q>.*?)<span[^>]*class="faq-item__icon"[^>]*>.*?</summary>'
    r'<div[^>]*class="faq-item__body"[^>]*>(?P<a>.*?)</div>\s*</details>',
    re.S,
)


def clean_text(raw: str) -> str:
    """HTML-фрагмент → чистый текст для JSON-LD."""
    # &nbsp; и прочие entity → нормальные символы
    t = html_mod.unescape(raw)
    # неразрывный пробел → обычный
    t = t.replace(' ', ' ')
    # убрать любые HTML-теги (<p>, <br>, <a> и т.д.)
    t = re.sub(r'<[^>]+>', ' ', t)
    # схлопнуть пробелы
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def extract_faqs(html: str) -> list[dict]:
    faqs = []
    for m in FAQ_FULL_RE.finditer(html):
        q = clean_text(m.group('q'))
        a = clean_text(m.group('a'))
        if q and a:
            faqs.append({'q': q, 'a': a})
    return faqs


def build_faqpage(faqs: list[dict]) -> str:
    obj = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        'mainEntity': [
            {
                '@type': 'Question',
                'name': f['q'],
                'acceptedAnswer': {'@type': 'Answer', 'text': f['a']},
            }
            for f in faqs
        ],
    }
    body = json.dumps(obj, ensure_ascii=False, indent=2)
    return '<script type="application/ld+json">\n' + body + '\n</script>\n'


def process(path: Path, dry: bool) -> str:
    html = path.read_text(encoding='utf-8')

    if 'FAQPage' in html:
        return 'skip:already'
    if 'faq-item' not in html:
        return 'skip:no-faq'

    faqs = extract_faqs(html)
    if not faqs:
        return 'skip:parse-failed'

    if INSERT_BEFORE not in html:
        return 'error:no-insert-marker'

    block = build_faqpage(faqs)
    # Вставляем перед блоком Метрики (внутри <head>)
    new_html = html.replace(INSERT_BEFORE, block + INSERT_BEFORE, 1)

    if not dry:
        path.write_text(new_html, encoding='utf-8')

    return f'ok:{len(faqs)}'


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry', action='store_true')
    ap.add_argument('--only', help='Один файл, путь от корня (seo/lizing-transporta.html)')
    args = ap.parse_args()

    if args.only:
        files = [ROOT / args.only]
    else:
        files = sorted(SEO_DIR.glob('*.html'))

    stats = {'ok': 0, 'skip': 0, 'error': 0}
    total_q = 0
    for f in files:
        rel = f.relative_to(ROOT).as_posix()
        res = process(f, args.dry)
        if res.startswith('ok'):
            n = int(res.split(':')[1])
            total_q += n
            stats['ok'] += 1
            print(f'  ADD  {rel}  ({n} вопросов)')
        elif res.startswith('skip'):
            stats['skip'] += 1
            print(f'  skip {rel}  ({res.split(":")[1]})')
        else:
            stats['error'] += 1
            print(f'  ERR  {rel}  ({res})')

    print('')
    print(f'FAQPage добавлено: {stats["ok"]} страниц, {total_q} вопросов всего')
    print(f'Пропущено: {stats["skip"]}, ошибок: {stats["error"]}')
    if args.dry:
        print('(dry-run, файлы не менялись)')
    return 0 if stats['error'] == 0 else 2


if __name__ == '__main__':
    sys.exit(main())
