<?php
// admin/inc/csrf.php — простые CSRF-токены на сессии.

declare(strict_types=1);

function csrf_token(): string
{
    admin_start_session();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_check(?string $token): bool
{
    admin_start_session();
    if (empty($_SESSION['csrf']) || !is_string($token)) return false;
    return hash_equals($_SESSION['csrf'], $token);
}

function csrf_field(): string
{
    return '<input type="hidden" name="csrf" value="' . htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8') . '">';
}
