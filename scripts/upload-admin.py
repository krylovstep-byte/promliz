#!/usr/bin/env python3
"""
Заливает PHP-админку (admin/) на REG.RU через FTPS.

CI деплоит только статику (dist/) — а PHP-часть админки сюда не попадает.
Поэтому отдельный скрипт для штатных загрузок.

Whitelist: только .php, .css, .js из admin/.
Skip:      admin/inc/config.php (приватный конфиг с кредами и хэшем пароля).
           data/* (база данных).

Запуск (PowerShell):
  $env:FTP_PASS='пароль'; python3 scripts/upload-admin.py

Опции:
  --dry                   — показать список файлов которые будут залиты, не заливать
  --only=path             — залить только один конкретный файл, например --only=admin/index.php
  --delete-remote=path    — удалить один файл с прода, например
                            --delete-remote=admin/inc/_migrate-statuses.php
"""

import os
import sys
import argparse
from pathlib import Path
from ftplib import FTP_TLS

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
ADMIN_LOCAL = ROOT / 'admin'
ADMIN_REMOTE = '/www/promliz.com/admin'

# Что заливать — только эти расширения
ALLOWED_EXT = {'.php', '.css', '.js'}

# Что НЕ заливать — приватный конфиг
SKIP_FILES = {
    'inc/config.php',  # содержит password_hash и app_secret
}

FTP_HOST = 'server123.hosting.reg.ru'
FTP_USER = 'u3532223'


def collect_files() -> list[Path]:
    """Все файлы admin/*.{php,css,js} кроме исключений."""
    files: list[Path] = []
    for p in ADMIN_LOCAL.rglob('*'):
        if not p.is_file():
            continue
        if p.suffix.lower() not in ALLOWED_EXT:
            continue
        rel = p.relative_to(ADMIN_LOCAL).as_posix()
        if rel in SKIP_FILES:
            continue
        files.append(p)
    return sorted(files)


def remote_path_for(local: Path) -> str:
    rel = local.relative_to(ADMIN_LOCAL).as_posix()
    return f'{ADMIN_REMOTE}/{rel}'


def ensure_dirs(ftp: FTP_TLS, remote_file: str) -> None:
    """mkdir -p для всех директорий по пути."""
    parts = remote_file.split('/')
    cur = ''
    for part in parts[1:-1]:  # skip leading '' and the file itself
        cur += '/' + part
        try:
            ftp.mkd(cur)
        except Exception:
            pass  # уже существует — норм


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry', action='store_true', help='Только показать что будем заливать')
    ap.add_argument('--only', help='Залить только один файл, путь от корня репо (admin/index.php)')
    ap.add_argument('--delete-remote', help='Удалить один файл с прода, например admin/inc/_migrate-statuses.php')
    args = ap.parse_args()

    if not os.environ.get('FTP_PASS') and not args.dry:
        print('Нет FTP_PASS в окружении. Запусти так:')
        print("  $env:FTP_PASS='пароль'; python3 scripts/upload-admin.py")
        return 1

    # Режим удаления одного файла с прода
    if args.delete_remote:
        rel = args.delete_remote
        if not rel.startswith('admin/'):
            print(f'Удалить можно только из admin/: {rel}')
            return 1
        remote = '/www/promliz.com/' + rel
        print(f'УДАЛЯЮ с прода: {remote}')
        ftp = FTP_TLS(FTP_HOST, timeout=30)
        ftp.auth(); ftp.login(FTP_USER, os.environ['FTP_PASS']); ftp.prot_p(); ftp.set_pasv(True)
        try:
            ftp.delete(remote)
            print('OK, удалено')
            ftp.quit()
            return 0
        except Exception as e:
            print(f'ERR: {e}')
            ftp.quit()
            return 2

    if args.only:
        target = ROOT / args.only
        if not target.exists():
            print(f'Файл не существует: {target}')
            return 1
        if not target.is_relative_to(ADMIN_LOCAL):
            print(f'Файл не в admin/: {target}')
            return 1
        files = [target]
    else:
        files = collect_files()

    print(f'Файлов к заливке: {len(files)}')
    for f in files:
        rel = f.relative_to(ROOT).as_posix()
        remote = remote_path_for(f)
        print(f'  {rel}  →  {remote}')

    if args.dry:
        print('\n(dry-run, ничего не залито)')
        return 0

    ftp = FTP_TLS(FTP_HOST, timeout=30)
    ftp.auth()
    ftp.login(FTP_USER, os.environ['FTP_PASS'])
    ftp.prot_p()
    ftp.set_pasv(True)

    ok = 0
    failed: list[tuple[str, str]] = []
    for f in files:
        remote = remote_path_for(f)
        try:
            ensure_dirs(ftp, remote)
            with open(f, 'rb') as fh:
                ftp.storbinary(f'STOR {remote}', fh)
            ok += 1
            print(f'  OK  {remote}')
        except Exception as e:
            failed.append((remote, str(e)))
            print(f'  ERR {remote}: {e}')

    ftp.quit()

    print(f'\nГотово: {ok}/{len(files)}')
    if failed:
        print('Ошибки:')
        for r, e in failed:
            print(f'  {r}: {e}')
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
