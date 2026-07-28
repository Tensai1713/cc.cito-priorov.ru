$(document).ready(function() {

    // ======================== ГЕНЕРАЦИЯ И СОХРАНЕНИЕ USER TOKEN ========================
    function generateUserToken() {
        let token = localStorage.getItem('user_token');
        
        if (!token) {
            const randomStr = Math.random().toString(36).substring(2, 15) + 
                             Math.random().toString(36).substring(2, 15);
            token = 'user_' + Date.now() + '_' + randomStr;
            localStorage.setItem('user_token', token);
        }
        
        return token;
    }
 const userToken = generateUserToken();


$(document).ready(function() {
    // =========================================================================
    // ПЕРЕМЕННЫЕ ДЛЯ ХРАНЕНИЯ ПРОВЕРЕННЫХ ДАННЫХ (Кодов в JS больше нет!)
    // =========================================================================
    let verifiedUserCode = '';
    let verifiedUserFullName = '';
    const $codeInputs = $('.code-input');

    // =========================================================================
    // 1. ПЕРЕКЛЮЧЕНИЕ МЕЖДУ ФОРМАМИ
    // =========================================================================
    $('#showRegisterCodeBtn').click(function(e) {
        e.preventDefault();
        $('.auth-form').hide();
        $('#codeVerificationForm').fadeIn(200);
        setTimeout(() => $codeInputs.first().focus(), 250);
    });

    $('#backToLoginFromCode').click(function() {
        $('#codeVerificationForm').hide();
        $('.auth-form').first().fadeIn(200); // Показываем форму входа
        $codeInputs.val('');
    });

    $('#backToCode').click(function() {
        $('#registrationForm').hide();
        $('#codeVerificationForm').fadeIn(200);
        $('#regLogin, #regPassword, #regPasswordConfirm').val('');
        verifiedUserCode = '';
        verifiedUserFullName = '';
    });

    // =========================================================================
    // 2. ЛОГИКА 4-Х ИНПУТОВ ДЛЯ КОДА
    // =========================================================================
    $codeInputs.on('input', function() {
        // Оставляем только цифры (динамическая проверка)
        this.value = this.value.replace(/[^0-9]/g, '');
        
        if (this.value.length === 1) {
            const nextInput = $(this).next('.code-input');
            if (nextInput.length) {
                nextInput.focus();
            } else {
                // Все 4 цифры введены, автоматически проверяем код через сервер
                checkCodeAndProceed();
            }
        }
    });

    $codeInputs.on('keydown', function(e) {
        // Обработка Backspace для возврата к предыдущему инпуту
        if (e.key === 'Backspace' && this.value === '') {
            const prevInput = $(this).prev('.code-input');
            if (prevInput.length) {
                prevInput.focus();
                prevInput.val('');
            }
        }
    });

    // Обработка вставки (Paste) 4-значного кода
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

    // =========================================================================
    // 3. AJAX ПРОВЕРКА КОДА НА СЕРВЕРЕ
    // =========================================================================
    function checkCodeAndProceed() {
        let code = '';
        $codeInputs.each(function() {
            code += $(this).val();
        });

        if (code.length !== 4) return;

        const csrfToken = $('meta[name="csrf-token"]').attr('content');
        
        // Блокируем инпуты на время запроса, чтобы пользователь не мог их менять
        $codeInputs.prop('disabled', true);

        $.ajax({
            type: "POST",
            url: "verify_code.php",
            data: { 
                code: code,
                csrf_token: csrfToken
            },
            dataType: 'json',
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-CSRF-TOKEN', csrfToken);
            },
            success: function(response) {
                $codeInputs.prop('disabled', false);
                
                if (response.success) {
                    verifiedUserCode = code;
                    verifiedUserFullName = response.full_name || 'Сотрудник';
                    showToast(`Код принят. Добро пожаловать в систему`, 'success');
                    
                    setTimeout(() => {
                        $('#codeVerificationForm').hide();
                        $('#registrationForm').fadeIn(200);
                        $('#regLogin').focus();
                        $codeInputs.val(''); // Сброс для безопасности
                    }, 800);
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

    // Вспомогательная функция для обработки ошибки ввода кода
    function handleCodeError(message) {
        showToast(message, 'error');
        $codeInputs.addClass('error');
        setTimeout(() => {
            $codeInputs.removeClass('error').val('');
            $codeInputs.first().focus();
        }, 1000);
    }

    // =========================================================================
    // 4. AJAX ОТПРАВКА ФОРМЫ РЕГИСТРАЦИИ
    // =========================================================================
    $('#registrationForm').submit(function(e) {
        e.preventDefault();
        
        const login = $('#regLogin').val().trim();
        const password = $('#regPassword').val();
        const passwordConfirm = $('#regPasswordConfirm').val();
        const csrfToken = $('meta[name="csrf-token"]').attr('content');
        
        // Клиентская валидация
        if (login.length < 3) {
            showToast('Логин должен быть не менее 3 символов', 'warning');
            return;
        }
        if (password.length !== 8) {
            showToast('Пароль должен состоять ровно из 8 символов', 'warning');
            return;
        }
        if (password !== passwordConfirm) {
            showToast('Пароли не совпадают', 'warning');
            return;
        }

        const $btn = $('#submitRegBtn');
        const originalText = $btn.text();
        $btn.text('Регистрация...').prop('disabled', true);

        $.ajax({
            type: "POST",
            url: "register.php",
            data: { 
                login: login, 
                password: password,
                code: verifiedUserCode, // Отправляем проверенный код для финальной сверки на сервере
                csrf_token: csrfToken
            },
            dataType: 'json',
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-CSRF-TOKEN', csrfToken);
            },
            success: function(response) {
                $btn.text(originalText).prop('disabled', false);
                if (response.success) {
                    showToast(response.message, 'success');
                    setTimeout(() => {
                        window.location.href = './'; // Перенаправление на форму входа
                    }, 2000);
                } else {
                    showToast(response.message, 'error');
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
});

// ==================== НЕЗАВИСИМАЯ ПРОВЕРКА ДАТЫ И ВРЕМЕНИ ====================
function validateDateTime(entryDate, entryTime, outDate, outTime) {
    const errors = [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nowMinutes = (now.getHours() * 60) + now.getMinutes();
    
    // Парсинг даты из DD.MM.YYYY
    function parseDate(dateStr) {
        if (!dateStr || !dateStr.trim()) return null;
        const parts = dateStr.trim().split('.');
        if (parts.length !== 3) return null;
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const date = new Date(year, month, day);
        return isNaN(date.getTime()) ? null : date;
    }
    
    // Парсинг времени из HH:MM в минуты от начала дня
    function parseTime(timeStr) {
        if (!timeStr || !timeStr.trim()) return null;
        const parts = timeStr.trim().split(':');
        if (parts.length !== 2) return null;
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        return (hours * 60) + minutes;
    }
    
    const eDate = parseDate(entryDate);
    const oDate = parseDate(outDate);
    const eTime = parseTime(entryTime);
    const oTime = parseTime(outTime);
    
    // 1. Дата въезда не может быть в прошлом
    if (eDate && eDate < todayStart) {
        errors.push('Проверьте дату въезда');
    }
    
    // 2. Время въезда не может быть в прошлом (НЕЗАВИСИМАЯ ПРОВЕРКА)
    // Если дата указана и это сегодня, ИЛИ если дата НЕ указана (считаем, что это сегодня)
    if (eTime !== null) {
        const isEntryToday = eDate ? (eDate.getTime() === todayStart.getTime()) : true;
        if (isEntryToday && eTime < nowMinutes) {
            errors.push('Проверьте время въезда');
        }
    }
    
    // 3. Дата выезда не может быть раньше даты въезда
    if (eDate && oDate && oDate < eDate) {
        errors.push('Проверьте дату выезда');
    }
    
    // 4. Время выезда не может быть в прошлом (НЕЗАВИСИМАЯ ПРОВЕРКА)
    if (oTime !== null) {
        const isOutToday = oDate ? (oDate.getTime() === todayStart.getTime()) : true;
        if (isOutToday && oTime < nowMinutes) {
            errors.push('Проверьте время выезда');
        }
    }
    
    // 5. Если даты совпадают (или обе не указаны), время выезда должно быть строго позже времени въезда
    const isSameDay = (eDate && oDate && eDate.getTime() === oDate.getTime()) || (!eDate && !oDate);
    if (isSameDay && eTime !== null && oTime !== null) {
        if (oTime <= eTime) {
            errors.push('Проверьте время выезда');
        }
    }
    
    return errors;
}

   

    // ======================== АВТОКОМПЛИТ МАРКИ ========================
    function initBrandAutocomplete($input) {
        const $wrapper = $input.closest('.autocomplete-wrapper');
        let $list = $wrapper.find('.autocomplete-list');
        
        if ($list.length === 0) {
            $list = $('<div class="autocomplete-list"></div>').appendTo($wrapper);
        }
        
        let activeIndex = -1;
        let debounceTimer;
        
        $input.on('input', function() {
            const query = $(this).val().trim();
            
            if (query.length < 1) {
                $list.removeClass('active').empty();
                return;
            }
            
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                $.ajax({
                    url: 'search_brands.php',
                    data: { q: query },
                    dataType: 'json',
                    success: function(brands) {
                        $list.empty();
                        
                        if (!Array.isArray(brands) || brands.length === 0) {
                            $list.removeClass('active');
                            return;
                        }
                        
                        brands.forEach((brand, index) => {
                            const regex = new RegExp(`(${query})`, 'gi');
                            const highlighted = brand.replace(regex, '<span class="highlight">$1</span>');
                            
                            const $item = $(`<div class="autocomplete-item" data-index="${index}">${highlighted}</div>`);
                            $item.on('click', function() {
                                $input.val(brand);
                                $list.removeClass('active').empty();
                            });
                            $list.append($item);
                        });
                        
                        $list.addClass('active');
                        activeIndex = -1;
                    }
                });
            }, 300);
        });
        
        $input.on('keydown', function(e) {
            const $items = $list.find('.autocomplete-item');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIndex = Math.min(activeIndex + 1, $items.length - 1);
                $items.removeClass('active').eq(activeIndex).addClass('active');
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIndex = Math.max(activeIndex - 1, 0);
                $items.removeClass('active').eq(activeIndex).addClass('active');
            } else if (e.key === 'Enter') {
                if (activeIndex >= 0 && $list.hasClass('active')) {
                    e.preventDefault();
                    $items.eq(activeIndex).click();
                }
            } else if (e.key === 'Escape') {
                $list.removeClass('active').empty();
            }
        });
        
        $(document).on('click', function(e) {
            if (!$(e.target).closest('.autocomplete-wrapper').length) {
                $list.removeClass('active').empty();
            }
        });
    }

    $('input[name="carMake"]').each(function() {
        $(this).wrap('<div class="autocomplete-wrapper"></div>');
        initBrandAutocomplete($(this));
    });


// ======================== ПРОВЕРКА ГОСНОМЕРА ========================
const PLATE_LETTERS = 'АВЕКМНОРСТУХ';
const LATIN_TO_CYRILLIC_MAP = { 'A':'А','B':'В','E':'Е','K':'К','M':'М','H':'Н','O':'О','P':'Р','C':'С','T':'Т','Y':'У','X':'Х', 'a':'А','b':'В','e':'Е','k':'К','m':'М','h':'Н','o':'О','p':'Р','c':'С','t':'Т','y':'У','x':'Х' };

function isAllowedPlateChar(char) {
    if (!char) return false;
    if (/\d/.test(char) || char === ' ') return true;
    if (PLATE_LETTERS.includes(char.toUpperCase())) return true;
    return !!(LATIN_TO_CYRILLIC_MAP[char] || LATIN_TO_CYRILLIC_MAP[char.toUpperCase()]);
}

function normalizePlateText(text) {
    if (!text) return '';
    let normalized = '';
    for (let char of text) {
        const cyrillic = LATIN_TO_CYRILLIC_MAP[char] || LATIN_TO_CYRILLIC_MAP[char.toUpperCase()];
        normalized += cyrillic ? cyrillic : (isAllowedPlateChar(char) ? char : '');
    }
    return normalized.toUpperCase();
}

$(document).on('keydown', 'input[data-type="plate-normalize"]', function(e) {
    const allowed = ['Backspace','Delete','Tab','Enter','Escape','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'];
    if (allowed.includes(e.key) || e.ctrlKey || e.metaKey) return;
    if (!isAllowedPlateChar(e.key)) { e.preventDefault(); return; }
    const cyrillic = LATIN_TO_CYRILLIC_MAP[e.key] || LATIN_TO_CYRILLIC_MAP[e.key.toUpperCase()];
    if (cyrillic && !PLATE_LETTERS.includes(e.key.toUpperCase())) {
        e.preventDefault();
        const input = this;
        const pos = input.selectionStart;
        input.value = (input.value.slice(0, pos) + cyrillic + input.value.slice(pos)).toUpperCase();
        input.setSelectionRange(pos + 1, pos + 1);
    }
});

$(document).on('input', 'input[data-type="plate-normalize"]', function() {
    const input = this;
    const pos = input.selectionStart;
    const newVal = normalizePlateText(input.value);
    if (input.value !== newVal) { input.value = newVal; input.setSelectionRange(pos, pos); }
});

$(document).on('paste', 'input[data-type="plate-normalize"]', function(e) {
    e.preventDefault();
    const input = this;
    const pasted = normalizePlateText((e.originalEvent.clipboardData || window.clipboardData).getData('text'));
    const pos = input.selectionStart;
    const newVal = normalizePlateText(input.value.slice(0, pos) + pasted + input.value.slice(pos));
    input.value = newVal;
    input.setSelectionRange(newVal.length, newVal.length);
});

    // ======================== СИСТЕМА УПРАВЛЕНИЯ УВЕДОМЛЕНИЯМИ ========================
    function hasNotificationBeenShown(notificationId) {
        return sessionStorage.getItem('notification_' + notificationId) === 'true';
    }

    function markNotificationAsShown(notificationId) {
        sessionStorage.setItem('notification_' + notificationId, 'true');
    }

    function showToast(message, type = 'success', notificationId = null) {
        if (notificationId && hasNotificationBeenShown(notificationId)) {
            return;
        }
        
        const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
        const icon = icons[type] || icons.success;
        
        const toast = $(`
            <div class="toast ${type}">
                <div class="toast-icon">${icon}</div>
                <div class="toast-message">${message}</div>
            </div>
        `);
        
        $('#toastContainer').append(toast);
        
        setTimeout(() => {
            toast.fadeOut(300, function() { $(this).remove(); });
        }, 4000);
        
        if (notificationId) {
            markNotificationAsShown(notificationId);
        }
    }

    

    // ======================== ВАЛИДАЦИЯ ПОЛЕЙ ========================
    function showFieldError($field, $errorEl) {
        $field.addClass('field-error-active');
        if ($errorEl && $errorEl.length) {
            $errorEl.addClass('visible');
        }
        
        $field.addClass('shake');
        setTimeout(() => {
            $field.removeClass('shake');
        }, 500);
    }

    function clearFieldError($field) {
        $field.removeClass('field-error-active');
        const errorId = $field.attr('id') + 'Error';
        $('#' + errorId).removeClass('visible');
    }

// ==================== МАСКА ДАТЫ ДЛЯ TEXT-ПОЛЕЙ ====================
$(document).on('input', 'input[data-type="date-mask"]', function() {
    const input = this;
    let value = input.value.replace(/\D/g, '');
    
    if (value.length > 8) value = value.slice(0, 8);
    
    let formatted = '';
    if (value.length > 0) {
        let day = value.slice(0, 2);
        if (day.length === 2) {
            const d = parseInt(day, 10);
            if (d > 31) day = '31';
            if (d < 1 && day.length === 2) day = '01';
        }
        formatted = day;
    }
    if (value.length > 2) {
        formatted += '.';
        let month = value.slice(2, 4);
        if (month.length === 2) {
            const m = parseInt(month, 10);
            if (m > 12) month = '12';
            if (m < 1 && month.length === 2) month = '01';
        }
        formatted += month;
    }
    if (value.length > 4) {
        formatted += '.';
        let year = value.slice(4, 8);
        formatted += year;
    }
    
    input.value = formatted;
});

// Разрешаем только цифры и навигацию
$(document).on('keydown', 'input[data-type="date-mask"]', function(e) {
    const allowed = [
        'Backspace', 'Delete', 'Tab', 'Enter', 'Escape',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Home', 'End'
    ];
    if (allowed.includes(e.key)) return;
    if (e.ctrlKey || e.metaKey) return;
    if (e.key < '0' || e.key > '9') {
        e.preventDefault();
    }
});

// При потере фокуса — конвертируем в формат YYYY-MM-DD для отправки
$(document).on('blur', 'input[data-type="date-mask"]', function() {
    const input = this;
    const value = input.value;
    
    if (!value) return;
    
    const parts = value.split('.');
    if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2].padStart(4, '0');
        
        // Сохраняем в скрытое поле или data-атрибут
        input.dataset.isoDate = `${year}-${month}-${day}`;
    }
});

    // ======================== ОБРАБОТЧИК ФОРМЫ ========================
    $("#carForm").submit(function(event) {
        event.preventDefault();
        
        const carMake = ($("input[name='carMake']").val() || '').trim();
        const stateNumberMain = ($("input[name='stateNumberMain']").val() || '').trim();
        const stateRegion = ($("input[name='stateRegion']").val() || '').trim();
        const driverLastName = ($("input[name='driverLastName']").val() || '').trim();
        const entryDate = ($("input[name='entryDate']").val() || '').trim();
        const outDate = ($("input[name='outDate']").val() || '').trim();
        const comment = ($("textarea[name='comment']").val() || '').trim();
        const entryTime = ($("input[name='entryTime']").val() || '').trim();
        const outTime = ($("input[name='outTime']").val() || '').trim();
        
        const finalStateNumber = stateRegion ? `${stateNumberMain} ${stateRegion}`.trim() : stateNumberMain;

        if (!carMake && !finalStateNumber && !driverLastName && !entryDate && !outDate && !comment) {
            showToast("Пожалуйста, заполните хотя бы одно дополнительное поле!", 'warning');
            return;
        }

        const dateTimeErrors = validateDateTime(entryDate, entryTime, outDate, outTime);
        if (dateTimeErrors.length > 0) {
            showToast(dateTimeErrors[0], 'warning', 'datetime_validation_' + Date.now());
            return;
        }

        // =========================================================================
        // СБОР ДАННЫХ С user_token
        // =========================================================================
        pendingSubmitData = {
            carMake: carMake,
            stateNumber: finalStateNumber,
            driverLastName: driverLastName,
            entryTime: entryTime,
            outTime: outTime,
            entryDate: entryDate,
            outDate: outDate,
            comment: comment,
            inspection: 0,
            yearRecord: 0,
            user_token: userToken 
        };
        pendingSubmitYearRecord = 0;
        
        $('#confirmSubmitText').text('Вы уверены, что хотите добавить эту запись?');
        $('#confirmSubmitOk').text('Отправить');
        $('#confirmSubmitModal').addClass('active');
    });

    // ======================== ОБРАБОТЧИКИ МОДАЛКИ ПОДТВЕРЖДЕНИЯ (ОДИН БЛОК) ========================
    $('#confirmSubmitCancel, #confirmSubmitOverlay').click(function() {
        $('#confirmSubmitModal').removeClass('active');
        pendingSubmitData = null;
    });

        $('#confirmSubmitOk').click(function() {
        if (!pendingSubmitData) return;
        
        const $btn = $(this);
        const originalText = $btn.text();
        $btn.text('Отправка...').prop('disabled', true);
        
        $.ajax({
            type: "POST",
            url: "submit_request.php", // ← ВОТ ЗДЕСЬ БЫЛО record.php
            data: pendingSubmitData,
            dataType: 'json',
            success: function(response) {
                $('#confirmSubmitModal').removeClass('active');
                $btn.text(originalText).prop('disabled', false);
                
                if (response.success) {
                    showToast(response.message, 'success', 'submit_success_' + Date.now());
                    $("#carForm")[0].reset();
                    
                    // Обновление счетчика заявок
                    let currentCount = parseInt($('#myRequestsCount').text() || 0);
                    $('#myRequestsCount').text(currentCount + 1).show();
                    
                    setTimeout(() => {
                        if (typeof checkUserRequests === 'function') {
                            checkUserRequests();
                        }
                    }, 2000);
                    
                } else {
                    showToast(response.message, 'error', 'submit_error_' + Date.now());
                }
                pendingSubmitData = null;
            },
            error: function() {
                $('#confirmSubmitModal').removeClass('active');
                $btn.text(originalText).prop('disabled', false);
                showToast("Произошла ошибка при отправке заявки.", 'error', 'submit_network_error_' + Date.now());
                pendingSubmitData = null;
            }
        });
    });

    // ======================== УПРАВЛЕНИЕ СКРОЛЛОМ МОДАЛОК ========================
    function openModal($modal) {
        $modal.addClass('active');
        $('body').addClass('modal-open');
    }

    function closeModal($modal) {
        $modal.removeClass('active');
        $('body').removeClass('modal-open');
    }



    // ======================== ОЧИСТКА ФОРМЫ ========================
    $("#clearFormBtn").click(function() {
        $("#carForm")[0].reset();
        
        $('.field-error').removeClass('visible');
        $('.required-field').removeClass('field-error-active');
        
        showToast("Форма очищена", 'info', 'form_cleared_' + Date.now());
    });

    // ======================== КНОПКА "ВАШИ ЗАЯВКИ" ========================
    $('#myRequestsBtn').click(function() {
        openMyRequestsModal();
    });

    $('#myRequestsClose').click(function() {
        $('#myRequestsModal').fadeOut(200);
    });

    $('#myRequestsOverlay').click(function() {
        $('#myRequestsModal').fadeOut(200);
    });

    function openMyRequestsModal() {
        const $list = $('#myRequestsList');
        $list.html('<div class="my-requests-loading">Загрузка...</div>');
        $('#myRequestsModal').fadeIn(200);
        
        $.ajax({
            type: "GET",
            url: "get_user_requests_list.php",
            data: { user_token: userToken },
            dataType: 'json',
            success: function(response) {
                if (response.success) {
                    renderMyRequests(response.requests);
                    updateMyRequestsCount(response.requests);
                } else {
                    $list.html('<div class="my-requests-empty">Ошибка загрузки</div>');
                }
            },
            error: function() {
                $list.html('<div class="my-requests-empty">Ошибка сети</div>');
            }
        });
    }

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    function renderMyRequests(requests) {
        const $list = $('#myRequestsList');
        $list.empty();
        
        if (requests.length === 0) {
            $list.html('<div class="my-requests-empty">У вас пока нет заявок</div>');
            return;
        }
        
        const statusMap = {
            'pending': { text: 'На рассмотрении', class: 'pending' },
            'approved': { text: 'Одобрено', class: 'approved' },
            'rejected': { text: 'Отклонено', class: 'rejected' }
        };
        
        requests.forEach(function(req) {
            const status = statusMap[req.status] || { text: req.status, class: 'pending' };
            const date = req.created_at ? new Date(req.created_at) : null;
            const dateStr = date ? date.toLocaleDateString('ru-RU', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
            }) : '—';
            const timeStr = date ? date.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            }) : '—';
            const brand = req.car_make || 'Без марки';
            
            const card = $(`
                <div class="request-card">
                    <div class="request-card-info">
                        <span class="request-card-id">#${req.id}</span>
                        <span class="request-card-brand">${escapeHtml(brand)}</span>
                        <span class="request-card-date">${dateStr} в ${timeStr}</span>
                    </div>
                    <span class="request-status ${status.class}">${status.text}</span>
                </div>
            `);
            
            $list.append(card);
        });
    }

    function updateMyRequestsCount(requests) {
        const pendingCount = requests.filter(r => r.status === 'pending').length;
        const $count = $('#myRequestsCount');
        
        if (pendingCount > 0) {
            $count.text(pendingCount).show();
        } else {
            $count.hide();
        }
    }

    // ======================== POLLING ЗАЯВОК ========================
    let lastCheckedRequests = {};
    let isFirstLoad = true;

    function checkUserRequests() {
        $.ajax({
            type: "GET",
            url: "check_user_requests.php",
            data: { user_token: userToken },
            dataType: 'json',
            success: function(response) {
                if (response.success && response.requests) {
                    response.requests.forEach(function(req) {
                        const previousStatus = lastCheckedRequests[req.id];
                        
                        if (!isFirstLoad && previousStatus !== undefined && previousStatus !== req.status) {
                            if (req.status === 'approved') {
                                showToast("Ваша заявка одобрена!", 'success');
                            } else if (req.status === 'rejected') {
                                showToast("Ваша заявка отклонена.", 'error');
                            }
                        }
                        
                        lastCheckedRequests[req.id] = req.status;
                    });
                    
                    isFirstLoad = false;
                    updateMyRequestsCount(response.requests);
                }
            }
        });
    }

    setInterval(checkUserRequests, 3000);
    checkUserRequests();

    // ======================== ЗАКРЫТИЕ ПО ESCAPE (ОДИН ОБРАБОТЧИК) ========================
    $(document).on('keydown', function(e) {
        if (e.key === 'Escape') {
            if ($('#confirmSubmitModal').hasClass('active')) {
                $('#confirmSubmitModal').removeClass('active');
                pendingSubmitData = null;
            }
            if ($('#myRequestsModal').is(':visible')) {
                $('#myRequestsModal').fadeOut(200);
            }
        }
    });

});