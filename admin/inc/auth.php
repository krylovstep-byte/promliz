<?php
// admin/inc/auth.php — login/logout/require_auth + rate-limit логина.

declare(strict_types=1);

function auth_check_login(string $login, string $password): bool
{
    $cfg = $GLOBALS['CONFIG'];
    $ip = client_ip();

    if (auth_is_blocked($ip)) return false;

    $okLogin = hash_equals((string)$cfg['admin_username'], $login);
    $okPass  = password_verify($password, (string)$cfg['admin_password_hash']);
    $ok      = $okLogin && $okPass;

    db()->insert('login_attempts', [
        'ip'      => $ip,
        'ts'      => time(),
        'success' => $ok ? 1 : 0,
    ]);

    // Чистка старых записей чтобы таблица не пухла. Храним 2 часа — больше
    // для rate-limit (30 мин окно) не нужно.
    db()->exec('DELETE FROM login_attempts WHERE ts < ?', [time() - 7200]);

    if ($ok) {
        admin_start_session();
        session_regenerate_id(true);
        $_SESSION['admin'] = [
            'login'    => $login,
            'since'    => time(),
            'ua_hash'  => hash('sha256', (string)($_SERVER['HTTP_USER_AGENT'] ?? '')),
        ];
    }

    return $ok;
}

function auth_logout(): void
{
    admin_start_session();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}

function auth_is_logged_in(): bool
{
    admin_start_session();
    if (empty($_SESSION['admin']['login'])) return false;
    // Привязка к UA — простая защита от угона куки.
    $ua = hash('sha256', (string)($_SERVER['HTTP_USER_AGENT'] ?? ''));
    if (!hash_equals($_SESSION['admin']['ua_hash'] ?? '', $ua)) {
        auth_logout();
        return false;
    }
    return true;
}

function require_auth(): void
{
    if (!auth_is_logged_in()) {
        header('Location: /admin/login.php');
        exit;
    }
}

function auth_is_blocked(string $ip): bool
{
    // 5 неудачных за 15 мин → блок на 30 мин.
    $since = time() - 1800;
    $row = db()->fetch(
        'SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND ts > ? AND success = 0',
        [$ip, $since]
    );
    return ($row['n'] ?? 0) >= 5;
}
