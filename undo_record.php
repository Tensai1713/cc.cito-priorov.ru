<?php
define('ADMIN_AUTH', true);
require_once __DIR__ . '/admin_auth.php';
require_once 'db_connect.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$id = intval($_POST['id'] ?? 0);
$previousDataRaw = $_POST['previousData'] ?? null;

if (!$id || !$previousDataRaw) {
    echo json_encode(['success' => false, 'message' => 'Неверные данные']);
    exit;
}

$data = json_decode($previousDataRaw, true);
if (!$data) {
    echo json_encode(['success' => false, 'message' => 'Ошибка парсинга данных']);
    exit;
}

// Объединяем госномер
$stateMain = trim($data['state_number_main'] ?? '');
$stateRegion = trim($data['state_number_region'] ?? '');
$stateNumber = $stateRegion ? "$stateMain $stateRegion" : $stateMain;

$inspection = !empty($data['inspection']) ? 1 : 0;
$yearRecord = !empty($data['year_record']) ? 1 : 0;

$stmt = $conn->prepare("UPDATE CarCheckpoint SET 
    car_make = ?, 
    state_number = ?, 
    driver_last_name = ?, 
    full_name_applicant = ?, 
    entry_time = ?, 
    out_time = ?, 
    entry_date = ?, 
    out_date = ?, 
    comment = ?, 
    inspection = ?, 
    year_record = ? 
    WHERE id = ?");

if (!$stmt) {
    echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
    exit;
}

$stmt->bind_param(
    "sssssssssiii",
    $data['car_make'],
    $stateNumber,
    $data['driver_last_name'],
    $data['full_name_applicant'],
    $data['entry_time'],
    $data['out_time'],
    $data['entry_date'],
    $data['out_date'],
    $data['comment'],
    $inspection,
    $yearRecord,
    $id
);

if ($stmt->execute()) {
    echo json_encode(['success' => true, 'message' => 'Данные восстановлены']);
} else {
    echo json_encode(['success' => false, 'message' => 'Ошибка при восстановлении: ' . $stmt->error]);
}

$stmt->close();
$conn->close();
?>