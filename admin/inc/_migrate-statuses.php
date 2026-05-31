<?php
// admin/inc/_migrate-statuses.php — ОДНОРАЗОВЫЙ скрипт миграции.
//
// Зачем: 2026-06 убрали статусы 'in_progress' и 'rejected'. Если в БД есть
// записи с этими статусами — переводим их в 'done' (Обработана).
//
// Запуск: открыть в браузере один раз https://promliz.com/admin/inc/_migrate-statuses.php
// После успешного запуска — УДАЛИТЬ этот файл с прода (через FTP).
//
// Требует логина в админку — анонимам недоступно.

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/auth.php';
require_auth();

header('Content-Type: text/plain; charset=utf-8');

$beforeIn  = (int)db()->fetchValue("SELECT COUNT(*) FROM applications WHERE status = 'in_progress'");
$beforeRej = (int)db()->fetchValue("SELECT COUNT(*) FROM applications WHERE status = 'rejected'");

$updated = db()->exec(
    "UPDATE applications SET status = 'done', updated_at = ? WHERE status IN ('in_progress', 'rejected')",
    [time()]
);

$afterIn  = (int)db()->fetchValue("SELECT COUNT(*) FROM applications WHERE status = 'in_progress'");
$afterRej = (int)db()->fetchValue("SELECT COUNT(*) FROM applications WHERE status = 'rejected'");

echo "OK\n";
echo "—\n";
echo "До миграции:\n";
echo "  in_progress: $beforeIn\n";
echo "  rejected:    $beforeRej\n";
echo "—\n";
echo "Обновлено строк: " . (int)$updated . "\n";
echo "—\n";
echo "После миграции:\n";
echo "  in_progress: $afterIn (должно быть 0)\n";
echo "  rejected:    $afterRej (должно быть 0)\n";
echo "—\n";
echo "ТЕПЕРЬ УДАЛИ ЭТОТ ФАЙЛ С ПРОДА: admin/inc/_migrate-statuses.php\n";
