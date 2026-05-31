<?php
// admin/inc/bootstrap.php — общий init для всех страниц админки.
//
// Подгружает конфиг, ставит таймзону, заголовки безопасности,
// инициирует сессию. Подключается ОДНИМ require_once в начале каждого файла.

declare(strict_types=1);

if (defined('ADMIN_BOOTSTRAPPED')) return;
define('ADMIN_BOOTSTRAPPED', true);

// Конфиг. Если нет — отдаём понятную 500.
$config_file = __DIR__ . '/config.php';
if (!is_file($config_file)) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Админка не настроена: нет admin/inc/config.php.\n";
    echo "Скопируйте config.example.php → config.php и заполните.";
    exit;
}

$CONFIG = require $config_file;
if (!is_array($CONFIG)) {
    http_response_code(500);
    exit('Кривой config.php — должен возвращать массив.');
}
$GLOBALS['CONFIG'] = $CONFIG;

date_default_timezone_set($CONFIG['timezone'] ?? 'Europe/Moscow');

// Заголовки безопасности — ставим всегда, даже на API.
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
header("Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'");

// Сессии — только для страниц, не для API. API сам решит, нужна ли сессия.
function admin_start_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;

    $cfg = $GLOBALS['CONFIG'];
    session_name('promliz_admin');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/admin/',
        'secure'   => (bool)($cfg['cookie_secure'] ?? true),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/db.php';
