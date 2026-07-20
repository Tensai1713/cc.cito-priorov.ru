<?php
/**
 * Центральный модуль защиты админ-панели
 * Для закрытой локальной сети со статическими IP
 * 
 * Подключается во все admin-скрипты через:
 *   define('ADMIN_AUTH', true);
 *   require_once __DIR__ . '/admin_auth.php';
 */

if (!defined('ADMIN_AUTH')) {
    http_response_code(403);
    exit('Доступ запрещён');
}

// === БЕЛЫЙ СПИСОК IP-АДРЕСОВ УСТРОЙСТВ ===
$allowed_ips = [
    '127.0.0.1',      
    '::1',          
    '10.0.13.11',     
    '10.0.14.12',     
    '10.0.0.111',     
];

// === ПОЛУЧАЕМ IP УСТРОЙСТВА ===
// В закрытой сети без прокси берём REMOTE_ADDR напрямую
$user_ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

// === ПРОВЕРКА IP ===
if (!in_array($user_ip, $allowed_ips)) {
    // Логируем попытку несанкционированного доступа
    $log_entry = sprintf(
        "%s | IP: %s | URL: %s | Method: %s\n",
        date('Y-m-d H:i:s'),
        $user_ip,
        $_SERVER['REQUEST_URI'] ?? 'unknown',
        $_SERVER['REQUEST_METHOD'] ?? 'unknown'
    );
    @file_put_contents(__DIR__ . '/admin_access.log', $log_entry, FILE_APPEND | LOCK_EX);
    
    // Отдаём 404, чтобы скрыть существование админки
    http_response_code(404);
    exit('Страница не найдена');
}

// === CSRF-ЗАЩИТА (для POST-запросов) ===
session_start();

if (!isset($_SESSION['admin_csrf_token'])) {
    $_SESSION['admin_csrf_token'] = bin2hex(random_bytes(32));
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf_token'] ?? '';
    
    if (empty($token) || !hash_equals($_SESSION['admin_csrf_token'] ?? '', $token)) {
        http_response_code(403);
        exit('Неверный CSRF-токен');
    }
}

// === ОТКЛЮЧАЕМ ПОКАЗ ОШИБОК ===
ini_set('display_errors', 0);
error_reporting(0);

// === ЗАЩИТНЫЕ HTTP-ЗАГОЛОВКИ ===
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('X-XSS-Protection: 1; mode=block');
?>