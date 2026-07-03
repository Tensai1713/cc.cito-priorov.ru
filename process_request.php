<?php
require_once 'db_connect.php';
header('Content-Type: application/json');
define('ADMIN_AUTH', true);
require_once __DIR__ . '/admin_auth.php';

$id = intval($_POST['id'] ?? 0);
$action = $_POST['action'] ?? '';

if ($id <= 0 || !in_array($action, ['approve', 'reject'])) {
    echo json_encode(['success' => false, 'message' => 'Неверные параметры']);
    exit;
}

$stmt = $conn->prepare("SELECT * FROM requests WHERE id = ? AND status = 'pending'");
$stmt->bind_param('i', $id);
$stmt->execute();
$result = $stmt->get_result();
$request = $result->fetch_assoc();

if (!$request) {
    echo json_encode(['success' => false, 'message' => 'Заявка не найдена или уже обработана']);
    exit;
}

$new_status = $action === 'approve' ? 'approved' : 'rejected';

$stmtUpdate = $conn->prepare("UPDATE requests SET status = ? WHERE id = ?");
$stmtUpdate->bind_param('si', $new_status, $id);

if ($stmtUpdate->execute()) {
    if ($action === 'approve') {
        $insertStmt = $conn->prepare("INSERT INTO CarCheckpoint (car_make, state_number, driver_last_name, full_name_applicant, entry_time, out_time, entry_date, out_date, comment, inspection, year_record) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $insertStmt->bind_param("ssssssssssi", 
            $request['car_make'], $request['state_number'], $request['driver_last_name'], 
            $request['full_name_applicant'], $request['entry_time'], $request['out_time'], 
            $request['entry_date'], $request['out_date'], $request['comment'], 
            $request['inspection'], $request['year_record']
        );
        $insertStmt->execute();
        $insertStmt->close();
    }
    
    echo json_encode(['success' => true, 'message' => $action === 'approve' ? 'Заявка одобрена' : 'Заявка отклонена']);
} else {
    echo json_encode(['success' => false, 'message' => 'Ошибка при обработке заявки']);
}

$stmt->close();
$stmtUpdate->close();
$conn->close();
?>