<?php
require_once 'db_connect.php';
header('Content-Type: application/json');
define('USER_ACCESS', true);
require_once __DIR__ . '/db_connect.php';

$user_token = trim($_POST['user_token'] ?? '');
if (empty($user_token)) {
    echo json_encode(['success' => false, 'message' => 'Неверный токен']);
    exit;
}

$car_make = trim($_POST['carMake'] ?? '') ?: null;
$state_number = trim($_POST['stateNumber'] ?? '') ?: null;
$driver_last_name = trim($_POST['driverLastName'] ?? '') ?: null;
$full_name_applicant = trim($_POST['fullNameApplicant'] ?? '') ?: null;
$entry_time = trim($_POST['entryTime'] ?? '') ?: null;
$out_time = trim($_POST['outTime'] ?? '') ?: null;
$entry_date = trim($_POST['entryDate'] ?? '') ?: null;
$out_date = trim($_POST['outDate'] ?? '') ?: null;
$comment = trim($_POST['comment'] ?? '') ?: null;
$inspection = isset($_POST['inspection']) ? 1 : 0;
$year_record = isset($_POST['yearRecord']) ? 1 : 0;
$ip_address = $_SERVER['REMOTE_ADDR'];

// Проверка обязательного поля
if (empty($full_name_applicant)) {
    echo json_encode(['success' => false, 'message' => 'ФИО инициатора обязательно для заполнения!']);
    exit;
}

$stmt = $conn->prepare("INSERT INTO requests (user_token, car_make, state_number, driver_last_name, full_name_applicant, entry_time, out_time, entry_date, out_date, comment, inspection, year_record, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

$stmt->bind_param(
    "ssssssssssiis", 
    $user_token, 
    $car_make, 
    $state_number, 
    $driver_last_name, 
    $full_name_applicant, 
    $entry_time, 
    $out_time, 
    $entry_date, 
    $out_date, 
    $comment, 
    $inspection, 
    $year_record, 
    $ip_address
);

if ($stmt->execute()) {
    echo json_encode(['success' => true, 'message' => 'Заявка отправлена на рассмотрение']);
} else {
    echo json_encode(['success' => false, 'message' => 'Ошибка при отправке заявки: ' . $stmt->error]);
}

$stmt->close();
$conn->close();
?>