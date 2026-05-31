<?php
// Утилита: сгенерировать хэш пароля для config.php.
//
// Запуск из консоли:
//   php admin/inc/_make-hash.php "мой-пароль"
//
// Скопировать вывод в config.php → admin_password_hash.

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('CLI only');
}

if ($argc < 2) {
    fwrite(STDERR, "Использование: php _make-hash.php \"пароль\"\n");
    exit(1);
}

$password = $argv[1];
if (strlen($password) < 8) {
    fwrite(STDERR, "Пароль должен быть не короче 8 символов.\n");
    exit(1);
}

echo password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]), PHP_EOL;
