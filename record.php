<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

define('ADMIN_AUTH', true);
require_once __DIR__ . '/admin_auth.php';
require_once 'db_connect.php';

header('Content-Type: application/json; charset=utf-8');

// === Функция получения IP (если не определена в admin_auth.php) ===
if (!function_exists('get_real_ip')) {
    function get_real_ip() {
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }
}

// Конвертация DD.MM.YYYY → YYYY-MM-DD
function convertDateForDB($date) {
    if (empty($date)) return null;
    
    // Если уже в формате YYYY-MM-DD
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        return $date;
    }
    
    // Если в формате DD.MM.YYYY
    if (preg_match('/^(\d{2})\.(\d{2})\.(\d{4})$/', $date, $matches)) {
        return $matches[3] . '-' . $matches[2] . '-' . $matches[1];
    }
    
    return null;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Метод не поддерживается']);
    exit;
}

$car_make = trim($_POST['carMake'] ?? '');
$state_number = trim($_POST['stateNumber'] ?? '');
$driver_last_name = trim($_POST['driverLastName'] ?? '');
$full_name_applicant = trim($_POST['fullNameApplicant'] ?? '');
$entry_time = trim($_POST['entryTime'] ?? '');
$out_time = trim($_POST['outTime'] ?? '');
$entry_date = trim($_POST['entryDate'] ?? '');
$out_date = trim($_POST['outDate'] ?? '');
$comment = trim($_POST['comment'] ?? '');

$inspection = isset($_POST['inspection']) ? 1 : 0;
$year_record = isset($_POST['yearRecord']) ? 1 : 0;

if (empty($car_make) && empty($state_number) && empty($driver_last_name) && 
    empty($full_name_applicant) && empty($comment) && empty($entry_date) && empty($out_date)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Пожалуйста, заполните хотя бы одно поле!']);
    exit;
}

// ✅ КОНВЕРТАЦИЯ ДАТ ИЗ DD.MM.YYYY В YYYY-MM-DD
$entry_date = convertDateForDB($entry_date);
$out_date = convertDateForDB($out_date);

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
    $stmt = $conn->prepare("INSERT INTO CarCheckpoint (car_make, state_number, driver_last_name, full_name_applicant, entry_time, out_time, entry_date, out_date, comment, inspection, year_record) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    
    $stmt->bind_param("sssssssssii", $car_make, $state_number, $driver_last_name, $full_name_applicant, $entry_time, $out_time, $entry_date, $out_date, $comment, $inspection, $year_record);

    if ($stmt->execute()) {
        $last_id = $stmt->insert_id;
        $stmt->close();
        
        // === ЛОГИРОВАНИЕ (опционально) ===
        try {
            $check_table = $conn->query("SHOW TABLES LIKE 'logs'");
            if ($check_table && $check_table->num_rows > 0) {
                $log_stmt = $conn->prepare("INSERT INTO logs (record_id, action, ip_address, new_value) VALUES (?, ?, ?, ?)");
                $action = 'insert';
                $ip_address = get_real_ip();
                $new_value = "Марка: {$car_make}, Госномер: {$state_number}, Фамилия водителя: {$driver_last_name}, ФИО заявителя: {$full_name_applicant}, Время въезда: {$entry_time}, Время выезда: {$out_time}, Дата въезда: {$entry_date}, Дата выезда: {$out_date}, Комментарий: {$comment}, Без досмотра: {$inspection}, Годовая: {$year_record}";
                
                $log_stmt->bind_param("isss", $last_id, $action, $ip_address, $new_value);
                $log_stmt->execute();
                $log_stmt->close();
            }
        } catch (Exception $log_error) {
            error_log('Ошибка логирования: ' . $log_error->getMessage());
        }

        echo json_encode(['success' => true, 'message' => 'Новая запись успешно добавлена!']);
    } else {
        throw new Exception($stmt->error);
    }

} catch (Exception $e) {
    error_log('Ошибка record.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка при сохранении: ' . $e->getMessage()]);
} finally {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
}
?>