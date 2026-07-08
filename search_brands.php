<?php
// Отключаем вывод ошибок, чтобы не ломать JSON
error_reporting(0);
ini_set('display_errors', 0);

define('USER_ACCESS', true);
require_once 'db_connect.php';

// ВАЖНО: устанавливаем заголовок ПОСЛЕ подключения
header('Content-Type: application/json; charset=utf-8');

try {
    $query = trim($_GET['q'] ?? '');

    if (empty($query) || mb_strlen($query) < 1) {
        echo json_encode([]);
        exit;
    }

    // Определяем раскладку
    $isRussian = preg_match('/[а-яёА-ЯЁ]/u', $query);

    if ($isRussian) {
        $stmt = $conn->prepare("SELECT DISTINCT car_ru as name FROM cars WHERE car_ru LIKE ? LIMIT 10");
    } else {
        $stmt = $conn->prepare("SELECT DISTINCT car_eng as name FROM cars WHERE car_eng LIKE ? LIMIT 10");
    }

    if (!$stmt) {
        echo json_encode([]);
        exit;
    }

    $search = $query . '%';
    $stmt->bind_param('s', $search);
    $stmt->execute();
    $result = $stmt->get_result();

    $brands = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            if (!empty($row['name'])) {
                $brands[] = $row['name'];
            }
        }
    }

    echo json_encode($brands);
    $stmt->close();
    $conn->close();
    
} catch (Exception $e) {
    // В случае ошибки возвращаем пустой массив
    echo json_encode([]);
}
?>