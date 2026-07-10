<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

define('USER_ACCESS', true);
require_once 'db_connect.php';
require_once 'helpers.php';

header('Content-Type: application/json; charset=utf-8');

// Функция конвертации даты
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

try {
    $user_token = trim($_POST['user_token'] ?? 'anonymous');

    $car_make = trim($_POST['carMake'] ?? '');
    $state_number = trim($_POST['stateNumber'] ?? '');
    $driver_last_name = trim($_POST['driverLastName'] ?? '');
    $full_name_applicant = trim($_POST['fullNameApplicant'] ?? '');
    $entry_time = trim($_POST['entryTime'] ?? '');
    $out_time = trim($_POST['outTime'] ?? '');
    
    // ✅ ОТЛАДКА: логируем ВСЕ POST данные
    error_log("=== submit_request.php ===");
    error_log("POST данные: " . print_r($_POST, true));
    
    $entry_date_raw = trim($_POST['entryDate'] ?? '');
    $out_date_raw = trim($_POST['outDate'] ?? '');
    
    error_log("entry_date_raw: '$entry_date_raw'");
    error_log("out_date_raw: '$out_date_raw'");
    
    $entry_date = convertDateForDB($entry_date_raw);
    $out_date = convertDateForDB($out_date_raw);
    
    error_log("entry_date (после конвертации): '$entry_date'");
    error_log("out_date (после конвертации): '$out_date'");
    
    $comment = trim($_POST['comment'] ?? '');
    
    $inspection = isset($_POST['inspection']) && $_POST['inspection'] == '1' ? 1 : 0;
    $year_record = isset($_POST['yearRecord']) && $_POST['yearRecord'] == '1' ? 1 : 0;
    
    $ip_address = $_SERVER['REMOTE_ADDR'];

    if ($full_name_applicant === '') {
        echo json_encode(['success' => false, 'message' => 'ФИО инициатора обязательно для заполнения!'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($car_make === '' && $state_number === '' && $driver_last_name === '' &&
        $entry_date_raw === '' && $out_date_raw === '' && $comment === '') {
        echo json_encode(['success' => false, 'message' => 'Пожалуйста, заполните хотя бы одно дополнительное поле!'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $entry_time = $entry_time !== '' ? $entry_time : null;
    $out_time = $out_time !== '' ? $out_time : null;
    $car_make = $car_make !== '' ? $car_make : null;
    $state_number = $state_number !== '' ? $state_number : null;
    $driver_last_name = $driver_last_name !== '' ? $driver_last_name : null;
    $comment = $comment !== '' ? $comment : null;

    error_log("Финальные значения для БД: entry_date='$entry_date', out_date='$out_date'");

    $stmt = $conn->prepare("INSERT INTO requests (user_token, car_make, state_number, driver_last_name, full_name_applicant, entry_time, out_time, entry_date, out_date, comment, inspection, year_record, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

    if (!$stmt) {
        throw new Exception('Ошибка подготовки запроса: ' . $conn->error);
    }

    $stmt->bind_param(
        "ssssssssssiis",
        $user_token, $car_make, $state_number, $driver_last_name, $full_name_applicant,
        $entry_time, $out_time, $entry_date, $out_date, $comment,
        $inspection, $year_record, $ip_address
    );

    if ($stmt->execute()) {
        error_log("Заявка успешно сохранена с ID: " . $stmt->insert_id);
        echo json_encode(['success' => true, 'message' => 'Заявка отправлена на рассмотрение'], JSON_UNESCAPED_UNICODE);
    } else {
        throw new Exception('Ошибка выполнения: ' . $stmt->error);
    }

    $stmt->close();
    $conn->close();

} catch (Exception $e) {
    error_log('Ошибка submit_request.php: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Ошибка сервера: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>