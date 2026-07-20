<?php
define('ADMIN_AUTH', true);
require_once __DIR__ . '/admin_auth.php';
require_once 'db_connect.php';

header('Content-Type: application/json; charset=utf-8');

try {
    // 🧹 АВТОМАТИЧЕСКАЯ ОЧИСТКА: удаляем заявки старше 7 дней
    // Это выполняется фоном при каждом запросе списка, не нагружая сервер
    $conn->query("DELETE FROM requests WHERE created_at < NOW() - INTERVAL 7 DAY");

    // Получаем количество pending заявок
    $stmtCount = $conn->prepare("SELECT COUNT(*) as count FROM requests WHERE status = 'pending'");
    $stmtCount->execute();
    $count = $stmtCount->get_result()->fetch_assoc()['count'];
    $stmtCount->close();

    // Получаем сами заявки
    $stmt = $conn->prepare("SELECT id, car_make, state_number, driver_last_name, full_name_applicant, created_at FROM requests WHERE status = 'pending' ORDER BY created_at DESC LIMIT 50");
    $stmt->execute();
    $result = $stmt->get_result();

    $requests = [];
    while ($row = $result->fetch_assoc()) {
        $requests[] = $row;
    }
    $stmt->close();

    echo json_encode([
        'success' => true,
        'count' => $count,
        'requests' => $requests
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Ошибка сервера'], JSON_UNESCAPED_UNICODE);
}

$conn->close();
?>