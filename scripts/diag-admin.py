#!/usr/bin/env python3
"""
Диагностика админки на REG.RU.

Что делает:
1. Заливает простой test.php в /www/promliz.com/admin/ — проверим работает ли PHP в этой папке.
2. Переименовывает admin/.htaccess → admin/.htaccess.bak — на случай если он мешает.

Запуск:
  $env:FTP_PASS='пароль'; python3 scripts/diag-admin.py
"""

import os
import sys
import io
from ftplib import FTP_TLS

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

if not os.environ.get('FTP_PASS'):
    print('Нет FTP_PASS. Запусти: $env:FTP_PASS=\'пароль\'; python3 scripts/diag-admin.py')
    sys.exit(1)

f = FTP_TLS('server123.hosting.reg.ru', timeout=30)
f.auth()
f.login('u3532223', os.environ['FTP_PASS'])
f.prot_p()
f.set_pasv(True)

# 1. Заливаем простой test.php
content = b'<?php echo "PHP_WORKS"; ?>'
try:
    f.storbinary('STOR /www/promliz.com/admin/test.php', io.BytesIO(content))
    print('OK: admin/test.php залит')
except Exception as e:
    print(f'FAIL test.php: {e}')

# 2. Также заливаем в корень — проверим работает ли там PHP вообще
try:
    f.storbinary('STOR /www/promliz.com/test-root.php', io.BytesIO(content))
    print('OK: test-root.php залит в корень')
except Exception as e:
    print(f'FAIL test-root.php: {e}')

# 3. Переименуем admin/.htaccess в .bak
try:
    f.rename('/www/promliz.com/admin/.htaccess', '/www/promliz.com/admin/.htaccess.bak')
    print('OK: admin/.htaccess -> .htaccess.bak')
except Exception as e:
    print(f'rename .htaccess: {e}')

f.quit()
print('Готово. Открой в браузере:')
print('  https://promliz.com/admin/test.php')
print('  https://promliz.com/test-root.php')
print('  https://promliz.com/admin/login.php')
