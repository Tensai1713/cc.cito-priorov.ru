<?php
// 1. Запускаем сессию в самом начале
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

// 2. ВАЖНО: Разрешаем доступ к БД для этого скрипта (иначе db_connect.php выдаст 403 "Доступ запрещён")
define('USER_ACCESS', true);

// 3. Подключаем БД для проверки логина/пароля
require_once __DIR__ . '/db_connect.php';

// 4. Подключаем систему авторизации (для функции isAuthorized и обработки logout)
require_once __DIR__ . '/auth_system.php';

$error = '';
$is_logged_in = isAuthorized();

// Обработка входа
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$is_logged_in) {
    $login = trim($_POST['login'] ?? '');
    $password = $_POST['password'] ?? '';
    
    if ($login !== '' && $password !== '') {
        // Ищем пользователя в базе данных по логину
        $stmt = $conn->prepare("SELECT id, login, password, full_name FROM users WHERE login = ?");
        $stmt->bind_param("s", $login);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result && $row = $result->fetch_assoc()) {
            // Проверяем, совпадает ли введенный пароль с хэшем в БД
            if (password_verify($password, $row['password'])) {
                // Успешный вход!
                $_SESSION['auth_user'] = true;
                $_SESSION['auth_login'] = $row['login'];
                $_SESSION['auth_full_name'] = $row['full_name'];
                $_SESSION['auth_time'] = time();
                $_SESSION['auth_last_activity'] = time();
                $_SESSION['auth_tab_token'] = bin2hex(random_bytes(16));
                
                header('Location: ./?login_success=1');
                exit;
            } else {
                $error = 'Неверный логин или пароль';
            }
        } else {
            $error = 'Неверный логин или пароль';
        }
        $stmt->close();
    } else {
        $error = 'Неверный логин или пароль';
    }
}


