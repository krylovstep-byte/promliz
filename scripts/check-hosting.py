#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ТОЛЬКО ПРОВЕРКА (read-only) содержимого хостинга REG.RU через FTPS.

НИЧЕГО НЕ МЕНЯЕТ. Только листинг папок и размеры файлов.
Нужно понять, почему сервер отдаёт заглушку "Домен не привязан":
лежат ли вообще наши файлы и где именно.

Запуск:
  $env:FTP_PASS='пароль'; python3 scripts/check-hosting.py
"""

import os
import sys
from ftplib import FTP_TLS

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

HOST = 'server123.hosting.reg.ru'
USER = os.environ.get('FTP_USER', 'u3532223')

# Возможные места, где может лежать docroot нашего сайта
CANDIDATE_DIRS = [
    '/www/promliz.com',
    '/www/promliz.com/public_html',
    '/var/www/u3532223/data/www/promliz.com',
    '/data/www/promliz.com',
    '/public_html',
    '/www',
    '/',
]

# Ключевые файлы нашего нового сайта (если они есть — сайт залит)
KEY_FILES = [
    'index.html',
    'robots.txt',
    'admin/login.php',
    'admin/inc/config.php',
    'admin/api/submit.php',
]


def p(msg=''):
    print(msg, flush=True)


def connect():
    ftps = FTP_TLS(HOST, timeout=30)
    ftps.auth()
    ftps.login(USER, os.environ['FTP_PASS'])
    ftps.prot_p()
    ftps.set_pasv(True)
    return ftps


def safe_list(ftps, path):
    """Вернёт список строк LIST для path, либо None если папки нет."""
    cur = ftps.pwd()
    try:
        ftps.cwd(path)
    except Exception:
        return None
    out = []
    try:
        ftps.retrlines('LIST', out.append)
    except Exception as e:
        out.append(f'(ошибка листинга: {e})')
    finally:
        try:
            ftps.cwd(cur)
        except Exception:
            pass
    return out


def file_size(ftps, path):
    try:
        return ftps.size(path)
    except Exception:
        return None


def main():
    if not os.environ.get('FTP_PASS'):
        p('❌ Нет FTP_PASS. Запусти так:')
        p("   $env:FTP_PASS='твой_пароль'; python3 scripts/check-hosting.py")
        sys.exit(1)

    p('═' * 70)
    p(f'ПРОВЕРКА ХОСТИНГА (read-only): {HOST} / {USER}')
    p('═' * 70)

    try:
        ftps = connect()
    except Exception as e:
        p(f'❌ Не удалось подключиться: {type(e).__name__}: {e}')
        sys.exit(2)
    p('✅ FTPS подключено')

    home = ftps.pwd()
    p(f'   home (pwd после login): {home}')
    p('')

    # 1. Перебираем кандидатов docroot
    p('─' * 70)
    p('1. ГДЕ ЛЕЖАТ ФАЙЛЫ — перебор возможных папок:')
    p('─' * 70)
    found_dirs = []
    for d in CANDIDATE_DIRS:
        lst = safe_list(ftps, d)
        if lst is None:
            p(f'   ✗ {d}  — нет такой папки')
        else:
            p(f'   ✓ {d}  — ЕСТЬ ({len(lst)} элементов)')
            found_dirs.append(d)

    # 2. Для каждой найденной папки — показать содержимое (верхний уровень)
    for d in found_dirs:
        p('')
        p('─' * 70)
        p(f'2. СОДЕРЖИМОЕ {d}:')
        p('─' * 70)
        lst = safe_list(ftps, d)
        for line in (lst or [])[:60]:
            p(f'     {line}')
        if lst and len(lst) > 60:
            p(f'     ... и ещё {len(lst) - 60} элементов')

    # 3. Проверка ключевых файлов в каждой найденной папке
    p('')
    p('─' * 70)
    p('3. КЛЮЧЕВЫЕ ФАЙЛЫ НАШЕГО САЙТА:')
    p('─' * 70)
    for d in found_dirs:
        if d == '/':
            continue
        p(f'   в {d}:')
        any_found = False
        for kf in KEY_FILES:
            full = f'{d}/{kf}'
            sz = file_size(ftps, full)
            if sz is not None:
                p(f'     ✓ {kf}  ({sz} байт)')
                any_found = True
            else:
                p(f'     ✗ {kf}  — нет')
        if not any_found:
            p('     (ни одного нашего файла — тут сайта нет)')
        p('')

    try:
        ftps.quit()
    except Exception:
        pass

    p('═' * 70)
    p('ГОТОВО. Скопируй весь вывод выше и покажи мне.')
    p('═' * 70)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        p(f'\n❌ ОШИБКА: {type(e).__name__}: {e}')
        import traceback
        traceback.print_exc()
        sys.exit(1)
