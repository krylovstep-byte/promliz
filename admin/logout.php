<?php
require_once __DIR__ . '/inc/bootstrap.php';
require_once __DIR__ . '/inc/auth.php';

auth_logout();
header('Location: /admin/login.php');
exit;
