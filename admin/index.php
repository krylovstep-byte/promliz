<?php
require_once __DIR__ . '/inc/bootstrap.php';
require_once __DIR__ . '/inc/auth.php';
require_auth();

$now = time();
$day = 86400;

$totalAll  = (int)db()->fetchValue('SELECT COUNT(*) FROM applications');
$totalWeek = (int)db()->fetchValue('SELECT COUNT(*) FROM applications WHERE created_at >= ?', [$now - 7 * $day]);
$newCount  = (int)db()->fetchValue("SELECT COUNT(*) FROM applications WHERE status = 'new'");

// График: заявок по дням за последние 30 дней.
$chartFrom = strtotime('today -29 days');
$rows = db()->fetchAll(
    "SELECT date(created_at, 'unixepoch', 'localtime') AS d, COUNT(*) AS n
     FROM applications
     WHERE created_at >= ?
     GROUP BY d",
    [$chartFrom]
);
$buckets = [];
for ($i = 0; $i < 30; $i++) {
    $key = date('Y-m-d', $chartFrom + $i * $day);
    $buckets[$key] = 0;
}
foreach ($rows as $r) {
    if (isset($buckets[$r['d']])) $buckets[$r['d']] = (int)$r['n'];
}
$chartValues = array_values($buckets);
$chartLabels = array_keys($buckets);
$chartMax = max(1, ...$chartValues);

$latest = db()->fetchAll(
    'SELECT id, created_at, name, phone, status, source_page
     FROM applications
     ORDER BY created_at DESC
     LIMIT 10'
);

$topPages = db()->fetchAll(
    "SELECT source_page, COUNT(*) AS n
     FROM applications
     WHERE created_at >= ? AND source_page IS NOT NULL AND source_page != ''
     GROUP BY source_page
     ORDER BY n DESC
     LIMIT 5",
    [$now - 30 * $day]
);

$page_title = 'Дашборд';
$nav = 'dashboard';
require __DIR__ . '/inc/header.php';
?>

<section class="dash-stats">
  <a class="stat stat--accent-blue" href="/admin/applications.php?status=new">
    <div class="stat__value"><?= $newCount ?></div>
    <div class="stat__label">Новых, ждут обработки</div>
  </a>
  <div class="stat stat--accent-orange">
    <div class="stat__value"><?= $totalWeek ?></div>
    <div class="stat__label">За 7 дней</div>
  </div>
  <div class="stat stat--muted">
    <div class="stat__value"><?= $totalAll ?></div>
    <div class="stat__label">Всего</div>
  </div>
</section>

<section class="card">
  <h2 class="card__title">Заявки за 30 дней</h2>
  <canvas id="dash-chart"
          width="900" height="220"
          data-values="<?= e(implode(',', $chartValues)) ?>"
          data-labels="<?= e(implode(',', $chartLabels)) ?>"
          data-max="<?= $chartMax ?>"></canvas>
</section>

<div class="dash-grid">
  <section class="card">
    <h2 class="card__title">Последние 10 заявок</h2>
    <?php if (!$latest): ?>
      <p class="empty">Пока пусто. Когда придёт первая заявка — увидите её здесь.</p>
    <?php else: ?>
      <table class="table table--compact">
        <thead>
          <tr><th>#</th><th>Когда</th><th>Имя</th><th>Телефон</th><th>Статус</th></tr>
        </thead>
        <tbody>
          <?php foreach ($latest as $r): ?>
            <tr data-href="/admin/application.php?id=<?= (int)$r['id'] ?>">
              <td>#<?= (int)$r['id'] ?></td>
              <td><?= e(fmt_dt((int)$r['created_at'])) ?></td>
              <td><?= e($r['name']) ?></td>
              <td><?= e(fmt_phone($r['phone'])) ?></td>
              <td><span class="badge badge--<?= e(status_color($r['status'])) ?>"><?= e(status_label($r['status'])) ?></span></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    <?php endif; ?>
  </section>

  <section class="card">
    <h2 class="card__title">Топ-страницы за 30 дней</h2>
    <?php if (!$topPages): ?>
      <p class="empty">Пока нет данных.</p>
    <?php else: ?>
      <ul class="top-pages">
        <?php foreach ($topPages as $p): ?>
          <li>
            <span class="top-pages__n"><?= (int)$p['n'] ?></span>
            <span class="top-pages__url" title="<?= e($p['source_page']) ?>"><?= e(trunc($p['source_page'], 50)) ?></span>
          </li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>
  </section>
</div>

<?php require __DIR__ . '/inc/footer.php'; ?>
