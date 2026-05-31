#!/usr/bin/env python3
"""
Сбрасывает rate-limit на логин админки.

Что делает:
1. Скачивает /www/promliz.com/data/orders.sqlite во временный файл
2. Делает DELETE FROM login_attempts (если таблица есть)
3. Заливает БД обратно на сервер

Запуск:
  $env:FTP_PASS='FTP_пароль_от_REGRU'; python3 scripts/reset-login-limit.py
"""

import os
import sys
import sqlite3
import tempfile
from pathlib import Path
from ftplib import FTP_TLS

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

if not os.environ.get('FTP_PASS'):
    print('Нет FTP_PASS')
    sys.exit(1)

REMOTE = '/www/promliz.com/data/orders.sqlite'

# Временный файл для БД
tmp = Path(tempfile.gettempdir()) / 'orders-reset.sqlite'
if tmp.exists():
    tmp.unlink()

f = FTP_TLS('server123.hosting.reg.ru', timeout=30)
f.auth()
f.login('u3532223', os.environ['FTP_PASS'])
f.prot_p()
f.set_pasv(True)

# 1. Скачиваем
print(f'Скачиваю {REMOTE}...')
try:
    with open(tmp, 'wb') as fh:
        f.retrbinary(f'RETR {REMOTE}', fh.write)
    size = tmp.stat().st_size
    print(f'OK: скачано {size} байт во временный файл')
except Exception as e:
    print(f'FAIL: {e}')
    print('Возможно БД ещё не создана (не было заявок). Тогда и rate-limit нет.')
    print('Проверь админку — может уже разблокировалось.')
    f.quit()
    sys.exit(1)

# 2. Чистим
conn = sqlite3.connect(str(tmp))
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='login_attempts'")
if not cur.fetchone():
    print('Таблицы login_attempts нет — нечего чистить')
    conn.close()
    f.quit()
    sys.exit(0)

cur.execute('SELECT COUNT(*) FROM login_attempts')
before = cur.fetchone()[0]
cur.execute('DELETE FROM login_attempts')
conn.commit()
cur.execute('VACUUM')
conn.close()
print(f'OK: удалено {before} записей из login_attempts')

# 3. Заливаем обратно
print(f'Заливаю обратно {REMOTE}...')
with open(tmp, 'rb') as fh:
    f.storbinary(f'STOR {REMOTE}', fh)
print('OK: БД залита')

f.quit()

# Уборка
try:
    tmp.unlink()
except Exception:
    pass

print()
print('Готово! Заходи в админку:')
print('  https://promliz.com/admin/login.php')
print('  Логин:  Admin')
print('  Пароль: ABcd212346212346')
