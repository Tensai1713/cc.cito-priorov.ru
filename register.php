<?php
// 1. Запуск сессии и заголовки
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
header('Content-Type: application/json; charset=utf-8');

// 2. Проверка CSRF-токена
$receivedToken = $_POST['csrf_token'] ?? '';
$sessionToken = $_SESSION['csrf_token'] ?? '';

if ($receivedToken === '' || $receivedToken !== $sessionToken) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Ошибка безопасности (CSRF)']);
    exit;
}

// 3. Подключение к БД и списку кодов
define('USER_ACCESS', true); // Обязательно для обхода защиты db_connect.php
require_once 'db_connect.php';
$validCodes = require __DIR__ . '/codes.php';

// 4. Получение и базовая валидация данных
$login = trim($_POST['login'] ?? '');
$password = $_POST['password'] ?? '';
$code = trim($_POST['code'] ?? '');
$forceRegister = isset($_POST['force_register']) && $_POST['force_register'] == '1';

if (!isset($validCodes[$code])) {
    echo json_encode(['success' => false, 'message' => 'Неверный код идентификации']);
    exit;
}
if (strlen($password) < 8) {
    echo json_encode(['success' => false, 'message' => 'Пароль должен состоять не менее чем из 8 символов']);
    exit;
}
if (strlen($login) < 3) {
    echo json_encode(['success' => false, 'message' => 'Логин должен быть не менее 3 символов']);
    exit;
}

$hashedPassword = password_hash($password, PASSWORD_DEFAULT);
$fullName = $validCodes[$code];

// 5. Проверяем, существует ли уже пользователь с таким кодом
$checkStmt = $conn->prepare("SELECT id FROM users WHERE registration_code = ?");
$checkStmt->bind_param("s", $code);
$checkStmt->execute();
$alreadyExists = $checkStmt->get_result()->num_rows > 0;
$checkStmt->close();

// 6. Логика сохранения (UPDATE или INSERT)
if ($alreadyExists && !$forceRegister) {
    // Защита "в глубину": если код занят, но флаг перезаписи не передан — блокируем
    echo json_encode([
        'success' => false,
        'code_already_used' => true,
        'message' => 'Этот код уже используется. Подтвердите перезапись данных.'
    ]);
    exit;
}

if ($alreadyExists && $forceRegister) {
    // СЦЕНАРИЙ А: Перезапись существующего аккаунта (пользователь нажал "Да, хочу")
    $updateStmt = $conn->prepare("UPDATE users SET login = ?, password = ? WHERE registration_code = ?");
    $updateStmt->bind_param("sss", $login, $hashedPassword, $code);
    
    if ($updateStmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Данные аккаунта успешно обновлены! Теперь вы можете войти.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Ошибка при обновлении данных: ' . $conn->error]);
    }
    $updateStmt->close();
    
} else {
    // СЦЕНАРИЙ Б: Создание совершенно нового аккаунта
    $insertStmt = $conn->prepare("INSERT INTO users (login, password, full_name, registration_code) VALUES (?, ?, ?, ?)");
    $insertStmt->bind_param("ssss", $login, $hashedPassword, $fullName, $code);
    
    if ($insertStmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Регистрация успешна! Теперь вы можете войти.']);
    } else {
        // Если сработал UNIQUE ключ (защита от редких гонок потоков)
        if ($conn->errno == 1062) {
            echo json_encode(['success' => false, 'code_already_used' => true, 'message' => 'Этот код уже используется.']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Ошибка при сохранении данных: ' . $conn->error]);
        }
    }
    $insertStmt->close();
}

$conn->close();
?>