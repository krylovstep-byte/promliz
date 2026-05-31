<?php
require_once __DIR__ . '/inc/bootstrap.php';
require_once __DIR__ . '/inc/auth.php';
require_once __DIR__ . '/inc/csrf.php';
require_auth();

$id = (int)($_GET['id'] ?? 0);
$row = $id > 0 ? db()->fetch('SELECT * FROM applications WHERE id = ?', [$id]) : null;

if (!$row) {
    http_response_code(404);
    $page_title = 'Заявка не найдена';
    $nav = 'applications';
    require __DIR__ . '/inc/header.php';
    echo '<div class="card empty"><p>Такой заявки нет. <a href="/admin/applications.php">Назад к списку</a></p></div>';
    require __DIR__ . '/inc/footer.php';
    exit;
}

$page_title = 'Заявка #' . $id;
$nav = 'applications';
require __DIR__ . '/inc/header.php';
?>

<div class="page-header">
  <a href="/admin/applications.php" class="back-link">← Все заявки</a>
  <h1 class="page-header__title">Заявка #<?= (int)$row['id'] ?></h1>
  <span class="badge badge--lg badge--<?= e(status_color($row['status'])) ?>" id="app-status-badge"><?= e(status_label($row['status'])) ?></span>
</div>

<div class="app-grid">
  <section class="card">
    <h2 class="card__title">Контакт</h2>
    <dl class="fields">
      <dt>Имя</dt><dd class="strong"><?= e($row['name']) ?></dd>
      <dt>Телефон</dt><dd><a href="tel:<?= e(preg_replace('/\D+/', '', $row['phone'])) ?>"><?= e(fmt_phone($row['phone'])) ?></a></dd>
      <?php if ($row['email']): ?>
        <dt>Email</dt><dd><a href="mailto:<?= e($row['email']) ?>"><?= e($row['email']) ?></a></dd>
      <?php endif; ?>
      <?php if ($row['inn']): ?>
        <dt>ИНН</dt><dd><?= e($row['inn']) ?></dd>
      <?php endif; ?>
    </dl>

    <?php if ($row['comment']): ?>
      <h3 class="card__subtitle">Комментарий</h3>
      <div class="comment-block"><?= nl2br(e($row['comment'])) ?></div>
    <?php endif; ?>
  </section>

  <section class="card">
    <h2 class="card__title">Управление</h2>
    <form id="app-form" data-id="<?= (int)$row['id'] ?>">
      <?= csrf_field() ?>
      <label class="field">
        <span class="field__label">Статус</span>
        <select name="status" class="field__input">
          <?php foreach (all_statuses() as $s): ?>
            <option value="<?= e($s) ?>"<?= $s === $row['status'] ? ' selected' : '' ?>><?= e(status_label($s)) ?></option>
          <?php endforeach; ?>
        </select>
      </label>
      <div class="form-actions">
        <button type="submit" class="btn btn--primary">Сохранить</button>
        <span class="form-actions__hint" id="app-save-hint"></span>
        <button type="button" class="btn btn--danger" id="app-delete">Удалить заявку</button>
      </div>
    </form>
  </section>

  <section class="card card--muted">
    <h2 class="card__title">Метаданные</h2>
    <dl class="fields fields--muted">
      <dt>Создана</dt><dd><?= e(fmt_dt((int)$row['created_at'])) ?></dd>
      <?php if ($row['updated_at']): ?>
        <dt>Обновлена</dt><dd><?= e(fmt_dt((int)$row['updated_at'])) ?></dd>
      <?php endif; ?>
      <?php if ($row['source_page']): ?>
        <dt>Страница</dt><dd class="break-all"><a href="<?= e($row['source_page']) ?>" target="_blank" rel="noopener"><?= e($row['source_page']) ?></a></dd>
      <?php endif; ?>
      <?php if ($row['ip']): ?>
        <dt>IP</dt><dd><?= e($row['ip']) ?></dd>
      <?php endif; ?>
      <?php if ($row['user_agent']): ?>
        <dt>User-Agent</dt><dd class="break-all muted"><?= e($row['user_agent']) ?></dd>
      <?php endif; ?>
    </dl>
  </section>
</div>

<?php require __DIR__ . '/inc/footer.php'; ?>