if (!$is_logged_in) {
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="<?= htmlspecialchars($_SESSION['csrf_token']) ?>">
    <meta name="is-authorized" content="true">
    
    <title>Заявка</title>
    <link rel="shortcut icon" href="img/favicon.ico" type="image/x-icon">
    <link rel="icon" href="img/favicon.ico" type="image/x-icon">
    
    <link rel="stylesheet" href="./flatpickr.min.css">
    <link rel="stylesheet" href="./style.css">
    
    <script src="./flatpickr.min.js"></script>
    <script src="./ru.js"></script>
    
    <script defer src="./jquery.min.js"></script>
    <script defer src="./script.js"></script>
    <script defer src="./index.js"></script>
</head>
<body>
    <div class="toast-container" id="toastContainer"></div>
    
    <div class="auth-container">
        <form class="auth-form" id="loginForm" method="POST" action="">
            <img class="auth-logo" src="./img/short_logo.png" alt="Logo">
            <h1 class="auth-title">Вход в систему</h1>
            
            <?php if ($error): ?>
                <div class="auth-error"><?= htmlspecialchars($error) ?></div>
            <?php endif; ?>
            
            <div class="auth-field">
                <label for="login">Логин</label>
                <input type="text" id="login" name="login" required autofocus autocomplete="username">
            </div>
            
            <div class="auth-field">
                <label for="password">Пароль</label>
                <input type="password" id="password" name="password" required autocomplete="current-password">
            </div>
            
            <button type="submit" class="auth-submit btn">Войти</button>
            <a href="#" id="showRegisterCodeBtn">Я хочу зарегистрироваться</a>
        </form>

        <form class="auth-form" id="codeVerificationForm" style="display: none;">
            <img class="auth-logo" src="./img/logo.png" alt="Logo">
            <h1 class="auth-title">Регистрация</h1>
            
            <div class="auth-field" style="text-align: center;">
                <label style="margin-bottom: 15px; display: block; font-size: 16px;">Введите ваш код идентификации</label>
                <div class="code-inputs-wrapper">
                    <input type="text" class="code-input" maxlength="1" inputmode="numeric" pattern="[0-9]*">
                    <input type="text" class="code-input" maxlength="1" inputmode="numeric" pattern="[0-9]*">
                    <input type="text" class="code-input" maxlength="1" inputmode="numeric" pattern="[0-9]*">
                    <input type="text" class="code-input" maxlength="1" inputmode="numeric" pattern="[0-9]*">
                </div>
            </div>
            
            <button type="button" class="auth-submit btn" id="backToLoginFromCode" style="background: rgba(255,255,255,0.1); margin-top: 20px;">Назад ко входу</button>
        </form>

        <form class="auth-form" id="registrationForm" style="display: none;">
            <img class="auth-logo" src="./img/logo.png" alt="Logo">
            <h1 class="auth-title">Создание аккаунта</h1>
            
            <div class="auth-field">
                <label for="regLogin">Логин</label>
                <input type="text" id="regLogin" name="login" required autocomplete="username">
            </div>
            
            <div class="auth-field">
                <label for="regPassword">Пароль</label>
                <input type="password" id="regPassword" name="password" required autocomplete="new-password">
            </div>
            
            <div class="auth-field">
                <label for="regPasswordConfirm">Подтверждение пароля</label>
                <input type="password" id="regPasswordConfirm" name="password_confirm" required autocomplete="new-password">
            </div>
            
            <div class="auth-field auth-warning-box">
              Пароль должен состоять не менее чем из 8 символов
            </div>
            
            <button type="submit" class="auth-submit btn" id="submitRegBtn">Зарегистрироваться</button>
            <button type="button" class="auth-submit btn" id="backToCode" style="background: rgba(255,255,255,0.1); margin-top: 10px;">Назад к коду</button>
        </form>
    </div>

<div class="confirm-submit-modal" id="codeReuseModal" style="display: none;">
    <div class="confirm-submit-overlay" id="codeReuseOverlay"></div>
    <div class="confirm-submit-content">
        <h2 class="confirm-submit-title">Внимание</h2>
        <p class="confirm-submit-text">Ваш код идентификации уже был использован для регистрации. Вы хотите провести регистрацию заново?</p>
        <div class="confirm-submit-actions" style="flex-direction: column; gap: 15px; align-items: center;">
            <button class="btn btn-confirm" id="confirmReuseBtn" style="width: 100%;">Да, хочу</button>
            <a href="#" id="showSecurityContactBtn" style="color: var(--secondary); font-size: 13px; text-decoration: underline; text-align: center; margin-top: 5px;">
                Аккаунт никогда не регистрировался или возникли вопросы?
            </a>
        </div>
    </div>
</div>

<div class="confirm-submit-modal" id="securityContactModal" style="display: none;">
    <div class="confirm-submit-overlay" id="securityContactOverlay"></div>
    <div class="confirm-submit-content">
        <h2 class="confirm-submit-title">Служба безопасности</h2>
        <p class="confirm-submit-text" style="line-height: 1.6; text-align: center;">
            Пожалуйста, обратитесь в <strong>отдел по безопасности и противодействию коррупции к Воронину Сергею Александровичу</strong> или напишите на почту:<br><br>
            <a href="mailto:VoroninSA@cito-priorov.ru" style="color: var(--primary); font-weight: 600; text-decoration: none; word-break: break-all;">
                VoroninSA@cito-priorov.ru
            </a>
        </p>
        <div class="confirm-submit-actions" style="margin-top: 20px;">
            <button class="btn btn-cancel" id="closeSecurityContactBtn">Понятно</button>
        </div>
    </div>
</div>         

</body>
</html>
<?php
    exit;
}
?>


