<?php
error_reporting(E_ALL);
ini_set('display_errors', 1); // Включаем вывод ошибок для отладки

define('USER_ACCESS', true);
require_once 'db_connect.php';
require_once 'helpers.php';

// Запускаем сессию, чтобы получить ФИО авторизованного пользователя
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json; charset=utf-8');

// Логируем всё, что пришло от JS
error_log("=== ЗАПРОС В submit_request.php ===");
error_log(print_r($_POST, true));

try {
    $user_token = trim($_POST['user_token'] ?? 'anonymous');
    error_log("Токен: " . $user_token);

    $car_make = trim($_POST['carMake'] ?? '');
    $state_number = trim($_POST['stateNumber'] ?? '');
    $driver_last_name = trim($_POST['driverLastName'] ?? '');
    
    // Берем ФИО из сессии, так как в форме его больше нет!
    $full_name_applicant = trim($_SESSION['auth_full_name'] ?? $_SESSION['auth_login'] ?? 'Неизвестный');
    
    $entry_time = trim($_POST['entryTime'] ?? '');
    $out_time = trim($_POST['outTime'] ?? '');
    $entry_date_raw = trim($_POST['entryDate'] ?? '');
    $out_date_raw = trim($_POST['outDate'] ?? '');
    $comment = trim($_POST['comment'] ?? '');
    
    $inspection = isset($_POST['inspection']) && $_POST['inspection'] == '1' ? 1 : 0;
    $year_record = isset($_POST['yearRecord']) && $_POST['yearRecord'] == '1' ? 1 : 0;
    $ip_address = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

    // Валидация: хотя бы одно поле должно быть заполнено
    if ($car_make === '' && $state_number === '' && $driver_last_name === '' &&
        $entry_date_raw === '' && $out_date_raw === '' && $comment === '') {
        echo json_encode(['success' => false, 'message' => 'Пожалуйста, заполните хотя бы одно поле!'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Конвертация дат
    $entry_date = convertDateForDB($entry_date_raw);
    $out_date = convertDateForDB($out_date_raw);

    // Обработка NULL для базы данных
    $entry_time = $entry_time !== '' ? $entry_time : null;
    $out_time = $out_time !== '' ? $out_time : null;
    $car_make = $car_make !== '' ? $car_make : null;
    $state_number = $state_number !== '' ? $state_number : null;
    $driver_last_name = $driver_last_name !== '' ? $driver_last_name : null;
    $comment = $comment !== '' ? $comment : null;

    error_log("Подготовка запроса к БД...");
    
    // ВАЖНО: Убедитесь, что в таблице requests есть все эти 13 колонок!
    $stmt = $conn->prepare("INSERT INTO requests (user_token, car_make, state_number, driver_last_name, full_name_applicant, entry_time, out_time, entry_date, out_date, comment, inspection, year_record, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

    if (!$stmt) {
        throw new Exception('Ошибка подготовки запроса: ' . $conn->error);
    }

    // Строгая проверка типов: 10 строк (s), 2 целых числа (i), 1 строка (s) = 13 символов
    $stmt->bind_param(
        "ssssssssssiis",
        $user_token, $car_make, $state_number, $driver_last_name, $full_name_applicant,
        $entry_time, $out_time, $entry_date, $out_date, $comment,
        $inspection, $year_record, $ip_address
    );

    error_log("Выполнение запроса...");
    if ($stmt->execute()) {
        error_log("Успешно! ID записи: " . $stmt->insert_id);
        echo json_encode(['success' => true, 'message' => 'Заявка отправлена на рассмотрение'], JSON_UNESCAPED_UNICODE);
    } else {
        throw new Exception('Ошибка выполнения SQL: ' . $stmt->error);
    }

    $stmt->close();
    $conn->close();

} catch (Exception $e) {
    error_log('КРИТИЧЕСКАЯ ОШИБКА submit_request.php: ' . $e->getMessage());
    // Возвращаем ошибку в JS, чтобы она появилась в консоли браузера
    echo json_encode(['success' => false, 'message' => 'Ошибка сервера: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>