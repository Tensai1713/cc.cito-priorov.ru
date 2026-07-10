<?php
require_once __DIR__ . '/auth_system.php';

$error = '';
$is_logged_in = isAuthorized();

// Обработка входа
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$is_logged_in) {
    $login = trim($_POST['login'] ?? '');
    $password = $_POST['password'] ?? '';
    
    if (mb_strtolower($login) === mb_strtolower(AUTH_LOGIN) && $password === AUTH_PASSWORD) {
    $_SESSION['auth_user'] = true;
    $_SESSION['auth_login'] = $login;
    $_SESSION['auth_time'] = time();
    $_SESSION['auth_last_activity'] = time();
    $_SESSION['auth_tab_token'] = bin2hex(random_bytes(16)); // ← Уникальный токен вкладки
    
    session_write_close();
    session_start();
    
    header('Location: ' . $_SERVER['PHP_SELF']);
    exit;
} else {
        $error = 'Неверный логин или пароль';
        sleep(1);
    }
}

if (!$is_logged_in) {
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Вход</title>
    <link rel="shortcut icon" href="img/favicon.ico" type="image/x-icon">
    <link rel="icon" href="img/favicon.ico" type="image/x-icon">
    <link rel="stylesheet" href="./style.css">
    <style>
        .auth-container {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }
        
        .auth-form {
            background: var(--glass-bg);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            border: 1px solid var(--glass-border);
            border-radius: 28px;
            padding: 40px;
            max-width: 400px;
            width: 100%;
            box-shadow: var(--glass-shadow);
            animation: slideUp 0.4s ease-out;
        }
        
        @keyframes slideUp {
            from { transform: translateY(50px) scale(0.95); opacity: 0; }
            to { transform: translateY(0) scale(1); opacity: 1; }
        }
        
        .auth-title {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 20px;
            background: linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-align: center;
        }
        
        .auth-subtitle {
            font-size: 16px;
            color: var(--gray-300);
            text-align: center;
            margin-bottom: 32px;
        }
        
        .auth-field {
            margin-bottom: 20px;
        }
        
        .auth-field label {
            display: block;
            font-weight: 600;
            color: var(--gray-200);
            font-size: 15px;
            margin-bottom: 8px;
            margin-left: 4px;
        }
        
        .auth-field input {
            width: 100%;
            padding: 14px 18px;
            font-size: 16px;
            border: 1px solid var(--glass-border);
            border-radius: 16px;
            background: rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(10px);
            color: var(--white);
            transition: var(--transition);
            font-family: inherit;
            box-sizing: border-box;
        }
        
        .auth-field input:focus {
            outline: none;
            background: rgba(255, 255, 255, 0.15);
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.2);
        }
        
        .auth-error {
            background: rgba(255, 59, 48, 0.15);
            border: 1px solid rgba(255, 59, 48, 0.3);
            color: var(--danger);
            padding: 12px 16px;
            border-radius: 12px;
            margin-bottom: 20px;
            font-size: 14px;
            text-align: center;
        }
        
        .auth-submit {
            width: 100%;
            padding: 16px;
            font-size: 16px;
            font-weight: 600;
            border-radius: 16px;
            cursor: pointer;
            transition: var(--transition);
            font-family: inherit;
            margin-top: 20px;
        }
        
        
        
        .auth-logo {
            display: block;
            margin: 0 auto 24px;
            max-width: 120px;
            filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
        }
    </style>
</head>
<body>
    <div class="auth-container">
        <form class="auth-form" method="POST" action="">
            <img class="auth-logo" src="./img/logo.png" alt="Logo">
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
        </form>
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
    <title>CarCheckpoint — Заявка</title>
    <link rel="shortcut icon" href="img/favicon.ico" type="image/x-icon">
    <link rel="icon" href="img/favicon.ico" type="image/x-icon">
    <link rel="stylesheet" href="./style.css">
    <script defer src="./jquery.min.js"></script>
    <script defer src="./script.js"></script>
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

<!-- КНОПКА ВЫХОДА -->
<a href="?logout=1" class="logout-btn" title="Выйти">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9M16 17L21 12M21 12L16 7M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
</a>

<div class="toast-container" id="toastContainer"></div>

<!-- КНОПКА "ВАШИ ЗАЯВКИ" -->
<button class="my-requests-btn btn" id="myRequestsBtn" title="Ваши заявки">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5M12 12H15M12 16H15M9 12H9.01M9 16H9.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span>Ваши заявки</span>
    <span class="my-requests-count" id="myRequestsCount" style="display: none;">0</span>
</button>

<!-- МОДАЛКА "ВАШИ ЗАЯВКИ" -->
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

<img class="logo" src="./img/logo.png" alt="">

