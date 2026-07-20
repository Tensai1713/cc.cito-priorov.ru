<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

define('ADMIN_AUTH', true);
require_once __DIR__ . '/admin_auth.php'; // ← Проверяет IP и CSRF
require_once 'db_connect.php';
require_once 'helpers.php';

header('Content-Type: application/json; charset=utf-8');

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
        $inspection = !empty($request['inspection']) ? intval($request['inspection']) : 0;
        $year_record = !empty($request['year_record']) ? intval($request['year_record']) : 0;

        $car_make = !empty($request['car_make']) ? $request['car_make'] : null;
        $state_number = !empty($request['state_number']) ? $request['state_number'] : null;
        $driver_last_name = !empty($request['driver_last_name']) ? $request['driver_last_name'] : null;
        $full_name_applicant = !empty($request['full_name_applicant']) ? $request['full_name_applicant'] : null;
        $entry_time = !empty($request['entry_time']) ? $request['entry_time'] : null;
        $out_time = !empty($request['out_time']) ? $request['out_time'] : null;
        $comment = !empty($request['comment']) ? $request['comment'] : null;

        $entry_date = convertDateForDB($request['entry_date'] ?? '');
        $out_date = convertDateForDB($request['out_date'] ?? '');

        $insert = $conn->prepare("INSERT INTO CarCheckpoint (car_make, state_number, driver_last_name, full_name_applicant, entry_time, out_time, entry_date, out_date, comment, inspection, year_record) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        
        $insert->bind_param("sssssssssii", $car_make, $state_number, $driver_last_name, $full_name_applicant, $entry_time, $out_time, $entry_date, $out_date, $comment, $inspection, $year_record);

        if (!$insert->execute()) {
            throw new Exception('Ошибка вставки: ' . $insert->error);
        }
        $insert->close();

        $update = $conn->prepare("UPDATE requests SET status = 'approved' WHERE id = ?");
        $update->bind_param('i', $id);
        $update->execute();
        $update->close();

        echo json_encode(['success' => true, 'message' => "Заявка #$id одобрена"], JSON_UNESCAPED_UNICODE);

    } elseif ($action === 'reject') {
        $update = $conn->prepare("UPDATE requests SET status = 'rejected' WHERE id = ?");
        $update->bind_param('i', $id);
        
        if ($update->execute()) {
            $update->close();
            echo json_encode(['success' => true, 'message' => "Заявка #$id отклонена"], JSON_UNESCAPED_UNICODE);
        } else {
            throw new Exception('Ошибка обновления: ' . $update->error);
        }
    }

} catch (Exception $e) {
    error_log('Ошибка process_request.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
} finally {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
}
?>