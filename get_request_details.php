<?php
require_once 'db_connect.php';
require_once 'helpers.php';
header('Content-Type: application/json');
define('ADMIN_AUTH', true);
require_once __DIR__ . '/admin_auth.php';

$id = intval($_GET['id'] ?? 0);
if ($id <= 0) {
    echo json_encode(['success' => false, 'message' => 'Неверный ID']);
    exit;
}

$stmt = $conn->prepare("SELECT * FROM requests WHERE id = ?");
$stmt->bind_param('i', $id);
$stmt->execute();
$result = $stmt->get_result();
$request = $result->fetch_assoc();

if (!$request) {
    echo json_encode(['success' => false, 'message' => 'Заявка не найдена']);
    exit;
}

// Форматируем даты и время
$request['entry_date'] = formatDate($request['entry_date']);
$request['out_date'] = formatDate($request['out_date']);
$request['entry_time'] = formatTime($request['entry_time']);
$request['out_time'] = formatTime($request['out_time']);

echo json_encode(['success' => true, 'request' => $request]);
$stmt->close();
$conn->close();
?>