<?php
require_once 'db_connect.php';
header('Content-Type: application/json');

$user_token = trim($_GET['user_token'] ?? '');
if (empty($user_token)) {
    echo json_encode(['success' => false, 'message' => 'Неверный токен']);
    exit;
}

$query = "SELECT id, status, created_at, updated_at FROM requests WHERE user_token = ? ORDER BY created_at DESC LIMIT 10";
$stmt = $conn->prepare($query);
$stmt->bind_param('s', $user_token);
$stmt->execute();
$result = $stmt->get_result();

$requests = [];
while ($row = $result->fetch_assoc()) {
    $requests[] = $row;
}

echo json_encode(['success' => true, 'requests' => $requests]);
$stmt->close();
$conn->close();
?>