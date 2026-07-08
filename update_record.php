<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

define('ADMIN_AUTH', true);
require_once __DIR__ . '/admin_auth.php';
require_once 'db_connect.php';

header('Content-Type: application/json; charset=utf-8');

// === Функция получения IP (если не определена) ===
if (!function_exists('get_real_ip')) {
    function get_real_ip() {
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Метод не поддерживается']);
    exit;
}

$id = intval($_POST['id'] ?? 0);
if ($id <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Неверный ID записи']);
    exit;
}

$car_make = trim($_POST['car_make'] ?? '');
$state_number = trim($_POST['state_number'] ?? '');
$driver_last_name = trim($_POST['driver_last_name'] ?? '');
$full_name_applicant = trim($_POST['full_name_applicant'] ?? '');
$entry_time = trim($_POST['entry_time'] ?? '');
$out_time = trim($_POST['out_time'] ?? '');
$entry_date = trim($_POST['entry_date'] ?? '');
$out_date = trim($_POST['out_date'] ?? '');
$comment = trim($_POST['comment'] ?? '');

$inspection = isset($_POST['inspection']) ? intval($_POST['inspection']) : 0;
$year_record = isset($_POST['year_record']) ? intval($_POST['year_record']) : 0;

// Проверка на пустоту
if (empty($car_make) && empty($state_number) && empty($driver_last_name) && 
    empty($full_name_applicant) && empty($comment) && empty($entry_date) && empty($out_date)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Пожалуйста, заполните хотя бы одно поле!']);
    exit;
}

// Приводим пустые строки к NULL
$car_make = $car_make !== '' ? $car_make : null;
$state_number = $state_number !== '' ? $state_number : null;
$driver_last_name = $driver_last_name !== '' ? $driver_last_name : null;
$full_name_applicant = $full_name_applicant !== '' ? $full_name_applicant : null;
$entry_time = $entry_time !== '' ? $entry_time : null;
$out_time = $out_time !== '' ? $out_time : null;
$entry_date = $entry_date !== '' ? $entry_date : null;
$out_date = $out_date !== '' ? $out_date : null;
$comment = $comment !== '' ? $comment : null;

try {
    $stmt = $conn->prepare("UPDATE CarCheckpoint SET car_make=?, state_number=?, driver_last_name=?, full_name_applicant=?, entry_time=?, out_time=?, entry_date=?, out_date=?, comment=?, inspection=?, year_record=? WHERE id=?");
    
    if (!$stmt) {
        throw new Exception('Ошибка подготовки запроса: ' . $conn->error);
    }
    
    // id в конце, поэтому "i" последним
    $stmt->bind_param("ssssssssssii", $car_make, $state_number, $driver_last_name, $full_name_applicant, $entry_time, $out_time, $entry_date, $out_date, $comment, $inspection, $year_record, $id);

    if ($stmt->execute()) {
        $stmt->close();
        
        // === ЛОГИРОВАНИЕ (опционально) ===
        try {
            $check_table = $conn->query("SHOW TABLES LIKE 'logs'");
            if ($check_table && $check_table->num_rows > 0) {
                $log_stmt = $conn->prepare("INSERT INTO logs (record_id, action, ip_address, new_value) VALUES (?, ?, ?, ?)");
                $action = 'update';
                $ip_address = get_real_ip();
                $new_value = "Марка: {$car_make}, Госномер: {$state_number}, Фамилия водителя: {$driver_last_name}, ФИО заявителя: {$full_name_applicant}, Время въезда: {$entry_time}, Время выезда: {$out_time}, Дата въезда: {$entry_date}, Дата выезда: {$out_date}, Комментарий: {$comment}, Без досмотра: {$inspection}, Годовая: {$year_record}";
                
                $log_stmt->bind_param("isss", $id, $action, $ip_address, $new_value);
                $log_stmt->execute();
                $log_stmt->close();
            }
        } catch (Exception $log_error) {
            error_log('Ошибка логирования update: ' . $log_error->getMessage());
        }

        echo json_encode(['success' => true, 'message' => 'Запись успешно обновлена!']);
    } else {
        throw new Exception($stmt->error);
    }

} catch (Exception $e) {
    error_log('Ошибка update_record.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка при обновлении: ' . $e->getMessage()]);
} finally {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
}
?>