$(document).ready(function() {

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
                    
                    if (brands.length === 0) {
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
    
    // Навигация стрелками
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
    
    // Закрытие при клике вне
    $(document).on('click', function(e) {
        if (!$(e.target).closest('.autocomplete-wrapper').length) {
            $list.removeClass('active').empty();
        }
    });
}

// Инициализация для всех полей марки
$(document).ready(function() {
    // Для формы на index
    $('input[name="carMake"]').each(function() {
        $(this).wrap('<div class="autocomplete-wrapper"></div>');
        initBrandAutocomplete($(this));
    });
});

// ======================== СИСТЕМА УПРАВЛЕНИЯ УВЕДОМЛЕНИЯМИ ========================

// Проверка, было ли уже показано уведомление
function hasNotificationBeenShown(notificationId) {
    return sessionStorage.getItem('notification_' + notificationId) === 'true';
}

// Отметить уведомление как показанное
function markNotificationAsShown(notificationId) {
    sessionStorage.setItem('notification_' + notificationId, 'true');
}

// Сбросить все уведомления (при необходимости)
function resetAllNotifications() {
    Object.keys(sessionStorage).forEach(function(key) {
        if (key.startsWith('notification_')) {
            sessionStorage.removeItem(key);
        }
    });
}

// Обновлённая функция showToast с проверкой
function showToast(message, type = 'success', notificationId = null) {
    // Если передан ID уведомления и оно уже было показано — не показываем снова
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
    
    // Отмечаем уведомление как показанное
    if (notificationId) {
        markNotificationAsShown(notificationId);
    }
}

    // Генерация/получение токена пользователя
    function getUserToken() {
        let token = localStorage.getItem('user_token');
        if (!token) {
            token = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('user_token', token);
        }
        return token;
    }

    const userToken = getUserToken();

    // Toast уведомления
    function showToast(message, type = 'success') {
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
    }

    // Запрет пробелов в госномере
    $("input[name='stateNumber']").on('input', function() {
        this.value = this.value.replace(/\s/g, '');
    });

    // Ограничение года в датах
    $(document).on('input', 'input[type="date"]', function() {
        const input = this;
        const value = input.value;
        if (!value) return;
        
        const dateParts = value.split('-');
        if (dateParts[0] && dateParts[0].length > 4) {
            dateParts[0] = dateParts[0].slice(0, 4);
        }
        if (dateParts[1] !== undefined) {
            if (dateParts[1].length > 2) dateParts[1] = dateParts[1].slice(0, 2);
            const month = parseInt(dateParts[1], 10);
            if (month > 12 && dateParts[1].length === 2) dateParts[1] = '12';
        }
        if (dateParts[2] !== undefined) {
            if (dateParts[2].length > 2) dateParts[2] = dateParts[2].slice(0, 2);
            const day = parseInt(dateParts[2], 10);
            if (day > 31 && dateParts[2].length === 2) dateParts[2] = '31';
        }
        
        const newValue = dateParts.join('-');
        if (input.value !== newValue) input.value = newValue;
    });

    // Отправка формы
    $("#carForm").submit(function(event) {
    event.preventDefault();

    const fullNameApplicant = $("input[name='fullNameApplicant']").val().trim();
    const carMake = $("input[name='carMake']").val().trim();
    const stateNumber = $("input[name='stateNumber']").val().trim();
    const driverLastName = $("input[name='driverLastName']").val().trim();
    const entryDate = $("#entryDate").val();
    const outDate = $("#outDate").val();
    const comment = $("textarea[name='comment']").val().trim();

    // Сбрасываем предыдущие ошибки
    clearFieldError($('#fullNameApplicant'));

    // Проверка обязательного поля ФИО
    if (!fullNameApplicant) {
        showFieldError($('#fullNameApplicant'), $('#fullNameError'));
        showToast("Пожалуйста, укажите ФИО инициатора!", 'warning', 'validation_fullname');
        return;
    }

    if (!carMake && !stateNumber && !driverLastName && !entryDate && !outDate && !comment) {
        showToast("Пожалуйста, заполните хотя бы одно дополнительное поле!", 'warning', 'validation_fields');
        return;
    }

    $.ajax({
        type: "POST",
        url: "submit_request.php",
        data: $(this).serialize() + '&user_token=' + userToken,
        dataType: 'json',
        success: function(response) {
            if (response.success) {
                showToast(response.message, 'success', 'submit_success_' + Date.now());
                $("#carForm")[0].reset();
            } else {
                showToast(response.message, 'error', 'submit_error_' + Date.now());
            }
        },
        error: function() {
            showToast("Произошла ошибка при отправке заявки.", 'error', 'submit_network_error_' + Date.now());
        }
    });
});

$("#fullNameApplicant").on('input', function() {
    if ($(this).val().trim()) {
        clearFieldError($(this));
    }
});


// Показать ошибку поля
function showFieldError($field, $errorEl) {
    $field.addClass('field-error-active');
    if ($errorEl && $errorEl.length) {
        $errorEl.addClass('visible');
    }
    
    // Shake-анимация
    $field.addClass('shake');
    setTimeout(() => {
        $field.removeClass('shake');
    }, 500);
}

// Снять ошибку поля
function clearFieldError($field) {
    $field.removeClass('field-error-active');
    const errorId = $field.attr('id') + 'Error';
    $('#' + errorId).removeClass('visible');
}

    // Очистка формы
    $("#clearFormBtn").click(function() {
        $("#carForm")[0].reset(); 
    });

    // Polling — проверка статуса заявок юзера каждые 3 секунды
    let lastCheckedRequests = {};
let isFirstLoad = true; // Флаг первой загрузки

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
                    
                    // Если статус изменился И это не первая загрузка
                    if (previousStatus !== undefined && previousStatus !== req.status) {
                        if (req.status === 'approved') {
                            showToast("Ваша заявка одобрена!", 'success');
                        } else if (req.status === 'rejected') {
                            showToast("Ваша заявка отклонена.", 'error');
                        }
                    }
                    
                    // Сохраняем текущий статус (при первой загрузке просто инициализируем)
                    lastCheckedRequests[req.id] = req.status;
                });
                
                // После первой загрузки снимаем флаг
                isFirstLoad = false;
            }
        }
    });
}

// Запускаем polling
setInterval(checkUserRequests, 3000);
checkUserRequests();
});