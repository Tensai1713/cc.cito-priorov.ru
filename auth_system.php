<?php
// auth_system.php

ini_set('session.use_cookies', 1);
ini_set('session.use_only_cookies', 1);
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_samesite', 'Lax');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/auth_config.php';

function isAuthorized() {
    if (!isset($_SESSION['auth_user']) || $_SESSION['auth_user'] !== true) {
        return false;
    }
    
    // Проверяем время бездействия (15 минут)
    $timeout = 15 * 60; // 15 минут в секундах
    $lastActivity = $_SESSION['auth_last_activity'] ?? 0;
    
    if (time() - $lastActivity > $timeout) {
        // Сессия истекла — очищаем
        $_SESSION = array();
        session_destroy();
        return false;
    }
    
    return true;
}

// Обновляем время активности при каждом запросе
if (isset($_SESSION['auth_user']) && $_SESSION['auth_user'] === true) {
    $_SESSION['auth_last_activity'] = time();
}

// Обработка выхода
if (isset($_GET['logout'])) {
    $_SESSION = array();
    
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    
    session_destroy();
    header('Location: ./');
    exit;
}
?>