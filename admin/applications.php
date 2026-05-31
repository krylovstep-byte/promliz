<?php
require_once __DIR__ . '/inc/bootstrap.php';
require_once __DIR__ . '/inc/auth.php';
require_auth();

$status = (string)($_GET['status'] ?? '');
$q      = trim((string)($_GET['q'] ?? ''));
$page   = max(1, (int)($_GET['page'] ?? 1));
$per    = 25;
$sort   = (string)($_GET['sort'] ?? 'created_at');
$dir    = strtolower((string)($_GET['dir'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';

$allowedSort = ['created_at', 'name', 'status', 'id'];
if (!in_array($sort, $allowedSort, true)) $sort = 'created_at';

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

$whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

$total = (int)db()->fetchValue("SELECT COUNT(*) FROM applications $whereSql", $params);
$pages = max(1, (int)ceil($total / $per));
if ($page > $pages) $page = $pages;
$offset = ($page - 1) * $per;

$list = db()->fetchAll(
    "SELECT id, created_at, name, phone, email, inn, comment, status
     FROM applications
     $whereSql
     ORDER BY $sort $dir
     LIMIT $per OFFSET $offset",
    $params
);

$page_title = 'Заявки';
$nav = 'applications';
require __DIR__ . '/inc/header.php';
?>

<div class="page-header">
  <h1 class="page-header__title">Заявки <span class="page-header__count"><?= $total ?></span></h1>
</div>

<form class="filters" method="get">
  <input type="text" name="q" value="<?= e($q) ?>" placeholder="Поиск: имя, телефон, email, ИНН, комментарий" class="filters__search">
  <div class="filters__chips">
    <a href="<?= e(url_with(['status' => null, 'page' => null])) ?>" class="chip<?= $status === '' ? ' is-active' : '' ?>">Все</a>
    <?php foreach (all_statuses() as $s): ?>
      <a href="<?= e(url_with(['status' => $s, 'page' => null])) ?>" class="chip chip--<?= e(status_color($s)) ?><?= $status === $s ? ' is-active' : '' ?>"><?= e(status_label($s)) ?></a>
    <?php endforeach; ?>
  </div>
  <button type="submit" class="filters__apply">Найти</button>
  <?php if ($q !== '' || $status !== ''): ?>
    <a href="/admin/applications.php" class="filters__reset">Сбросить</a>
  <?php endif; ?>
</form>

<?php if (!$list): ?>
  <div class="empty card">
    <p>По текущим фильтрам ничего не найдено.</p>
  </div>
<?php else: ?>
  <div class="card card--no-pad">
    <table class="table">
      <thead>
        <tr>
          <th><a href="<?= e(url_with(['sort' => 'id', 'dir' => $sort === 'id' && $dir === 'desc' ? 'asc' : 'desc'])) ?>">#</a></th>
          <th><a href="<?= e(url_with(['sort' => 'created_at', 'dir' => $sort === 'created_at' && $dir === 'desc' ? 'asc' : 'desc'])) ?>">Когда</a></th>
          <th><a href="<?= e(url_with(['sort' => 'name', 'dir' => $sort === 'name' && $dir === 'desc' ? 'asc' : 'desc'])) ?>">Имя</a></th>
          <th>Телефон</th>
          <th>Email / ИНН</th>
          <th>Комментарий</th>
          <th><a href="<?= e(url_with(['sort' => 'status', 'dir' => $sort === 'status' && $dir === 'desc' ? 'asc' : 'desc'])) ?>">Статус</a></th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($list as $r): ?>
          <tr class="table__row" data-href="/admin/application.php?id=<?= (int)$r['id'] ?>">
            <td>#<?= (int)$r['id'] ?></td>
            <td><?= e(fmt_dt((int)$r['created_at'])) ?></td>
            <td class="strong"><?= e($r['name']) ?></td>
            <td><a href="tel:<?= e(preg_replace('/\D+/', '', (string)$r['phone'])) ?>" data-no-row-click><?= e(fmt_phone($r['phone'])) ?></a></td>
            <td class="muted">
              <?php if ($r['email']): ?><div><?= e($r['email']) ?></div><?php endif; ?>
              <?php if ($r['inn']): ?><div>ИНН <?= e($r['inn']) ?></div><?php endif; ?>
            </td>
            <td class="comment-cell"><?= e(trunc($r['comment'], 80)) ?></td>
            <td><span class="badge badge--<?= e(status_color($r['status'])) ?>"><?= e(status_label($r['status'])) ?></span></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>

  <?php if ($pages > 1): ?>
    <nav class="pager">
      <?php if ($page > 1): ?>
        <a href="<?= e(url_with(['page' => $page - 1])) ?>" class="pager__btn">← Назад</a>
      <?php endif; ?>
      <span class="pager__info">Страница <?= $page ?> из <?= $pages ?></span>
      <?php if ($page < $pages): ?>
        <a href="<?= e(url_with(['page' => $page + 1])) ?>" class="pager__btn">Вперёд →</a>
      <?php endif; ?>
    </nav>
  <?php endif; ?>
<?php endif; ?>

<?php require __DIR__ . '/inc/footer.php'; ?>
