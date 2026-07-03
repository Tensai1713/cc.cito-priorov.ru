<?php
require_once 'db_connect.php';
header('Content-Type: application/json');

$query = trim($_GET['q'] ?? '');

if (empty($query)) {
    echo json_encode([]);
    exit;
}

// Определяем раскладку по первым символам
$isRussian = preg_match('/[а-яёА-ЯЁ]/u', $query);

if ($isRussian) {
    // Ищем в русском столбце
    $stmt = $conn->prepare("SELECT car_ru as name FROM cars WHERE car_ru LIKE ? LIMIT 10");
    $search = $query . '%';
    $stmt->bind_param('s', $search);
} else {
    // Ищем в английском столбце
    $stmt = $conn->prepare("SELECT car_eng as name FROM cars WHERE car_eng LIKE ? LIMIT 10");
    $search = $query . '%';
    $stmt->bind_param('s', $search);
}

$stmt->execute();
$result = $stmt->get_result();

$brands = [];
while ($row = $result->fetch_assoc()) {
    $brands[] = $row['name'];
}

echo json_encode($brands);
$stmt->close();
$conn->close();
?>