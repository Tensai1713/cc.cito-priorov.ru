<?php
// allowed_ips.php - список IP для различных административных действий

// IP, которым разрешено удаление записей
$allowed_delete_ips = [
   '10.0.13.11',
   '10.0.14.12',
   '10.0.12.58',
];

// IP, которым разрешено отклонять заявки 
// (можете добавить сюда те же IP или другие, если нужно разграничить права)
$allowed_reject_ips = [
   '10.0.13.11',
   '10.0.14.12',
   '10.0.12.58',
];

// Функция проверки права на удаление
function canDelete() {
    global $allowed_delete_ips;
    $user_ip = $_SERVER['REMOTE_ADDR'] ?? '';
    return in_array($user_ip, $allowed_delete_ips);
}

// Функция проверки права на отклонение заявок
function canReject() {
    global $allowed_reject_ips;
    $user_ip = $_SERVER['REMOTE_ADDR'] ?? '';
    return in_array($user_ip, $allowed_reject_ips);
}

// Функция получения текущего IP (для отладки)
function getCurrentIP() {
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}
?>