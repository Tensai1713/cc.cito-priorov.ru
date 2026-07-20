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

// Обработка принудительного выхода (срабатывает, когда пользователь закрыл вкладку и открыл новую)
if (isset($_GET['force_logout'])) {
    // Удаляем ТОЛЬКО флаги авторизации index, чтобы не убить сессию админки
    unset($_SESSION['auth_user']);
    unset($_SESSION['auth_login']);
    unset($_SESSION['auth_time']);
    unset($_SESSION['auth_last_activity']);
    unset($_SESSION['auth_tab_token']);
    
    header('Location: ./');
    exit;
}

function isAuthorized() {
    if (!isset($_SESSION['auth_user']) || $_SESSION['auth_user'] !== true) {
        return false;
    }
    
    // Резервный таймаут PHP (2 часа). 
    // Основную работу по 15 минутам теперь выполняет JavaScript.
    $timeout = 2 * 60 * 60; 
    $lastActivity = $_SESSION['auth_last_activity'] ?? 0;
    
    if (time() - $lastActivity > $timeout) {
        unset($_SESSION['auth_user']);
        return false;
    }
    
    return true;
}

// Обновляем время активности при каждом запросе
if (isset($_SESSION['auth_user']) && $_SESSION['auth_user'] === true) {
    $_SESSION['auth_last_activity'] = time();
}

// Обработка обычного выхода по кнопке "Выйти"
if (isset($_GET['logout'])) {
    unset($_SESSION['auth_user']);
    unset($_SESSION['auth_login']);
    unset($_SESSION['auth_time']);
    unset($_SESSION['auth_last_activity']);
    unset($_SESSION['auth_tab_token']);
    
    header('Location: ./');
    exit;
}
?>