<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

define('ADMIN_AUTH', true);
require_once __DIR__ . '/admin_auth.php';
require_once 'db_connect.php';

require_once 'allowed_ips.php';

// Проверка IP перед удалением
if (!canDelete()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'У вас нет прав для удаления записей']);
    exit;
}

header('Content-Type: application/json; charset=utf-8');

// === Функция получения IP (если не определена в admin_auth.php) ===
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
if ($id <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Некорректный идентификатор записи']);
    exit;
}

try {
    // Получаем данные записи перед удалением (для лога)
    $stmtSelect = $conn->prepare("SELECT * FROM CarCheckpoint WHERE id = ?");
    $stmtSelect->bind_param('i', $id);
    $stmtSelect->execute();
    $result = $stmtSelect->get_result();
    $record = $result->fetch_assoc();
    $stmtSelect->close();

    if (!$record) {
        echo json_encode(['success' => false, 'message' => 'Запись не найдена']);
        exit;
    }

    // Удаляем запись
    $stmt = $conn->prepare("DELETE FROM CarCheckpoint WHERE id = ?");
    $stmt->bind_param('i', $id);
    
    if ($stmt->execute()) {
        $stmt->close();
        
        // === ЛОГИРОВАНИЕ (опционально) ===
        try {
            // Проверяем, существует ли таблица logs
            $check_table = $conn->query("SHOW TABLES LIKE 'logs'");
            if ($check_table && $check_table->num_rows > 0) {
                $log_stmt = $conn->prepare("INSERT INTO logs (record_id, action, ip_address, old_value) VALUES (?, ?, ?, ?)");
                $action = 'delete';
                $ip_address = get_real_ip();

                $old_value = "Марка: {$record['car_make']}, Госномер: {$record['state_number']}, Фамилия водителя: {$record['driver_last_name']}, ФИО заявителя: {$record['full_name_applicant']}, Время въезда: {$record['entry_time']}, Время выезда: {$record['out_time']}, Дата въезда: {$record['entry_date']}, Дата выезда: {$record['out_date']}, Комментарий: {$record['comment']}, Без досмотра: {$record['inspection']}, Годовая: {$record['year_record']}";

                $log_stmt->bind_param("isss", $id, $action, $ip_address, $old_value);
                $log_stmt->execute();
                $log_stmt->close();
            }
        } catch (Exception $log_error) {
            // Если логирование упало — не прерываем удаление
            error_log('Ошибка логирования delete: ' . $log_error->getMessage());
        }

        echo json_encode(['success' => true, 'message' => 'Запись успешно удалена']);
    } else {
        throw new Exception($stmt->error);
    }

} catch (Exception $e) {
    error_log('Ошибка delete_record.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка при удалении: ' . $e->getMessage()]);
} finally {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
}
?>