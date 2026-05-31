#!/usr/bin/env python3
"""
Заливает admin/inc/config.php на REG.RU.

Запуск:
  $env:FTP_PASS='пароль'; python3 scripts/upload-config.py
"""

import os
import sys
from pathlib import Path
from ftplib import FTP_TLS

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

if not os.environ.get('FTP_PASS'):
    print('Нет FTP_PASS')
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
local = ROOT / 'admin' / 'inc' / 'config.php'
if not local.exists():
    print(f'Нет файла {local}')
    sys.exit(1)

remote = '/www/promliz.com/admin/inc/config.php'

f = FTP_TLS('server123.hosting.reg.ru', timeout=30)
f.auth()
f.login('u3532223', os.environ['FTP_PASS'])
f.prot_p()
f.set_pasv(True)

with open(local, 'rb') as fh:
    f.storbinary(f'STOR {remote}', fh)
print(f'OK: {local.name} -> {remote}')

f.quit()
print('Теперь зайди https://promliz.com/admin/login.php')
print('  Логин: Admin')
print('  Пароль: 212346')
