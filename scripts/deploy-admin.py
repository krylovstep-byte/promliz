#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Заливка ТОЛЬКО админки на REG.RU через FTPS.

Источник: admin/ и data/ в репо
Цель:     /www/promliz.com/admin/ и /www/promliz.com/data/

В отличие от deploy-to-hosting.py — НЕ трогает сам сайт.
Только добавляет/обновляет файлы админки.

Запуск:
  $env:FTP_PASS='пароль'; python3 scripts/deploy-admin.py
"""

import os
import sys
import time
from pathlib import Path
from ftplib import FTP_TLS, error_perm

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

HOST = 'server123.hosting.reg.ru'
USER = os.environ.get('FTP_USER', 'u3532223')
# FTP_PASS из окружения

ROOT = Path(__file__).resolve().parent.parent
LOCAL_ADMIN = ROOT / 'admin'
LOCAL_DATA  = ROOT / 'data'
# Если пользователь главный (u3532223), его home = / и нужен полный путь.
# Если sub-пользователь с home=/www/promliz.com — лить относительно (пустой префикс).
# Управляется env: FTP_REMOTE_ROOT (по умолчанию пусто = относительно home).
REMOTE_DOCROOT = os.environ.get('FTP_REMOTE_ROOT', '').rstrip('/')

LOG_PATH = ROOT / 'tmp' / 'deploy-admin.log'
LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
log_file = open(LOG_PATH, 'a', encoding='utf-8')


def log(msg):
    ts = time.strftime('%H:%M:%S')
    line = f'[{ts}] {msg}'
    print(line, flush=True)
    log_file.write(line + '\n'); log_file.flush()


def ftps_connect():
    ftps = FTP_TLS(HOST, timeout=30)
    ftps.auth()
    ftps.login(USER, os.environ['FTP_PASS'])
    ftps.prot_p()
    ftps.set_pasv(True)
    return ftps


def ensure_remote_dir(ftps, path):
    parts = [p for p in path.split('/') if p]
    cur = ''
    for p in parts:
        cur += '/' + p
        try:
            ftps.cwd(cur)
        except error_perm:
            try:
                ftps.mkd(cur)
            except error_perm:
                pass
    ftps.cwd('/')


def remote_file_exists(ftps, path):
    try:
        ftps.size(path)
        return True
    except Exception:
        return False


def upload_file(ftps, local_path: Path, remote_path: str):
    remote_dir = '/'.join(remote_path.split('/')[:-1])
    ensure_remote_dir(ftps, remote_dir)

    for attempt in range(3):
        try:
            with open(local_path, 'rb') as fh:
                ftps.storbinary(f'STOR {remote_path}', fh)
            return True
        except Exception as e:
            if attempt < 2:
                log(f'   ⚠ retry {attempt+1}/3 {remote_path}: {e}')
                time.sleep(2)
                try:
                    ftps.voidcmd('NOOP')
                except Exception:
                    try:
                        ftps.quit()
                    except Exception:
                        pass
                    nonlocal_ftps = ftps_connect()
                    # подменим объект
                    ftps.__dict__.update(nonlocal_ftps.__dict__)
            else:
                log(f'   ❌ FAIL: {remote_path}: {e}')
                return False


def collect_files(local_dir: Path):
    """Все файлы (включая скрытые .htaccess/.gitkeep) внутри local_dir."""
    out = []
    if not local_dir.exists():
        return out
    for f in local_dir.rglob('*'):
        if f.is_file():
            out.append(f)
    return out


def main():
    if not os.environ.get('FTP_PASS'):
        log('❌ Нет FTP_PASS. Запусти: $env:FTP_PASS=\'...\'; python3 scripts/deploy-admin.py')
        sys.exit(1)
    if not LOCAL_ADMIN.exists():
        log(f'❌ Нет папки {LOCAL_ADMIN}')
        sys.exit(1)
    if not (LOCAL_ADMIN / 'inc' / 'config.php').exists():
        log('❌ Нет admin/inc/config.php — без него админка не запустится')
        sys.exit(1)

    log('═' * 70)
    log('ЗАЛИВКА АДМИНКИ НА REG.RU')
    log(f'  Источник:  {LOCAL_ADMIN}')
    log(f'  Хост/юзер: {HOST} / {USER}')
    log(f'  Префикс:   "{REMOTE_DOCROOT}" (пусто = home юзера)')
    log('═' * 70)

    ftps = ftps_connect()
    log('✅ FTPS подключено')

    # Проверяем что home доступен. Для sub-юзера CWD после login уже на home.
    pwd = ftps.pwd()
    log(f'   pwd после login: {pwd}')

    if REMOTE_DOCROOT:
        try:
            ftps.cwd(REMOTE_DOCROOT)
            log(f'✅ docroot есть: {REMOTE_DOCROOT}')
            ftps.cwd(pwd)
        except Exception as e:
            log(f'❌ docroot {REMOTE_DOCROOT} не найден: {e}')
            ftps.quit(); sys.exit(2)

    # 1. admin/
    admin_files = collect_files(LOCAL_ADMIN)
    log(f'\n📦 admin/: {len(admin_files)} файлов')

    ok = fail = 0
    for f in admin_files:
        rel = f.relative_to(ROOT).as_posix()
        remote_path = (REMOTE_DOCROOT + '/' + rel) if REMOTE_DOCROOT else rel
        if upload_file(ftps, f, remote_path):
            ok += 1
            log(f'   ✅ {rel}')
        else:
            fail += 1

    # 2. data/ — только структура, БД создастся на сервере при первой заявке
    data_files = collect_files(LOCAL_DATA)
    log(f'\n📦 data/: {len(data_files)} файлов (служебные .htaccess/.gitkeep)')
    for f in data_files:
        rel = f.relative_to(ROOT).as_posix()
        remote_path = (REMOTE_DOCROOT + '/' + rel) if REMOTE_DOCROOT else rel
        if upload_file(ftps, f, remote_path):
            ok += 1
            log(f'   ✅ {rel}')
        else:
            fail += 1

    log('')
    log('═' * 70)
    log(f'✅ Залито: {ok}, ❌ Ошибок: {fail}')
    log('═' * 70)

    if fail == 0:
        log('')
        log('🎉 Готово! Проверь:')
        log('   1. http://promliz.com/admin/login.php  ← пока сайт не переехал на REG.RU,')
        log('      открой через IP: http://37.140.192.194/admin/login.php с Host: promliz.com')
        log('   2. Логин: admin')
        log('   3. Пароль: тот что давал для bcrypt-хеша')
        log('')
        log('   После переезда на REG.RU обычный URL заработает: https://promliz.com/admin/')

    ftps.quit()


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        log(f'\n❌ ОШИБКА: {type(e).__name__}: {e}')
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        log_file.close()
