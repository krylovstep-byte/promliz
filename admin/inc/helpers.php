<?php
// admin/inc/helpers.php — мелочи: эскейп, форматирование, json-ответы.

declare(strict_types=1);

function e(?string $s): string
{
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function json_response(array $data, int $code = 200): never
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function client_ip(): string
{
    // На REG.RU фронта-прокси нет, REMOTE_ADDR — нормально.
    return (string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}

function fmt_dt(?int $ts): string
{
    if (!$ts) return '—';
    return date('d.m.Y H:i', $ts);
}

function fmt_phone(?string $raw): string
{
    $d = preg_replace('/\D+/', '', (string)$raw);
    if (strlen($d) !== 11) return (string)$raw;
    return '+7 (' . substr($d, 1, 3) . ') ' . substr($d, 4, 3) . '-' . substr($d, 7, 2) . '-' . substr($d, 9, 2);
}

function status_label(string $s): string
{
    return match ($s) {
        'new'  => 'Новая',
        'done' => 'Обработана',
        // Legacy-статусы (in_progress, rejected) могут встретиться до миграции —
        // показываем как «Обработана», чтобы UI не падал
        'in_progress', 'rejected' => 'Обработана',
        default => $s,
    };
}

function status_color(string $s): string
{
    return match ($s) {
        'new'  => 'blue',
        'done', 'in_progress', 'rejected' => 'green',
        default => 'gray',
    };
}

function all_statuses(): array
{
    // Активный список — только эти два. Используется для chip-фильтров,
    // селектов в формах и whitelist в /admin/api/update.php.
    return ['new', 'done'];
}

function validate_phone(string $raw): bool
{
    return strlen(preg_replace('/\D+/', '', $raw)) === 11;
}

function validate_email(string $raw): bool
{
    return $raw === '' || filter_var($raw, FILTER_VALIDATE_EMAIL) !== false;
}

function validate_inn(string $raw): bool
{
    if ($raw === '') return true;
    $d = preg_replace('/\D+/', '', $raw);
    return strlen($d) === 10 || strlen($d) === 12;
}

function trunc(?string $s, int $n = 60): string
{
    $s = (string)$s;
    if (mb_strlen($s) <= $n) return $s;
    return mb_substr($s, 0, $n - 1) . '…';
}

function url_with(array $overrides): string
{
    $q = $_GET;
    foreach ($overrides as $k => $v) {
        if ($v === null) unset($q[$k]);
        else $q[$k] = $v;
    }
    return strtok($_SERVER['REQUEST_URI'], '?') . ($q ? '?' . http_build_query($q) : '');
}
