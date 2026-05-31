<?php
/** @var string $page_title */
$page_title = $page_title ?? 'Админка';
$nav = $nav ?? '';
?><!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title><?= e($page_title) ?> — Промлизинг</title>
  <link rel="stylesheet" href="/admin/assets/admin.css?v=2">
</head>
<body class="admin-body">
<header class="admin-header">
  <div class="admin-header__inner">
    <a href="/admin/" class="admin-logo">
      <span class="admin-logo__mark">ПЛ</span>
      <span class="admin-logo__text">Промлизинг<br><small>админка</small></span>
    </a>
    <nav class="admin-nav">
      <a href="/admin/" class="admin-nav__link<?= $nav === 'dashboard' ? ' is-active' : '' ?>">Дашборд</a>
      <a href="/admin/applications.php" class="admin-nav__link<?= $nav === 'applications' ? ' is-active' : '' ?>">Заявки</a>
      <a href="/admin/export.php" class="admin-nav__link<?= $nav === 'export' ? ' is-active' : '' ?>">Экспорт</a>
    </nav>
    <div class="admin-user">
      <span class="admin-user__name"><?= e($_SESSION['admin']['login'] ?? '') ?></span>
      <a href="/admin/logout.php" class="admin-user__logout">Выйти</a>
    </div>
  </div>
</header>
<main class="admin-main">
