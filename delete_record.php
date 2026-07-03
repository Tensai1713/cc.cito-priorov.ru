<?php
require_once 'db_connect.php';
define('ADMIN_AUTH', true);
require_once __DIR__ . '/admin_auth.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $id = intval($_POST['id']);

    // Получаем информацию о записи перед удалением
    $stmtSelect = $conn->prepare("SELECT * FROM CarCheckpoint WHERE id = ?");
    $stmtSelect->bind_param('i', $id);
    $stmtSelect->execute();
    $result = $stmtSelect->get_result();
    $record = $result->fetch_assoc();

    if (!$record) {
        echo "Запись не найдена.";
        exit;
    }

    // Удаляем запись по ID
    $query = "DELETE FROM CarCheckpoint WHERE id = ?";
    $stmt = $conn->prepare($query);
    $stmt->bind_param('i', $id);
    
    if ($stmt->execute()) {
        echo "Запись успешно удалена.";
        
        // Логирование удаления
        $log_stmt = $conn->prepare("INSERT INTO logs (record_id, action, ip_address, old_value) VALUES (?, ?, ?, ?)");
        $action = 'delete';
        $ip_address = $_SERVER['REMOTE_ADDR'];

        // Формируем читаемую строку для old_value
        $old_value = "Марка: {$record['car_make']}, Госномер: {$record['state_number']}, Фамилия водителя: {$record['driver_last_name']}, Полное имя заявителя: {$record['full_name_applicant']}, Время въезда: {$record['entry_time']}, Время выезда: {$record['out_time']}, Дата въезда: {$record['entry_date']}, Дата выезда: {$record['out_date']}, Комментарий: {$record['comment']}, Проверка: {$record['inspection']}, Год записи: {$record['year_record']}";

        $log_stmt->bind_param("isss", $id, $action, $ip_address, $old_value);
        $log_stmt->execute();
        $log_stmt->close();
    } else {
        echo "Ошибка удаления записи: " . $stmt->error;
    }

    $stmt->close();
}
$conn->close();
?>