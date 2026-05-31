<?php
require_once __DIR__ . '/inc/bootstrap.php';
require_once __DIR__ . '/inc/auth.php';
require_once __DIR__ . '/inc/csrf.php';

if (auth_is_logged_in()) {
    header('Location: /admin/');
    exit;
}

$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check($_POST['csrf'] ?? null)) {
        $error = 'Сессия истекла. Обновите страницу и попробуйте снова.';
    } elseif (auth_is_blocked(client_ip())) {
        $error = 'Слишком много попыток. Попробуйте через 30 минут.';
    } else {
        $login = trim((string)($_POST['login'] ?? ''));
        $pass  = (string)($_POST['password'] ?? '');
        if ($login === '' || $pass === '') {
            $error = 'Заполните логин и пароль.';
        } elseif (auth_check_login($login, $pass)) {
            header('Location: /admin/');
            exit;
        } else {
            $error = 'Неверный логин или пароль.';
            usleep(500_000);
        }
    }
}
?><!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Вход — Промлизинг</title>
  <link rel="stylesheet" href="/admin/assets/admin.css">
</head>
<body class="admin-body admin-body--login">
  <main class="login">
    <div class="login__card">
      <div class="login__brand">
        <span class="login__mark">ПЛ</span>
        <span class="login__title">Промлизинг<br><small>панель управления</small></span>
      </div>
      <?php if ($error): ?>
        <div class="login__error"><?= e($error) ?></div>
      <?php endif; ?>
      <form method="post" class="login__form" autocomplete="off">
        <?= csrf_field() ?>
        <label class="login__label">
          <span>Логин</span>
          <input type="text" name="login" required autofocus autocomplete="username">
        </label>
        <label class="login__label">
          <span>Пароль</span>
          <input type="password" name="password" required autocomplete="current-password">
        </label>
        <button type="submit" class="login__submit">Войти</button>
      </form>
    </div>
  </main>
</body>
</html>
