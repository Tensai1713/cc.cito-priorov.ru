<?php
// allowed_ips.php - список IP, которым разрешено удалять записи

// Добавить сюда IP администраторов, которым разрешено удаление
$allowed_delete_ips = [
   '10.0.13.11',
   '10.0.14.12',
   '10.0.12.58',

];

// Функция проверки IP
function canDelete() {
    global $allowed_delete_ips;
    
    $user_ip = $_SERVER['REMOTE_ADDR'] ?? '';
    
    // Проверяем, есть ли IP в списке разрешенных
    return in_array($user_ip, $allowed_delete_ips);
}

// Функция получения текущего IP (для отладки)
function getCurrentIP() {
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}
?>