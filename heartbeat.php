<?php
// heartbeat.php - продлевает сессию и синхронизирует CSRF-токен
define('ADMIN_AUTH', true);

// Сначала стартуем сессию, чтобы admin_auth.php мог с ней работать
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/admin_auth.php';

header('Content-Type: application/json; charset=utf-8');

// 1. Продлеваем время жизни сессии
$_SESSION['auth_last_activity'] = time();

// 2. Гарантируем наличие CSRF-токена в сессии
if (!isset($_SESSION['admin_csrf_token'])) {
    $_SESSION['admin_csrf_token'] = bin2hex(random_bytes(32));
}

// 3. Отдаем токен на фронтенд для синхронизации
echo json_encode([
    'success' => true,
    'csrf_token' => $_SESSION['admin_csrf_token']
]);
?>