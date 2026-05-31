<?php
// admin/api/submit.php — приём заявки с формы сайта.
//
// Принимает POST application/x-www-form-urlencoded или multipart/form-data.
// Поля: name, phone, email, inn, comment, botcheck (honeypot).
// Доп. поля (опционально): source_page.
//
// Ответ: JSON {success: true} или {success: false, error: '...'}

declare(strict_types=1);

require_once __DIR__ . '/../inc/bootstrap.php';

$cfg = $GLOBALS['CONFIG'];

// CORS
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = $cfg['allowed_origins'] ?? [];
if ($origin && in_array($origin, $allowed, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['success' => false, 'error' => 'method_not_allowed'], 405);
}

// Honeypot — если бот пихнул что-то в скрытое поле, тихо ОК.
if (!empty(trim((string)($_POST['botcheck'] ?? '')))) {
    json_response(['success' => true]);
}

// Rate-limit по IP: не больше 5 заявок за 10 минут с одного IP.
$ip = client_ip();
$since = time() - 600;
$recent = (int)db()->fetchValue(
    'SELECT COUNT(*) FROM applications WHERE ip = ? AND created_at > ?',
    [$ip, $since]
);
if ($recent >= 5) {
    json_response(['success' => false, 'error' => 'rate_limited'], 429);
}

// Поля
$name    = trim((string)($_POST['name']    ?? ''));
$phone   = trim((string)($_POST['phone']   ?? ''));
$email   = trim((string)($_POST['email']   ?? ''));
$inn     = trim((string)($_POST['inn']     ?? ''));
$comment = trim((string)($_POST['comment'] ?? ''));

// Жёсткие лимиты длины — защита от мусора в БД.
foreach (['name' => 100, 'phone' => 30, 'email' => 100, 'inn' => 20, 'comment' => 2000] as $k => $max) {
    if (mb_strlen($$k) > $max) {
        json_response(['success' => false, 'error' => "too_long:$k"], 400);
    }
}

// Валидация
$errors = [];
if ($name === '')              $errors['name']  = 'required';
if (!validate_phone($phone))   $errors['phone'] = 'invalid';
if (!validate_email($email))   $errors['email'] = 'invalid';
if (!validate_inn($inn))       $errors['inn']   = 'invalid';

if ($errors) {
    json_response(['success' => false, 'error' => 'validation', 'fields' => $errors], 400);
}

// Source page: берём из POST или referer
$source = (string)($_POST['source_page'] ?? $_SERVER['HTTP_REFERER'] ?? '');
$ua     = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');

$now = time();
$id = db()->insert('applications', [
    'created_at'  => $now,
    'name'        => $name,
    'phone'       => $phone,
    'email'       => $email !== '' ? $email : null,
    'inn'         => $inn   !== '' ? $inn   : null,
    'comment'     => $comment !== '' ? $comment : null,
    'source_page' => mb_substr($source, 0, 500),
    'user_agent'  => mb_substr($ua, 0, 500),
    'ip'          => $ip,
    'status'      => 'new',
    'updated_at'  => $now,
]);

// Уведомление на почту. Падение почты не должно ломать запись заявки.
$notify = trim((string)($cfg['notify_email'] ?? ''));
if ($notify !== '') {
    try {
        send_notification_email($notify, (string)$cfg['notify_from'], $id, [
            'name'    => $name,
            'phone'   => $phone,
            'email'   => $email,
            'inn'     => $inn,
            'comment' => $comment,
            'source'  => $source,
        ]);
    } catch (Throwable $e) {
        error_log('[promliz/admin] notify failed: ' . $e->getMessage());
    }
}

json_response(['success' => true, 'id' => $id]);


function send_notification_email(string $to, string $from, int $id, array $data): void
{
    $subject = '=?UTF-8?B?' . base64_encode("Новая заявка #$id — Промлизинг") . '?=';

    $body = "Новая заявка с сайта promliz.com\n\n";
    $body .= "ID:         $id\n";
    $body .= "Дата:       " . date('d.m.Y H:i') . "\n";
    $body .= "Имя:        {$data['name']}\n";
    $body .= "Телефон:    {$data['phone']}\n";
    if ($data['email'] !== '')   $body .= "Email:      {$data['email']}\n";
    if ($data['inn']   !== '')   $body .= "ИНН:        {$data['inn']}\n";
    if ($data['comment'] !== '') $body .= "\nКомментарий:\n{$data['comment']}\n";
    if ($data['source'] !== '')  $body .= "\nСтраница:   {$data['source']}\n";
    $body .= "\nПосмотреть: https://promliz.com/admin/application.php?id=$id\n";

    $headers = [
        'From: Промлизинг <' . $from . '>',
        'Reply-To: ' . ($data['email'] !== '' ? $data['email'] : $from),
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'X-Mailer: promliz/admin',
    ];

    @mail($to, $subject, $body, implode("\r\n", $headers));
}
