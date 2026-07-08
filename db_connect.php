<?php
/**
 * Подключение к базе данных с защитой от прямого доступа
 * Разрешает доступ только через ADMIN_AUTH или USER_ACCESS
 */

if (!defined('ADMIN_AUTH') && !defined('USER_ACCESS')) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Доступ запрещён']);
    exit;
}

$host = 'localhost';
$user = 'useralex';
$pass = 'Alex@1713alex';
$dbname = 'CarCheck';

$conn = new mysqli($host, $user, $pass, $dbname);

if ($conn->connect_error) {
    if (defined('USER_ACCESS')) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'message' => 'Ошибка подключения к БД']);
    } else {
        http_response_code(500);
        echo 'Ошибка подключения к БД';
    }
    exit;
}

$conn->set_charset("utf8mb4");
?>