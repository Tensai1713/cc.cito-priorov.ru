<?php
require_once 'db_connect.php';
define('ADMIN_AUTH', true);
require_once __DIR__ . '/admin_auth.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $car_make = trim($_POST['carMake'] ?? null);
    $state_number = trim($_POST['stateNumber'] ?? null);
    $driver_last_name = trim($_POST['driverLastName'] ?? null);
    $full_name_applicant = trim($_POST['fullNameApplicant'] ?? null);
    $entry_time = trim($_POST['entryTime'] ?? null);
    $out_time = trim($_POST['outTime'] ?? null);
    $entry_date = trim($_POST['entryDate'] ?? null);
    $out_date = trim($_POST['outDate'] ?? null);
    $comment = trim($_POST['comment'] ?? null);
    $inspection = isset($_POST['inspection']) ? 1 : 0;
    $year_record = isset($_POST['yearRecord']) ? 1 : 0;

    if (empty($car_make) && empty($state_number) && empty($driver_last_name) && 
        empty($full_name_applicant) && empty($comment) && empty($entry_date) && empty($out_date)) {
        echo "Пожалуйста, заполните хотя бы одно поле!";
        exit;
    }

    $stmt = $conn->prepare("INSERT INTO CarCheckpoint (car_make, state_number, driver_last_name, full_name_applicant, entry_time, out_time, entry_date, out_date, comment, inspection, year_record) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("ssssssssssi", $car_make, $state_number, $driver_last_name, $full_name_applicant, $entry_time, $out_time, $entry_date, $out_date, $comment, $inspection, $year_record);

    foreach ([$car_make, $state_number, $driver_last_name, $full_name_applicant, $entry_time, $out_time, $entry_date, $out_date, $comment] as &$value) {
        if ($value === '') {
            $value = null;
        }
    }

    if ($stmt->execute()) {
        echo "Новая запись успешно добавлена!";
        
        $last_id = $stmt->insert_id;
        $log_stmt = $conn->prepare("INSERT INTO logs (record_id, action, ip_address, new_value) VALUES (?, ?, ?, ?)");
        $action = 'insert';
        $ip_address = $_SERVER['REMOTE_ADDR'];

        $new_value = "Марка: {$car_make}, Госномер: {$state_number}, Фамилия водителя: {$driver_last_name}, Полное имя заявителя: {$full_name_applicant}, Время въезда: {$entry_time}, Время выезда: {$out_time}, Дата въезда: {$entry_date}, Дата выезда: {$out_date}, Комментарий: {$comment}, Проверка: {$inspection}, Год записи: {$year_record}";

        $log_stmt->bind_param("isss", $last_id, $action, $ip_address, $new_value);
        $log_stmt->execute();
        $log_stmt->close();
    } else {
        echo "Ошибка: " . $stmt->error;
    }

    $stmt->close();
}
$conn->close();
?>