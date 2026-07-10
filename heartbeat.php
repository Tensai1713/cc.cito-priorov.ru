<?php
// heartbeat.php - продлевает сессию администратора
define('ADMIN_AUTH', true);
require_once __DIR__ . '/admin_auth.php';

header('Content-Type: application/json; charset=utf-8');

if (isset($_SESSION['auth_user']) && $_SESSION['auth_user'] === true) {
    $_SESSION['auth_last_activity'] = time();
    echo json_encode(['success' => true]);
} else {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Не авторизован']);
}
?>