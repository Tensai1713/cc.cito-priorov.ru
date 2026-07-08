<?php
// 1. Сначала объявляем константу защиты для админки
define('ADMIN_AUTH', true);

// 2. Первым делом подключаем файл авторизации
require_once __DIR__ . '/admin_auth.php';

// 3. Только после этого подключаем базу данных и хелперы
require_once 'db_connect.php';
require_once 'helpers.php';

// Устанавливаем правильный заголовок JSON
header('Content-Type: application/json; charset=utf-8');

$id = intval($_GET['id'] ?? 0);
if ($id <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Неверный ID']);
    exit;
}

try {
    $stmt = $conn->prepare("SELECT * FROM requests WHERE id = ?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $result = $stmt->get_result();
    $request = $result->fetch_assoc();
    $stmt->close();

    if (!$request) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Заявка не найдена']);
        exit;
    }

    // Безопасно форматируем даты и время (только если они заполнены в БД)
    $request['entry_date'] = !empty($request['entry_date']) ? formatDate($request['entry_date']) : '';
    $request['out_date'] = !empty($request['out_date']) ? formatDate($request['out_date']) : '';
    $request['entry_time'] = !empty($request['entry_time']) ? formatTime($request['entry_time']) : '';
    $request['out_time'] = !empty($request['out_time']) ? formatTime($request['out_time']) : '';

    // Экранируем текстовые данные для защиты от XSS на фронтенде
    foreach ($request as $key => $value) {
        if (is_string($value)) {
            $request[$key] = htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
        }
    }

    echo json_encode(['success' => true, 'request' => $request]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Внутренняя ошибка сервера']);
} finally {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
}
?>
