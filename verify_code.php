<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json; charset=utf-8');

// 1. Проверка CSRF-токена
$receivedToken = $_POST['csrf_token'] ?? '';
$sessionToken = $_SESSION['csrf_token'] ?? '';

if ($receivedToken === '' || $receivedToken !== $sessionToken) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Ошибка безопасности (CSRF)']);
    exit;
}

// 2. Разрешаем доступ к БД
define('USER_ACCESS', true);
require_once 'db_connect.php';

$validCodes = require __DIR__ . '/codes.php';
$code = trim($_POST['code'] ?? '');

// 3. Проверка существования кода
if (!isset($validCodes[$code])) {
    echo json_encode(['success' => false, 'message' => 'Неверный код идентификации']);
    exit;
}

$fullName = $validCodes[$code];

// 4. ПРОВЕРКА: использован ли уже этот код в базе данных
$checkStmt = $conn->prepare("SELECT id FROM users WHERE registration_code = ?");
$checkStmt->bind_param("s", $code);
$checkStmt->execute();
$is_registered = $checkStmt->get_result()->num_rows > 0;
$checkStmt->close();

// 5. Возвращаем результат вместе с флагом занятости
echo json_encode([
    'success' => true,
    'full_name' => $fullName,
    'is_registered' => $is_registered // true, если код уже занят
]);

$conn->close();
?>