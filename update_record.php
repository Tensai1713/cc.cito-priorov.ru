<?php
require_once 'db_connect.php';
define('ADMIN_AUTH', true);
require_once __DIR__ . '/admin_auth.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $id = intval($_POST['id']);
    $car_make = trim($_POST['car_make'] ?? null);
    $state_number = trim($_POST['state_number'] ?? null);
    $driver_last_name = trim($_POST['driver_last_name'] ?? null);
    $full_name_applicant = trim($_POST['full_name_applicant'] ?? null);
    $entry_time = trim($_POST['entry_time'] ?? null);
    $out_time = trim($_POST['out_time'] ?? null);
    $entry_date = trim($_POST['entry_date'] ?? null);
    $out_date = trim($_POST['out_date'] ?? null);
    $comment = trim($_POST['comment'] ?? null);
    $inspection = (isset($_POST['inspection']) && $_POST['inspection'] == '1') ? 1 : 0;
    $year_record = (isset($_POST['year_record']) && $_POST['year_record'] == '1') ? 1 : 0;

    // Получаем информацию о записи перед редактированием
    $stmtSelect = $conn->prepare("SELECT * FROM CarCheckpoint WHERE id = ?");
    $stmtSelect->bind_param('i', $id);
    $stmtSelect->execute();
    $result = $stmtSelect->get_result();
    $old_record = $result->fetch_assoc();

    if (!$old_record) {
        echo "Запись не найдена.";
        exit;
    }

    // Формируем старое значение как читаемую строку
    $old_value = "Марка: {$old_record['car_make']}, Госномер: {$old_record['state_number']}, Фамилия водителя: {$old_record['driver_last_name']}, Полное имя заявителя: {$old_record['full_name_applicant']}, Время въезда: {$old_record['entry_time']}, Время выезда: {$old_record['out_time']}, Дата въезда: {$old_record['entry_date']}, Дата выезда: {$old_record['out_date']}, Комментарий: {$old_record['comment']}, Проверка: {$old_record['inspection']}, Год записи: {$old_record['year_record']}";

    // Преобразуем пустые строки и невалидные значения в NULL
    $entry_time_db = (empty($entry_time) || $entry_time === '00:00:00') ? null : $entry_time;
    $out_time_db = (empty($out_time) || $out_time === '00:00:00') ? null : $out_time;
    $entry_date_db = (empty($entry_date) || $entry_date === '1970-01-01' || $entry_date === '0000-00-00') ? null : $entry_date;
    $out_date_db = (empty($out_date) || $out_date === '1970-01-01' || $out_date === '0000-00-00') ? null : $out_date;
    $car_make_db = empty($car_make) ? null : $car_make;
    $state_number_db = empty($state_number) ? null : $state_number;
    $driver_last_name_db = empty($driver_last_name) ? null : $driver_last_name;
    $full_name_applicant_db = empty($full_name_applicant) ? null : $full_name_applicant;
    $comment_db = empty($comment) ? null : $comment;

    // Обновляем запись
    $stmtUpdate = $conn->prepare("UPDATE CarCheckpoint SET 
        car_make=?, 
        state_number=?, 
        driver_last_name=?, 
        full_name_applicant=?, 
        entry_time=?, 
        out_time=?, 
        entry_date=?, 
        out_date=?, 
        comment=?, 
        inspection=?, 
        year_record=? 
        WHERE id=?");
    
    $stmtUpdate->bind_param(
        "ssssssssssii", 
        $car_make_db, 
        $state_number_db, 
        $driver_last_name_db, 
        $full_name_applicant_db, 
        $entry_time_db, 
        $out_time_db, 
        $entry_date_db, 
        $out_date_db, 
        $comment_db, 
        $inspection, 
        $year_record, 
        $id
    );

    if ($stmtUpdate->execute()) {
        // Логируем обновление
        $log_stmt = $conn->prepare("INSERT INTO logs (record_id, action, ip_address, old_value, new_value) VALUES (?, ?, ?, ?, ?)");
        $action = 'update';
        $ip_address = $_SERVER['REMOTE_ADDR'];
        $new_value = "Марка: {$car_make}, Госномер: {$state_number}, Фамилия водителя: {$driver_last_name}, Полное имя заявителя: {$full_name_applicant}, Время въезда: {$entry_time}, Время выезда: {$out_time}, Дата въезда: {$entry_date}, Дата выезда: {$out_date}, Комментарий: {$comment}, Проверка: {$inspection}, Год записи: {$year_record}";

        $log_stmt->bind_param("issss", $id, $action, $ip_address, $old_value, $new_value);
        $log_stmt->execute();
        $log_stmt->close();

        echo "Запись успешно отредактирована!";
    } else {
        echo "Ошибка редактирования записи: " . $stmtUpdate->error;
    }

    $stmtSelect->close();
    $stmtUpdate->close();
}
$conn->close();
?>