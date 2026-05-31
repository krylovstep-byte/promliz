#!/usr/bin/env python3
"""Утилита: залить один файл по FTP."""
import os, sys
from ftplib import FTP_TLS
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

if len(sys.argv) < 3:
    print("usage: ftp-upload-one.py <local> <remote>")
    sys.exit(1)

local, remote = sys.argv[1], sys.argv[2]

HOST = 'server123.hosting.reg.ru'
USER = os.environ.get('FTP_USER', 'u3532223')

ftps = FTP_TLS(HOST, timeout=30)
ftps.auth()
ftps.login(USER, os.environ['FTP_PASS'])
ftps.prot_p()

with open(local, 'rb') as fh:
    ftps.storbinary(f'STOR {remote}', fh)
print(f"OK {local} -> {remote}")
ftps.quit()
