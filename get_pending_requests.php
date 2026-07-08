<?php
// 1. Сначала объявляем константу защиты для админки
define('ADMIN_AUTH', true);

// 2. Первым делом подключаем файл авторизации
require_once __DIR__ . '/admin_auth.php';

// 3. Только после этого подключаем базу данных
require_once 'db_connect.php';

// Устанавливаем заголовок JSON
header('Content-Type: application/json; charset=utf-8');

try {
    $query = "SELECT id, car_make, state_number, driver_last_name, full_name_applicant, entry_date, created_at FROM requests WHERE status = 'pending' ORDER BY created_at DESC";
    $result = $conn->query($query);

    $requests = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            // Экранируем все строковые данные для безопасного вывода в JS/HTML
            foreach ($row as $key => $value) {
                if (is_string($value)) {
                    $row[$key] = htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
                }
            }
            $requests[] = $row;
        }
        $result->close();
    }

    echo json_encode(['success' => true, 'requests' => $requests, 'count' => count($requests)]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка при получении списка заявок']);
} finally {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
}
?>
