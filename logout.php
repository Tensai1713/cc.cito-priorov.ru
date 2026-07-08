<?php
// logout.php - уничтожение сессии

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Полная очистка сессии
$_SESSION = array();

// Удаление cookie сессии
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}

session_destroy();

// Для sendBeacon возвращаем пустой ответ
if (isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'text/plain') !== false) {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode(['success' => true]);
?>