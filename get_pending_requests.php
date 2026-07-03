<?php
require_once 'db_connect.php';
header('Content-Type: application/json');
define('ADMIN_AUTH', true);
require_once __DIR__ . '/admin_auth.php';

$query = "SELECT id, car_make, state_number, driver_last_name, full_name_applicant, entry_date, created_at FROM requests WHERE status = 'pending' ORDER BY created_at DESC";
$result = $conn->query($query);

$requests = [];
while ($row = $result->fetch_assoc()) {
    $requests[] = $row;
}

echo json_encode(['success' => true, 'requests' => $requests, 'count' => count($requests)]);
$conn->close();
?>