<?php
require_once __DIR__ . '/inc/bootstrap.php';
require_once __DIR__ . '/inc/auth.php';
require_auth();

// Экспорт всегда учитывает фильтры (status, q) — те же, что в applications.php.
$status = (string)($_GET['status'] ?? '');
$q      = trim((string)($_GET['q'] ?? ''));
$format = (string)($_GET['format'] ?? '');

if ($format === 'csv') {
    export_csv($status, $q);
    exit;
}

$total = (int)db()->fetchValue('SELECT COUNT(*) FROM applications');

$page_title = 'Экспорт';
$nav = 'export';
require __DIR__ . '/inc/header.php';
?>

<div class="page-header">
  <h1 class="page-header__title">Экспорт заявок</h1>
</div>

<section class="card">
  <h2 class="card__title">Скачать CSV</h2>
  <p class="muted">Всего заявок в базе: <strong><?= $total ?></strong>. CSV открывается в Excel/Numbers/Google Sheets.</p>

  <form method="get" class="export-form">
    <input type="hidden" name="format" value="csv">
    <label class="field">
      <span class="field__label">Статус</span>
      <select name="status" class="field__input">
        <option value="">Все</option>
        <?php foreach (all_statuses() as $s): ?>
          <option value="<?= e($s) ?>"><?= e(status_label($s)) ?></option>
        <?php endforeach; ?>
      </select>
    </label>
    <label class="field">
      <span class="field__label">Поиск (имя, телефон, email, ИНН, комментарий)</span>
      <input type="text" name="q" class="field__input" placeholder="оставьте пустым, чтобы выгрузить всё">
    </label>
    <button type="submit" class="btn btn--primary">Скачать CSV</button>
  </form>
</section>

<?php require __DIR__ . '/inc/footer.php'; ?>

<?php

function export_csv(string $status, string $q): void
{
    $where = [];
    $params = [];

    if (in_array($status, all_statuses(), true)) {
        $where[] = 'status = ?';
        $params[] = $status;
    }
    if ($q !== '') {
        $where[] = '(name LIKE ? OR phone LIKE ? OR email LIKE ? OR inn LIKE ? OR comment LIKE ?)';
        $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%';
        array_push($params, $like, $like, $like, $like, $like);
    }
    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $filename = 'promliz-applications-' . date('Y-m-d_His') . '.csv';

    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"; filename*=UTF-8\'\'' . rawurlencode($filename));
    header('X-Content-Type-Options: nosniff');

    $out = fopen('php://output', 'w');
    // BOM — чтобы Excel сразу понял UTF-8.
    fwrite($out, "\xEF\xBB\xBF");

    fputcsv($out, [
        '#', 'Дата', 'Имя', 'Телефон', 'Email', 'ИНН', 'Комментарий',
        'Страница', 'IP', 'Статус', 'Обновлено',
    ], ';');

    $st = db()->pdo()->prepare(
        "SELECT * FROM applications $whereSql ORDER BY created_at DESC"
    );
    $st->execute($params);

    while ($r = $st->fetch()) {
        fputcsv($out, [
            $r['id'],
            fmt_dt((int)$r['created_at']),
            $r['name'],
            fmt_phone($r['phone']),
            $r['email'],
            $r['inn'],
            $r['comment'],
            $r['source_page'],
            $r['ip'],
            status_label($r['status']),
            $r['updated_at'] ? fmt_dt((int)$r['updated_at']) : '',
        ], ';');
    }

    fclose($out);
}
