<?php
// ============================================
// ЖЁСТКАЯ ЗАЩИТА АДМИН-ПАНЕЛИ
// ============================================

// Запрещаем прямой доступ к этому файлу
if (!defined('ADMIN_AUTH')) {
    http_response_code(403);
    exit('Доступ запрещён');
}

// === БЕЛЫЙ СПИСОК IP-АДРЕСОВ ===
// Добавь сюда IP, с которых разрешён доступ к админке
$allowed_ips = [
    '10.0.13.11',
    '10.0.14.12',
          
    
];

// Получаем реальный IP пользователя (учитываем прокси)
function get_real_ip() {
    $ip_keys = ['HTTP_CF_CONNECTING_IP', 'HTTP_X_REAL_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_CLIENT_IP', 'REMOTE_ADDR'];
    
    foreach ($ip_keys as $key) {
        if (!empty($_SERVER[$key])) {
            $ip = $_SERVER[$key];
            // Если несколько IP через запятую — берём первый
            if (strpos($ip, ',') !== false) {
                $ip = trim(explode(',', $ip)[0]);
            }
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }
    }
    return '0.0.0.0';
}

$user_ip = get_real_ip();

// === ПРОВЕРКА IP ===
if (!in_array($user_ip, $allowed_ips)) {
    // Логируем попытку несанкционированного доступа
    $log_entry = date('Y-m-d H:i:s') . " | IP: $user_ip | URL: " . $_SERVER['REQUEST_URI'] . " | UA: " . ($_SERVER['HTTP_USER_AGENT'] ?? 'unknown') . "\n";
    @file_put_contents(__DIR__ . '/admin_access.log', $log_entry, FILE_APPEND | LOCK_EX);
    
    // Отдаём 404, чтобы скрыть существование админки
    http_response_code(404);
    exit('Страница не найдена');
}

// === ЗАЩИТА ОТ CSRF (для POST-запросов) ===
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    session_start();
    
    if (!isset($_SESSION['admin_csrf_token'])) {
        $_SESSION['admin_csrf_token'] = bin2hex(random_bytes(32));
    }
    
    // Для AJAX-запросов проверяем заголовок
    if (!empty($_SERVER['HTTP_X_CSRF_TOKEN'])) {
        if (!hash_equals($_SESSION['admin_csrf_token'], $_SERVER['HTTP_X_CSRF_TOKEN'])) {
            http_response_code(403);
            exit('Неверный CSRF-токен');
        }
    }
}

// === ЗАЩИТА ОТ ПЕРЕБОРА (Rate Limiting) ===
session_start();
$rate_limit_key = 'admin_requests_' . $user_ip;
$now = time();

if (!isset($_SESSION[$rate_limit_key])) {
    $_SESSION[$rate_limit_key] = ['count' => 0, 'start' => $now];
}

// Сбрасываем счётчик каждую минуту
if ($now - $_SESSION[$rate_limit_key]['start'] > 60) {
    $_SESSION[$rate_limit_key] = ['count' => 0, 'start' => $now];
}

$_SESSION[$rate_limit_key]['count']++;

// Максимум 120 запросов в минуту
if ($_SESSION[$rate_limit_key]['count'] > 120) {
    http_response_code(429);
    exit('Слишком много запросов. Попробуйте позже.');
}

// === ОТКЛЮЧАЕМ ПОКАЗ ОШИБОК В ПРОДАКШЕНЕ ===
ini_set('display_errors', 0);
error_reporting(0);

// === ЗАЩИТНЫЕ ЗАГОЛОВКИ ===
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');
header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;");
?>