<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

// 1. Запускаем сессию (ОБЯЗАТЕЛЬНО для чтения $_SESSION)
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// 2. Разрешаем доступ к БД для этого скрипта (обход проверки в db_connect.php)
define('USER_ACCESS', true);

// 3. Подключаем БД и хелперы
require_once 'db_connect.php';
require_once 'helpers.php';

header('Content-Type: application/json; charset=utf-8');

// === Функция получения IP ===
if (!function_exists('get_real_ip')) {
    function get_real_ip() {
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }
}

// === Функция конвертации даты ===
if (!function_exists('convertDateForDB')) {
    function convertDateForDB($date) {
        if (empty($date)) return null;
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return $date;
        }
        if (preg_match('/^(\d{2})\.(\d{2})\.(\d{4})$/', $date, $matches)) {
            return $matches[3] . '-' . $matches[2] . '-' . $matches[1];
        }
        return null;
    }
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    // 1. Получаем данные из формы
    $car_make = trim($_POST['carMake'] ?? '');
    $state_number = trim($_POST['stateNumber'] ?? '');
    $driver_last_name = trim($_POST['driverLastName'] ?? '');
    $entry_time = trim($_POST['entryTime'] ?? '');
    $out_time = trim($_POST['outTime'] ?? '');
    $entry_date_raw = trim($_POST['entryDate'] ?? '');
    $out_date_raw = trim($_POST['outDate'] ?? '');
    $comment = trim($_POST['comment'] ?? '');

    // 2. УМНАЯ ЛОГИКА ФИО:
    $full_name_applicant = trim($_POST['fullNameApplicant'] ?? '');
    if (empty($full_name_applicant)) {
        $full_name_applicant = trim($_SESSION['auth_full_name'] ?? '');
        if (empty($full_name_applicant)) {
            $full_name_applicant = trim($_SESSION['auth_login'] ?? 'Неизвестный пользователь');
        }
    }

    // 3. Конвертация дат
    $entry_date = convertDateForDB($entry_date_raw);
    $out_date = convertDateForDB($out_date_raw);

    // 4. Чекбоксы (строго в integer)
    $inspection = (int)($_POST['inspection'] ?? 0);
    $year_record = (int)($_POST['yearRecord'] ?? 0);

    // 5. Проверка на заполненность хотя бы одного поля (включая ФИО для надежности)
    if (empty($car_make) && empty($state_number) && empty($driver_last_name) && 
        empty($full_name_applicant) && empty($comment) && empty($entry_date_raw) && empty($out_date_raw)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Пожалуйста, заполните хотя бы одно поле!'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // 6. Приводим пустые строки к NULL для корректной записи в БД
    $car_make = $car_make !== '' ? $car_make : null;
    $state_number = $state_number !== '' ? $state_number : null;
    $driver_last_name = $driver_last_name !== '' ? $driver_last_name : null;
    $full_name_applicant = $full_name_applicant !== '' ? $full_name_applicant : null;
    $entry_time = $entry_time !== '' ? $entry_time : null;
    $out_time = $out_time !== '' ? $out_time : null;
    $comment = $comment !== '' ? $comment : null;

    // 7. Подготовка и выполнение запроса
    $stmt = $conn->prepare("INSERT INTO CarCheckpoint (car_make, state_number, driver_last_name, full_name_applicant, entry_time, out_time, entry_date, out_date, comment, inspection, year_record) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    
    if (!$stmt) {
        throw new Exception('Ошибка подготовки запроса: ' . $conn->error);
    }
    
    $stmt->bind_param("sssssssssii", $car_make, $state_number, $driver_last_name, $full_name_applicant, $entry_time, $out_time, $entry_date, $out_date, $comment, $inspection, $year_record);

    if ($stmt->execute()) {
        $last_id = $stmt->insert_id;
        $stmt->close();
        
        // === ЛОГИРОВАНИЕ ===
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
            error_log('Ошибка логирования insert: ' . $log_error->getMessage());
        }

        echo json_encode(['success' => true, 'message' => 'Новая запись успешно добавлена!'], JSON_UNESCAPED_UNICODE);
    } else {
        throw new Exception($stmt->error);
    }

} catch (Exception $e) {
    error_log('Ошибка record.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка при сохранении: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
} finally {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
}
?>