<?php
define('USER_ACCESS', true);
require_once 'db_connect.php';
header('Content-Type: application/json; charset=utf-8');

error_reporting(0);
ini_set('display_errors', 0);

try {
    $user_token = trim($_GET['user_token'] ?? '');

    if (empty($user_token)) {
        echo json_encode(['success' => false, 'message' => 'Неверный токен'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmt = $conn->prepare("SELECT id, car_make, state_number, status, created_at FROM requests WHERE user_token = ? ORDER BY created_at DESC");
    $stmt->bind_param('s', $user_token);
    $stmt->execute();
    $result = $stmt->get_result();

    $requests = [];
    while ($row = $result->fetch_assoc()) {
        $requests[] = $row;
    }

    echo json_encode(['success' => true, 'requests' => $requests], JSON_UNESCAPED_UNICODE);
    $stmt->close();
    $conn->close();

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Ошибка сервера'], JSON_UNESCAPED_UNICODE);
}
?>