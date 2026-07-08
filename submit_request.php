<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

define('USER_ACCESS', true);
require_once 'db_connect.php';
header('Content-Type: application/json; charset=utf-8');

error_reporting(0);
ini_set('display_errors', 0);

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

try {
    $user_token = trim($_POST['user_token'] ?? 'anonymous');

    $car_make = trim($_POST['carMake'] ?? '');
    $state_number = trim($_POST['stateNumber'] ?? '');
    $driver_last_name = trim($_POST['driverLastName'] ?? '');
    $full_name_applicant = trim($_POST['fullNameApplicant'] ?? '');
    $entry_time = trim($_POST['entryTime'] ?? '');
    $out_time = trim($_POST['outTime'] ?? '');
    $entry_date = trim($_POST['entryDate'] ?? '');
    $out_date = trim($_POST['outDate'] ?? '');
    $comment = trim($_POST['comment'] ?? '');
    
    // ✅ ПРАВИЛЬНАЯ ОБРАБОТКА ЧЕКБОКСОВ
    $inspection = isset($_POST['inspection']) && $_POST['inspection'] == '1' ? 1 : 0;
    $year_record = isset($_POST['yearRecord']) && $_POST['yearRecord'] == '1' ? 1 : 0;
    
    $ip_address = $_SERVER['REMOTE_ADDR'];

    if ($full_name_applicant === '') {
        echo json_encode(['success' => false, 'message' => 'ФИО инициатора обязательно для заполнения!'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($car_make === '' && $state_number === '' && $driver_last_name === '' &&
        $entry_date === '' && $out_date === '' && $comment === '') {
        echo json_encode(['success' => false, 'message' => 'Пожалуйста, заполните хотя бы одно дополнительное поле!'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ✅ КОНВЕРТАЦИЯ ДАТ ИЗ DD.MM.YYYY В YYYY-MM-DD
    $entry_date = convertDateForDB($entry_date);
    $out_date = convertDateForDB($out_date);

    $entry_time = $entry_time !== '' ? $entry_time : null;
    $out_time = $out_time !== '' ? $out_time : null;
    $entry_date = $entry_date !== '' ? $entry_date : null;
    $out_date = $out_date !== '' ? $out_date : null;
    $car_make = $car_make !== '' ? $car_make : null;
    $state_number = $state_number !== '' ? $state_number : null;
    $driver_last_name = $driver_last_name !== '' ? $driver_last_name : null;
    $comment = $comment !== '' ? $comment : null;

    $stmt = $conn->prepare("INSERT INTO requests (user_token, car_make, state_number, driver_last_name, full_name_applicant, entry_time, out_time, entry_date, out_date, comment, inspection, year_record, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

    $stmt->bind_param(
        "ssssssssssiis",
        $user_token, $car_make, $state_number, $driver_last_name, $full_name_applicant,
        $entry_time, $out_time, $entry_date, $out_date, $comment,
        $inspection, $year_record, $ip_address
    );

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Заявка отправлена на рассмотрение'], JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode(['success' => false, 'message' => 'Ошибка при отправке заявки: ' . $stmt->error], JSON_UNESCAPED_UNICODE);
    }

    $stmt->close();
    $conn->close();

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Ошибка сервера'], JSON_UNESCAPED_UNICODE);
}
?>