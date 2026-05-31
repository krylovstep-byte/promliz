#!/usr/bin/env python3
"""Утилита: посмотреть что куда залилось на FTP."""
import os
import sys
from ftplib import FTP_TLS

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = 'server123.hosting.reg.ru'
USER = os.environ.get('FTP_USER', 'u3532223')

ftps = FTP_TLS(HOST, timeout=30)
ftps.auth()
ftps.login(USER, os.environ['FTP_PASS'])
ftps.prot_p()

print(f'Подключен как {USER}')
print(f'pwd: {ftps.pwd()}')
print()

def walk(path, depth=0, max_depth=4):
    if depth > max_depth:
        return
    try:
        ftps.cwd(path)
    except Exception as e:
        print(f'{"  " * depth}❌ {path}: {e}')
        return
    items = []
    try:
        ftps.retrlines('LIST', items.append)
    except Exception as e:
        print(f'{"  " * depth}❌ LIST {path}: {e}')
        return
    print(f'{"  " * depth}📁 {path} ({len(items)} элементов)')
    for line in items[:30]:
        print(f'{"  " * depth}   {line}')
        # Парсим имя элемента из строки LIST (последний токен)
        parts = line.split()
        if len(parts) < 9:
            continue
        name = ' '.join(parts[8:])
        if name in ('.', '..'):
            continue
        # Папка?
        if line.startswith('d'):
            sub = (path.rstrip('/') + '/' + name) if path != '/' else '/' + name
            walk(sub, depth + 1, max_depth)

walk('/', 0, 3)
ftps.quit()
