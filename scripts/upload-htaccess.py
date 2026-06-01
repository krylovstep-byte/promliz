#!/usr/bin/env python3
"""
Безопасно обновляет корневой .htaccess на REG.RU.

Что делает:
  1. Скачивает текущий /www/promliz.com/.htaccess (если есть)
  2. Сохраняет бэкап в tmp/htaccess-backup-prod.txt
  3. Вырезает прошлый наш блок (между маркерами BEGIN/END PROMLIZ-REDIRECTS),
     чтобы не плодить дубли при повторном запуске (идемпотентность)
  4. Берёт свежий наш блок из локального .htaccess (в корне репо)
  5. Собирает: [существующие правила хостинга/SSL] + [наш свежий блок]
  6. Заливает обратно

SSL-редирект http->https и любые другие правила хостинга СОХРАНЯЮТСЯ —
трогаем только наш маркированный блок.

Запуск (PowerShell):
  $env:FTP_PASS='пароль'; python3 scripts/upload-htaccess.py
Опции:
  --dry   только показать что получится, не заливать
"""

import os
import sys
import io
import argparse
from pathlib import Path
from ftplib import FTP_TLS, error_perm

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
LOCAL_HTACCESS = ROOT / '.htaccess'
BACKUP = ROOT / 'tmp' / 'htaccess-backup-prod.txt'

FTP_HOST = 'server123.hosting.reg.ru'
FTP_USER = 'u3532223'
REMOTE = '/www/promliz.com/.htaccess'

BEGIN = '# BEGIN PROMLIZ-REDIRECTS'
END = '# END PROMLIZ-REDIRECTS'


def extract_our_block(text: str) -> str:
    """Вырезать наш блок BEGIN..END из текста (с маркерами)."""
    if BEGIN in text and END in text:
        start = text.index(BEGIN)
        end = text.index(END) + len(END)
        return text[start:end]
    return ''


def strip_our_block(text: str) -> str:
    """Удалить наш блок из текста, вернуть остальное (правила хостинга/SSL)."""
    if BEGIN in text and END in text:
        start = text.index(BEGIN)
        end = text.index(END) + len(END)
        # убрать блок + лишние пустые строки вокруг
        before = text[:start].rstrip()
        after = text[end:].lstrip()
        if before and after:
            return before + '\n\n' + after
        return (before + after).strip()
    return text.strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry', action='store_true')
    args = ap.parse_args()

    if not LOCAL_HTACCESS.exists():
        print(f'Нет локального .htaccess: {LOCAL_HTACCESS}')
        return 1

    our_block = extract_our_block(LOCAL_HTACCESS.read_text(encoding='utf-8'))
    if not our_block:
        print('В локальном .htaccess нет блока BEGIN/END PROMLIZ-REDIRECTS')
        return 1

    if not os.environ.get('FTP_PASS') and not args.dry:
        print("Нет FTP_PASS. Запусти: $env:FTP_PASS='пароль'; python3 scripts/upload-htaccess.py")
        return 1

    # --- Скачать текущий прод .htaccess ---
    prod_text = ''
    if os.environ.get('FTP_PASS'):
        f = FTP_TLS(FTP_HOST, timeout=30)
        f.auth()
        f.login(FTP_USER, os.environ['FTP_PASS'])
        f.prot_p()
        f.set_pasv(True)
        buf = []
        try:
            f.retrbinary(f'RETR {REMOTE}', buf.append)
            prod_text = b''.join(buf).decode('utf-8', errors='replace')
            print(f'Текущий .htaccess на проде: {len(prod_text)} байт')
        except error_perm as e:
            if '550' in str(e):
                print('На проде .htaccess НЕТ (SSL-редирект, видимо, на уровне nginx). Создаём новый.')
            else:
                print(f'Ошибка скачивания: {e}')
                f.quit()
                return 2
    else:
        print('(dry без FTP_PASS — прод не скачивается, показываю только наш блок)')

    # --- Бэкап ---
    if prod_text and not args.dry:
        BACKUP.parent.mkdir(parents=True, exist_ok=True)
        BACKUP.write_text(prod_text, encoding='utf-8')
        print(f'Бэкап сохранён: {BACKUP}')

    # --- Собрать новый .htaccess ---
    host_rules = strip_our_block(prod_text)  # правила хостинга без нашего старого блока
    if host_rules:
        new_text = host_rules + '\n\n' + our_block + '\n'
    else:
        new_text = our_block + '\n'

    print('\n=== Что будет на проде (.htaccess) ===')
    print(new_text)
    print('=== конец ===\n')

    if args.dry:
        print('(dry-run, ничего не залито)')
        return 0

    # --- Залить ---
    f.storbinary(f'STOR {REMOTE}', io.BytesIO(new_text.encode('utf-8')))
    f.quit()
    print(f'OK: .htaccess залит на {REMOTE}')
    print('Проверь: curl -I http://promliz.com/ (должен быть 301 на https)')
    print('         curl -I https://promliz.com/about-lising (301 на /)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
