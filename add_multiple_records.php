<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

define('ADMIN_AUTH', true);
require_once __DIR__ . '/admin_auth.php';
require_once 'db_connect.php';
require_once 'helpers.php';

header('Content-Type: application/json; charset=utf-8');

if (!function_exists('get_real_ip')) {
    function get_real_ip() {
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    // ФИО инициатора оставляем полностью пустым (NULL)
    $full_name_applicant = null; 

    $stateNumbersJson = $_POST['stateNumbers'] ?? '[]';
    $stateNumbers = json_decode($stateNumbersJson, true);
    
    if (!is_array($stateNumbers) || empty($stateNumbers)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Заполните хотя бы один госномер'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    if (count($stateNumbers) > 100) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Максимум 100 записей за раз'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    // Убираем дубликаты и пустые значения
    $stateNumbers = array_unique(array_filter(array_map('trim', $stateNumbers)));
    
    $stmt = $conn->prepare("INSERT INTO CarCheckpoint (state_number, full_name_applicant) VALUES (?, ?)");
    
    if (!$stmt) {
        throw new Exception('Ошибка подготовки запроса: ' . $conn->error);
    }
    
    $addedCount = 0;
    
    foreach ($stateNumbers as $stateNumber) {
        // Привязываем параметры (NULL корректно запишется в базу)
        $stmt->bind_param("ss", $stateNumber, $full_name_applicant);
        
        if ($stmt->execute()) {
            $last_id = $stmt->insert_id;
            $addedCount++;
            
            // Логирование
            try {
                $check_table = $conn->query("SHOW TABLES LIKE 'logs'");
                if ($check_table && $check_table->num_rows > 0) {
                    $log_stmt = $conn->prepare("INSERT INTO logs (record_id, action, ip_address, new_value) VALUES (?, ?, ?, ?)");
                    $action = 'insert_multiple';
                    $ip_address = get_real_ip();
                    $new_value = "Госномер: {$stateNumber}, ФИО заявителя: (пусто)";
                    
                    $log_stmt->bind_param("isss", $last_id, $action, $ip_address, $new_value);
                    $log_stmt->execute();
                    $log_stmt->close();
                }
            } catch (Exception $log_error) {
                error_log('Ошибка логирования: ' . $log_error->getMessage());
            }
        }
    }
    
    $stmt->close();
    
    echo json_encode(['success' => true, 'message' => "Успешно добавлено записей: {$addedCount}"], JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    error_log('Ошибка add_multiple_records.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
} finally {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
}
?>