<div class="new-entry">
    <form class="new-entry__panel" id="carForm">
        <h2 class="form-title">Заявка</h2>
        <p class="form-subtitle form-subtitle-alert">
            Заполните форму для подачи заявки на рассмотрение. Уведомление о статусе отобразится на этой странице.
            <span class="form-subtitle-warning">⚠️ Будьте внимательны при заполнении поля «Гос/номер»</span>
        </p>
        <div class="new-entry__inputs">
            <div class="new-entry__column grid-item1"><label>Марка</label><input class="new-entry__input" type="text" name="carMake"></div>
            <div class="new-entry__column grid-item2"><label>Гос/номер</label><input class="new-entry__input" type="text" name="stateNumber"></div>
            <div class="new-entry__column grid-item3"><label>Фамилия водителя</label><input class="new-entry__input" type="text" name="driverLastName"></div>
            <div class="new-entry__column grid-item4">
                <label>ФИО инициатора <span class="required">*</span></label>
                <input class="new-entry__input required-field" type="text" name="fullNameApplicant" id="fullNameApplicant">
                <div class="field-error" id="fullNameError">Это поле обязательно для заполнения</div>
            </div>
            <div class="new-entry__column grid-item5"><label>Время въезда</label><input class="new-entry__input" type="time" name="entryTime"></div>
            <div class="new-entry__column grid-item6"><label>Время выезда</label><input class="new-entry__input" type="time" name="outTime"></div>
            <div class="new-entry__column new-entry__column-comment grid-item7"><label>Комментарий</label><textarea class="new-entry__input new-entry__input-comment" name="comment"></textarea></div>
            <div class="new-entry__column grid-item8"><label>Без досмотра</label><input class="new-entry__input-checkbox" type="checkbox" name="inspection"></div>
            <div class="new-entry__column grid-item12"><label>Годовая запись</label><input class="new-entry__input-checkbox" type="checkbox" name="yearRecord"></div>
            <div class="new-entry__column grid-item9"><label>Дата въезда</label><input class="new-entry__input" type="text" data-type="date-mask" name="entryDate" placeholder="ДД.ММ.ГГГГ" maxlength="10"></div>
            <div class="new-entry__column grid-item10"><label>Дата выезда</label><input class="new-entry__input" type="text" data-type="date-mask" name="outDate" placeholder="ДД.ММ.ГГГГ" maxlength="10"></div>
            <button class="btn grid-item11" type="submit">Отправить</button>
            <button class="btn grid-item13" type="button" id="clearFormBtn">Очистить</button>
        </div>
    </form>
</div>

<!-- МОДАЛКА ПОДТВЕРЖДЕНИЯ ОТПРАВКИ -->
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



<script>
(function() {
    // ==================== АВТОВЫХОД ТОЛЬКО НА КЛИЕНТЕ ====================
    
    const TAB_TOKEN = '<?= $_SESSION['auth_tab_token'] ?? '' ?>';
    const TIMEOUT_MS = 15 * 60 * 1000; // 15 минут бездействия
    const CHECK_INTERVAL = 30000;      // Проверка каждые 30 секунд
    
    let logoutInProgress = false;
    
    // Функция выхода — ТОЛЬКО клиентская очистка + редирект
    function doLogout() {
        if (logoutInProgress) return;
        logoutInProgress = true;
        
        localStorage.clear();
        sessionStorage.clear();
        
        
        setTimeout(function() {
            window.location.href = './';
        }, 300);
    }
    
    // ==================== ПРОВЕРКА ПРИ ЗАГРУЗКЕ ====================
    const storedTabToken = sessionStorage.getItem('auth_tab_token');
    
    if (storedTabToken && storedTabToken !== TAB_TOKEN) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = './';
        return;
    }
    
    if (TAB_TOKEN) {
        sessionStorage.setItem('auth_tab_token', TAB_TOKEN);
    }
    
    // ==================== ТАЙМЕР БЕЗДЕЙСТВИЯ ====================
    let lastActivity = Date.now();
    
    function updateActivity() {
        lastActivity = Date.now();
    }
    
    const events = ['mousemove', 'mousedown', 'keydown', 'keypress', 'scroll', 'touchstart', 'click', 'wheel'];
    events.forEach(function(e) {
        document.addEventListener(e, updateActivity, { passive: true, capture: true });
    });
    
    function checkTimeout() {
        if (Date.now() - lastActivity > TIMEOUT_MS) {
            doLogout();
        }
    }
    
    setInterval(checkTimeout, CHECK_INTERVAL);
    
    // Предупреждение за 1 минуту
    let warned = false;
    function checkWarning() {
        if (Date.now() - lastActivity > TIMEOUT_MS - 60000 && !warned) {
            warned = true;
            if (typeof showToast === 'function') {
                showToast('Автоматический выход через 1 минуту', 'warning', 'auto_logout_warning');
            }
        }
    }
    setInterval(checkWarning, CHECK_INTERVAL);
    
    // ==================== ЗАКРЫТИЕ ВКЛАДКИ ====================
    window.addEventListener('beforeunload', function() {
        localStorage.clear();
        sessionStorage.clear();
    });
    
    window.addEventListener('pagehide', function() {
        localStorage.clear();
        sessionStorage.clear();
    });
    
})();
</script>

</body>
</html>