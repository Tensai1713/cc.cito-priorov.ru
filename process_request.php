<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

define('ADMIN_AUTH', true);
require_once __DIR__ . '/admin_auth.php';
require_once 'db_connect.php';

header('Content-Type: application/json; charset=utf-8');

if (!function_exists('get_real_ip')) {
    function get_real_ip() {
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Метод не поддерживается']);
    exit;
}

$id = intval($_POST['id'] ?? 0);
$action = $_POST['action'] ?? '';

if ($id <= 0 || !in_array($action, ['approve', 'reject'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Неверные параметры']);
    exit;
}

try {
    // Получаем данные заявки
    $stmt = $conn->prepare("SELECT * FROM requests WHERE id = ? AND status = 'pending'");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $result = $stmt->get_result();
    $request = $result->fetch_assoc();
    $stmt->close();

    if (!$request) {
        echo json_encode(['success' => false, 'message' => 'Заявка не найдена или уже обработана']);
        exit;
    }

    if ($action === 'approve') {
        // Правильная обработка чекбоксов
        $inspection = !empty($request['inspection']) ? intval($request['inspection']) : 0;
        $year_record = !empty($request['year_record']) ? intval($request['year_record']) : 0;

        // Приводим пустые строки к NULL
        $car_make = !empty($request['car_make']) ? $request['car_make'] : null;
        $state_number = !empty($request['state_number']) ? $request['state_number'] : null;
        $driver_last_name = !empty($request['driver_last_name']) ? $request['driver_last_name'] : null;
        $full_name_applicant = !empty($request['full_name_applicant']) ? $request['full_name_applicant'] : null;
        $entry_time = !empty($request['entry_time']) ? $request['entry_time'] : null;
        $out_time = !empty($request['out_time']) ? $request['out_time'] : null;
        $entry_date = !empty($request['entry_date']) ? $request['entry_date'] : null;
        $out_date = !empty($request['out_date']) ? $request['out_date'] : null;
        $comment = !empty($request['comment']) ? $request['comment'] : null;

        // Вставляем в основную таблицу
        $insert = $conn->prepare("INSERT INTO CarCheckpoint (car_make, state_number, driver_last_name, full_name_applicant, entry_time, out_time, entry_date, out_date, comment, inspection, year_record) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        
        $insert->bind_param(
            "sssssssssii",
            $car_make, $state_number, $driver_last_name, $full_name_applicant,
            $entry_time, $out_time, $entry_date, $out_date, $comment,
            $inspection, $year_record
        );

        if (!$insert->execute()) {
            throw new Exception('Ошибка вставки: ' . $insert->error);
        }
        
        $last_id = $insert->insert_id;
        $insert->close();

        // Обновляем статус заявки (без processed_at — возможно поля нет)
        $update = $conn->prepare("UPDATE requests SET status = 'approved' WHERE id = ?");
        $update->bind_param('i', $id);
        
        if (!$update->execute()) {
            throw new Exception('Ошибка обновления статуса: ' . $update->error);
        }
        $update->close();

        // Логирование (опционально)
        try {
            $check_table = $conn->query("SHOW TABLES LIKE 'logs'");
            if ($check_table && $check_table->num_rows > 0) {
                $log_stmt = $conn->prepare("INSERT INTO logs (record_id, action, ip_address, new_value) VALUES (?, ?, ?, ?)");
                $log_action = 'insert';
                $ip_address = get_real_ip();
                $new_value = "Одобрена заявка #$id: {$car_make}, {$state_number}, {$full_name_applicant}, Без досмотра: " . ($inspection ? 'Да' : 'Нет') . ", Годовая: " . ($year_record ? 'Да' : 'Нет');
                
                $log_stmt->bind_param("isss", $last_id, $log_action, $ip_address, $new_value);
                $log_stmt->execute();
                $log_stmt->close();
            }
        } catch (Exception $log_error) {
            // Игнорируем ошибки логирования
        }

        echo json_encode(['success' => true, 'message' => "Заявка одобрена и добавлена в таблицу"], JSON_UNESCAPED_UNICODE);

    } elseif ($action === 'reject') {
        // Отклоняем заявку
        $update = $conn->prepare("UPDATE requests SET status = 'rejected' WHERE id = ?");
        $update->bind_param('i', $id);
        
        if ($update->execute()) {
            $update->close();
            echo json_encode(['success' => true, 'message' => "Заявка отклонена"], JSON_UNESCAPED_UNICODE);
        } else {
            throw new Exception('Ошибка обновления: ' . $update->error);
        }
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка при обработке: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
} finally {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
}
?>