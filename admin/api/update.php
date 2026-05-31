<?php
// admin/api/update.php — AJAX: обновление статуса/заметки заявки.

declare(strict_types=1);

require_once __DIR__ . '/../inc/bootstrap.php';
require_once __DIR__ . '/../inc/auth.php';
require_once __DIR__ . '/../inc/csrf.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['success' => false, 'error' => 'method_not_allowed'], 405);
}

if (!auth_is_logged_in()) {
    json_response(['success' => false, 'error' => 'unauthorized'], 401);
}

if (!csrf_check($_POST['csrf'] ?? null)) {
    json_response(['success' => false, 'error' => 'csrf'], 403);
}

$id = (int)($_POST['id'] ?? 0);
if ($id <= 0) {
    json_response(['success' => false, 'error' => 'bad_id'], 400);
}

$row = db()->fetch('SELECT id FROM applications WHERE id = ?', [$id]);
if (!$row) {
    json_response(['success' => false, 'error' => 'not_found'], 404);
}

$update = ['updated_at' => time()];

if (array_key_exists('status', $_POST)) {
    $status = (string)$_POST['status'];
    if (!in_array($status, all_statuses(), true)) {
        json_response(['success' => false, 'error' => 'bad_status'], 400);
    }
    $update['status'] = $status;
}

// Поле admin_note удалено из UI. Если фронт-старый прислал — игнорим.

if (array_key_exists('delete', $_POST) && $_POST['delete'] === '1') {
    db()->exec('DELETE FROM applications WHERE id = ?', [$id]);
    json_response(['success' => true, 'deleted' => true]);
}

db()->update('applications', $update, 'id = :__id', ['__id' => $id]);

json_response(['success' => true]);
