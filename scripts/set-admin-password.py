#!/usr/bin/env python3
"""
Меняет пароль админки одной командой:
1. Генерит bcrypt-хеш из переданного пароля
2. Правит admin/inc/config.php локально (admin_password_hash)
3. Заливает config.php на REG.RU через FTPS

Запуск:
  $env:FTP_PASS='FTP_пароль_от_REGRU'
  python3 scripts/set-admin-password.py "новый_пароль_админки"

Опционально можно поменять логин:
  python3 scripts/set-admin-password.py "пароль" --login "НовыйЛогин"
"""

import os
import re
import sys
import argparse
from pathlib import Path
from ftplib import FTP_TLS

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

try:
    import bcrypt
except ImportError:
    print('Нет модуля bcrypt. Установи: pip install bcrypt')
    sys.exit(1)

ap = argparse.ArgumentParser()
ap.add_argument('password', help='новый пароль админки')
ap.add_argument('--login', default=None, help='опционально: новый логин')
args = ap.parse_args()

if not os.environ.get('FTP_PASS'):
    print('Нет FTP_PASS. Поставь: $env:FTP_PASS=\'FTP_пароль_от_reg.ru\'')
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
cfg = ROOT / 'admin' / 'inc' / 'config.php'
if not cfg.exists():
    print(f'Нет файла {cfg}')
    sys.exit(1)

# 1. Хеш
hashed = bcrypt.hashpw(args.password.encode(), bcrypt.gensalt(rounds=12)).decode()
print(f'Новый хеш: {hashed}')

# 2. Правка config.php
text = cfg.read_text(encoding='utf-8')

text_new = re.sub(
    r"'admin_password_hash'\s*=>\s*'[^']*'",
    f"'admin_password_hash' => '{hashed}'",
    text,
    count=1,
)
if args.login:
    text_new = re.sub(
        r"'admin_username'\s*=>\s*'[^']*'",
        f"'admin_username'      => '{args.login}'",
        text_new,
        count=1,
    )

if text_new == text:
    print('ВНИМАНИЕ: ничего не изменилось в config.php — проверь формат файла')
    sys.exit(1)

cfg.write_text(text_new, encoding='utf-8')
print(f'OK: {cfg} обновлён локально')

# 3. Заливаем на сервер
f = FTP_TLS('server123.hosting.reg.ru', timeout=30)
f.auth()
f.login('u3532223', os.environ['FTP_PASS'])
f.prot_p()
f.set_pasv(True)

with open(cfg, 'rb') as fh:
    f.storbinary('STOR /www/promliz.com/admin/inc/config.php', fh)
print('OK: config.php залит на REG.RU')

f.quit()

print()
print('Теперь зайди:')
print('  https://promliz.com/admin/login.php')
if args.login:
    print(f'  Логин:  {args.login}')
else:
    print(f'  Логин:  (не меняли — старый из config.php)')
print(f'  Пароль: {args.password}')
print()
print('Если получишь "Неверный логин или пароль" — подожди 1-2 минуты (OPcache).')