<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="<?= htmlspecialchars($_SESSION['csrf_token']) ?>">
    <meta name="is-authorized" content="true">
    
    <title>Заявка</title>
    <link rel="shortcut icon" href="img/favicon.ico" type="image/x-icon">
    <link rel="icon" href="img/favicon.ico" type="image/x-icon">
    
    <link rel="stylesheet" href="./flatpickr.min.css">
    <link rel="stylesheet" href="./style.css">
    
    <script src="./flatpickr.min.js"></script>
    <script src="./ru.js"></script>
    
    <script defer src="./jquery.min.js"></script>
    <script defer src="./script.js"></script>
    <script defer src="./index.js"></script>
    
    <style>
        html, body {
            overscroll-behavior: none;
            height: 100vh;
            margin: 0;
            padding: 0;
        }
        .form-subtitle-warning {
            display: block;
            margin-top: 10px;
            color: var(--warning, #ffcc00);
            font-size: 14px;
            font-weight: 500;
        }
        .form-subtitle-alert {
            border: 2px solid var(--warning, #ffcc00);
            border-radius: 12px;
            padding: 16px 20px;
            background: rgba(255, 204, 0, 0.08);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            text-align: center;
            line-height: 1.6;
        }
    </style>
</head>
<body>

    <a href="?logout=1" class="logout-btn" title="Выйти">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9M16 17L21 12M21 12L16 7M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    </a>

    <div class="toast-container" id="toastContainer"></div>

    <button class="my-requests-btn btn" id="myRequestsBtn" title="Ваши заявки">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5M12 12H15M12 16H15M9 12H9.01M9 16H9.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Ваши заявки</span>
        <span class="my-requests-count" id="myRequestsCount" style="display: none;">0</span>
    </button>

    <div class="my-requests-modal" id="myRequestsModal" style="display: none;">
        <div class="my-requests-overlay" id="myRequestsOverlay"></div>
        <div class="my-requests-content">
            <button class="my-requests-close" id="myRequestsClose">✕</button>
            <h2 class="my-requests-title">📋 Ваши заявки</h2>
            <div class="my-requests-list" id="myRequestsList">
                <div class="my-requests-loading">Загрузка...</div>
            </div>
        </div>
    </div>

    <div class="new-entry">
        <form class="new-entry__panel" id="carForm">
            <h2 class="form-title">Заявка</h2>
            <p class="form-subtitle form-subtitle-alert">
                Заполните форму для подачи заявки на рассмотрение. Уведомление о статусе отобразится в списке ваших заявок на этой странице.
                <span class="form-subtitle-warning">⚠️ Будьте внимательны при заполнении поля «Гос/номер»</span>
            </p>
            <div class="new-entry__inputs">
                <div class="new-entry__column grid-item1"><label>Марка</label><input class="new-entry__input" type="text" name="carMake"></div>
                <div class="new-entry__column grid-item2">
                    <label>Гос/номер</label>
                    <input class="new-entry__input" type="text" name="stateNumber" placeholder="А123ТВ777" data-type="plate-normalize" maxlength="15">
                </div>
                <div class="new-entry__column grid-item3"><label>Водитель</label><input class="new-entry__input" type="text" name="driverLastName"></div>
                <div class="new-entry__column grid-item5">
                    <label>Время въезда</label>
                    <div class="time-input-wrapper">
                        <input class="new-entry__input custom-time-picker" type="text" name="entryTime" placeholder="ЧЧ:ММ" readonly>
                        <svg class="time-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 8V12L15 15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                </div>

                <div class="new-entry__column grid-item6">
                    <label>Время выезда</label>
                    <div class="time-input-wrapper">
                        <input class="new-entry__input custom-time-picker" type="text" name="outTime" placeholder="ЧЧ:ММ" readonly>
                        <svg class="time-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 8V12L15 15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                </div>
                <div class="new-entry__column new-entry__column-comment grid-item7"><label>Комментарий</label><textarea class="new-entry__input new-entry__input-comment" name="comment"></textarea></div>
                              <div class="new-entry__column grid-item9">
                  <label>Дата въезда</label>
                  <div class="date-input-wrapper">
                      <input class="new-entry__input custom-date-picker" type="text" name="entryDate" placeholder="ДД.ММ.ГГГГ" readonly>
                      <svg class="calendar-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M8 7V3M16 7V3M7 11H17M5 21H19C20.1046 21 21 20.1046 21 19V8C21 6.89543 20.1046 6 19 6H5C3.89543 6 3 6.89543 3 8V19C3 20.1046 3.89543 21 5 21Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                  </div>
              </div>
              <div class="new-entry__column grid-item10">
                  <label>Дата выезда</label>
                  <div class="date-input-wrapper">
                      <input class="new-entry__input custom-date-picker" type="text" name="outDate" placeholder="ДД.ММ.ГГГГ" readonly>
                      <svg class="calendar-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M8 7V3M16 7V3M7 11H17M5 21H19C20.1046 21 21 20.1046 21 19V8C21 6.89543 20.1046 6 19 6H5C3.89543 6 3 6.89543 3 8V19C3 20.1046 3.89543 21 5 21Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                  </div>
              </div>
                <button class="btn grid-item11" type="submit">Отправить</button>
                <button class="btn grid-item13" type="button" id="clearFormBtn">Очистить</button>
            </div>
        </form>
    </div>

    <div class="confirm-submit-modal" id="confirmSubmitModal">
        <div class="confirm-submit-overlay" id="confirmSubmitOverlay"></div>
        <div class="confirm-submit-content">
            <h2 class="confirm-submit-title">Подтверждение</h2>
            <p class="confirm-submit-text" id="confirmSubmitText">Вы уверены, что хотите отправить данные?</p>
            <div class="confirm-submit-actions">
                <button class="btn btn-cancel" id="confirmSubmitCancel">Отмена</button>
                <button class="btn btn-confirm" id="confirmSubmitOk">Отправить</button>
            </div>
        </div>
    </div>

    <div id="screenLoader" class="screen-loader">
        <div class="screen-loader-content">
            <div class="loading-spinner"></div>
            <div class="loader-text">Загрузка...</div>
        </div>
    </div>

</body>
</html>