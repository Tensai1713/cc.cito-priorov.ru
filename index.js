$(document).ready(function() {
    // =========================================================================
    // 1. ЛОГИКА ПРОВЕРКИ КОДА И ПЕРЕКЛЮЧЕНИЯ ФОРМ
    // =========================================================================
    let verifiedUserCode = '';
    let verifiedUserFullName = '';
    let isForceRegister = false; // Флаг для перезаписи данных
    const $codeInputs = $('.code-input');

    // Переключение форм
    $('#showRegisterCodeBtn').click(function(e) {
        e.preventDefault();
        $('#loginForm').hide();
        $('#codeVerificationForm').fadeIn(200);
        setTimeout(() => $codeInputs.first().focus(), 250);
    });

    $('#backToLoginFromCode').click(function() {
        $('#codeVerificationForm').hide();
        $('#loginForm').fadeIn(200);
        $codeInputs.val('');
    });

    $('#backToCode').click(function() {
        $('#registrationForm').hide();
        $('#codeVerificationForm').fadeIn(200);
        $('#regLogin, #regPassword, #regPasswordConfirm').val('');
        verifiedUserCode = '';
        verifiedUserFullName = '';
        isForceRegister = false;
    });

    // Ввод кода (только цифры, автопереход)
    $codeInputs.on('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '');
        if (this.value.length === 1) {
            const nextInput = $(this).next('.code-input');
            if (nextInput.length) {
                nextInput.focus();
            } else {
                checkCodeAndProceed();
            }
        }
    });

    $codeInputs.on('keydown', function(e) {
        if (e.key === 'Backspace' && this.value === '') {
            const prevInput = $(this).prev('.code-input');
            if (prevInput.length) {
                prevInput.focus();
                prevInput.val('');
            }
        }
    });

    $codeInputs.on('paste', function(e) {
        e.preventDefault();
        const pasteData = (e.originalEvent.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '').slice(0, 4);
        if (pasteData.length === 4) {
            $codeInputs.each(function(index) {
                $(this).val(pasteData[index]);
            });
            checkCodeAndProceed();
        }
    });

    // AJAX проверка кода
    function checkCodeAndProceed() {
        let code = '';
        $codeInputs.each(function() { code += $(this).val(); });
        if (code.length !== 4) return;

        const csrfToken = $('meta[name="csrf-token"]').attr('content');
        $codeInputs.prop('disabled', true);

        $.ajax({
            type: "POST",
            url: "verify_code.php",
            data: { code: code, csrf_token: csrfToken },
            dataType: 'json',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-CSRF-TOKEN', csrfToken); },
            success: function(response) {
                $codeInputs.prop('disabled', false);
                if (response.success) {
                    verifiedUserCode = code;
                    verifiedUserFullName = response.full_name || 'Сотрудник';
                    
                    // === ГЛАВНОЕ ИЗМЕНЕНИЕ ЗДЕСЬ ===
                    if (response.is_registered) {
                        // Код уже использован! СРАЗУ показываем модалку
                        $('#codeVerificationForm').hide();
                        $('#codeReuseModal').fadeIn(200);
                    } else {
                        // Код новый, идем к стандартной регистрации
                        showToast(`Код принят. Добро пожаловать в систему`, 'success');
                        $('#codeVerificationForm').hide();
                        $('#registrationForm').fadeIn(200);
                        $('#regLogin').focus();
                        $codeInputs.val('');
                    }
                } else {
                    handleCodeError(response.message || 'Неверный код идентификации');
                }
            },
            error: function(xhr) {
                $codeInputs.prop('disabled', false);
                let errorMsg = "Ошибка сети при проверке кода";
                if (xhr.status === 403) errorMsg = "Ошибка безопасности. Обновите страницу.";
                else if (xhr.responseJSON && xhr.responseJSON.message) errorMsg = xhr.responseJSON.message;
                handleCodeError(errorMsg);
            }
        });
    }

    function handleCodeError(message) {
        showToast(message, 'error');
        $codeInputs.addClass('error');
        setTimeout(() => {
            $codeInputs.removeClass('error').val('');
            $codeInputs.first().focus();
        }, 1000);
    }

    // =========================================================================
    // 2. ОТПРАВКА ФОРМЫ РЕГИСТРАЦИИ
    // =========================================================================
    $('#registrationForm').submit(function(e) {
        e.preventDefault();
        
        const login = $('#regLogin').val().trim();
        const password = $('#regPassword').val();
        const passwordConfirm = $('#regPasswordConfirm').val();
        const csrfToken = $('meta[name="csrf-token"]').attr('content');
        
        if (login.length < 3) { showToast('Логин должен быть не менее 3 символов', 'warning'); return; }
        if (password.length < 8) { showToast('Пароль должен состоять не менее чем из 8 символов', 'warning'); return; }
        if (password !== passwordConfirm) { showToast('Пароли не совпадают', 'warning'); return; }

        const $btn = $('#submitRegBtn');
        const originalText = $btn.text();
        $btn.text('Регистрация...').prop('disabled', true);

        $.ajax({
            type: "POST",
            url: "register.php",
            data: { 
                login: login, 
                password: password,
                code: verifiedUserCode, 
                csrf_token: csrfToken,
                force_register: isForceRegister ? 1 : 0 
            },
            dataType: 'json',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-CSRF-TOKEN', csrfToken); },
            success: function(response) {
                $btn.text(originalText).prop('disabled', false);
                
                if (response.success) {
                    showToast(response.message, 'success');
                    isForceRegister = false; // Сбрасываем флаг
                    setTimeout(() => { window.location.href = './'; }, 2000);
                } else {
                    showToast(response.message || 'Ошибка регистрации', 'error');
                }
            },
            error: function(xhr) {
                $btn.text(originalText).prop('disabled', false);
                let errorMsg = "Ошибка сети при регистрации";
                if (xhr.status === 403) errorMsg = "Ошибка безопасности. Обновите страницу.";
                else if (xhr.responseJSON && xhr.responseJSON.message) errorMsg = xhr.responseJSON.message;
                showToast(errorMsg, 'error');
            }
        });
    });

    // =========================================================================
    // 3. ОБРАБОТЧИКИ МОДАЛОК
    // =========================================================================
    
    // 1. Нажатие "Да, хочу" -> Показываем форму регистрации для ввода новых данных
    $('#confirmReuseBtn').click(function() {
        isForceRegister = true; // Устанавливаем флаг перезаписи
        $('#codeReuseModal').fadeOut(200);
        $('#registrationForm').fadeIn(200);
        $('#regLogin').focus();
    });

    // 2. Нажатие на ссылку "Возникли вопросы?"
    $('#showSecurityContactBtn').click(function(e) {
        e.preventDefault();
        $('#codeReuseModal').fadeOut(200);
        $('#securityContactModal').fadeIn(200);
    });

    // 3. Закрытие модалки безопасности и возврат к вводу кода
    $('#closeSecurityContactBtn, #securityContactOverlay').click(function() {
        $('#securityContactModal').fadeOut(200);
        $('#codeVerificationForm').fadeIn(200);
        $codeInputs.val('');
        $codeInputs.first().focus();
    });

    // 4. Закрытие модалки подтверждения по клику на фон (возврат к вводу кода)
    $('#codeReuseOverlay').click(function() {
        $('#codeReuseModal').fadeOut(200);
        $('#codeVerificationForm').fadeIn(200);
        $codeInputs.val('');
        $codeInputs.first().focus();
    });

    // =========================================================================
    // 4. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    // =========================================================================
    function showToast(message, type = 'success') {
        if ($('#toastContainer').length === 0) $('body').append('<div class="toast-container" id="toastContainer"></div>');
        const colors = { 
            success: 'rgba(37, 248, 90, 0.95)', 
            error: 'rgba(255, 59, 48, 0.95)', 
            warning: 'rgba(255, 204, 0, 0.95)' 
        };
        const toast = $(`<div style="position: fixed; top: 30px; right: 30px; padding: 16px 24px; border-radius: 12px; color: white; font-weight: 500; z-index: 9999; animation: slideUp 0.3s ease; background: ${colors[type]}; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2);">${message}</div>`);
        $('#toastContainer').append(toast);
        setTimeout(() => toast.fadeOut(300, function() { $(this).remove(); }), 5000);
    }

    // =========================================================================
    // 5. ТАЙМЕР НЕАКТИВНОСТИ
    // =========================================================================
    const isPhpAuthorized = $('meta[name="is-authorized"]').attr('content') === 'true';
    const urlParams = new URLSearchParams(window.location.search);
    const isFreshLogin = urlParams.has('login_success');

    if (isPhpAuthorized) {
        if (!isFreshLogin && sessionStorage.getItem('tab_is_active') !== 'true') {
            window.location.replace('./?force_logout=1');
        }
    }

    if (isPhpAuthorized) {
        sessionStorage.setItem('tab_is_active', 'true');
        if (isFreshLogin) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        const TAB_INACTIVITY_TIMEOUT = 15 * 60 * 1000;
        let inactivityTimer = null;
        let isLoggingOut = false;

        function doLogout() {
            if (isLoggingOut) return;
            isLoggingOut = true;
            sessionStorage.removeItem('tab_is_active');
            window.location.replace('./?force_logout=1');
        }

        function startInactivityTimer() {
            if (inactivityTimer) clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(doLogout, TAB_INACTIVITY_TIMEOUT);
        }

        function stopInactivityTimer() {
            if (inactivityTimer) { clearTimeout(inactivityTimer); inactivityTimer = null; }
        }

        document.addEventListener('visibilitychange', function() {
            if (document.hidden) { startInactivityTimer(); } else { stopInactivityTimer(); }
        });

        function resetTimerOnActivity() {
            if (!document.hidden) { stopInactivityTimer(); }
        }

        ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'].forEach(function(evt) {
            document.addEventListener(evt, resetTimerOnActivity, { passive: true });
        });
    }
});