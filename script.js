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


// ======================== МАСКА ГОСНОМЕРА РФ (СТРОГАЯ ПО ПОЗИЦИЯМ) ========================

// Разрешённые буквы (только те, что совпадают с латиницей)
const PLATE_LETTERS = 'АВЕКМНОРСТУХ';

// Формат: Б ЦЦЦ ББ [пробел] ЦЦЦ
// Позиции: 0=буква, 1-3=цифры, 4-5=буквы, 6=пробел, 7-9=цифры региона

function applyPlateMask(value) {
    value = value.toUpperCase();
    let result = '';
    
    // Извлекаем все валидные символы из ввода
    const letters = [];
    const digits = [];
    
    for (let char of value) {
        if (PLATE_LETTERS.includes(char)) {
            letters.push(char);
        } else if (/\d/.test(char)) {
            digits.push(char);
        }
    }
    
    // Собираем результат строго по позициям
    let letterIndex = 0;
    let digitIndex = 0;
    
    // Позиция 0: первая буква
    if (letterIndex < letters.length) {
        result += letters[letterIndex++];
    }
    
    // Позиции 1-3: три цифры
    for (let i = 0; i < 3; i++) {
        if (digitIndex < digits.length) {
            result += digits[digitIndex++];
        } else {
            break;
        }
    }
    
    // Позиции 4-5: вторая и третья буквы
    for (let i = 0; i < 2; i++) {
        if (letterIndex < letters.length) {
            result += letters[letterIndex++];
        } else {
            break;
        }
    }
    
    // Если основной номер полный (6 символов) и есть ещё цифры — добавляем пробел и регион
    if (result.length === 6 && digitIndex < digits.length) {
        result += ' '; // Автоматический пробел
        
        // Позиции 7-9: до 3 цифр региона
        for (let i = 0; i < 3; i++) {
            if (digitIndex < digits.length) {
                result += digits[digitIndex++];
            } else {
                break;
            }
        }
    }
    
    return result;
}

// Определяем, какой тип символа разрешён на текущей позиции курсора
function getAllowedTypeAtPosition(position) {
    if (position === 0) return 'letter';           // Позиция 0: буква
    if (position >= 1 && position <= 3) return 'digit'; // Позиции 1-3: цифры
    if (position === 4 || position === 5) return 'letter'; // Позиции 4-5: буквы
    if (position === 6) return 'space';            // Позиция 6: пробел (автоматический)
    if (position >= 7 && position <= 9) return 'digit'; // Позиции 7-9: цифры региона
    return null;
}

// Обработчик ввода
$(document).on('input', 'input[data-type="plate-mask"]', function() {
    const $input = $(this);
    const cursorPos = this.selectionStart;
    const oldValue = $input.val();
    const newValue = applyPlateMask(oldValue);
    
    $input.val(newValue);
    
    // Восстанавливаем позицию курсора
    const diff = newValue.length - oldValue.length;
    const newPos = Math.max(0, Math.min(cursorPos + diff, newValue.length));
    this.setSelectionRange(newPos, newPos);
});

// Блокировка запрещённых символов ДО ввода
$(document).on('keydown', 'input[data-type="plate-mask"]', function(e) {
    // Разрешаем служебные клавиши
    const allowed = [
        'Backspace', 'Delete', 'Tab', 'Enter', 'Escape',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Home', 'End'
    ];
    
    if (allowed.includes(e.key)) return;
    if (e.ctrlKey || e.metaKey) return;
    
    const input = this;
    const cursorPos = input.selectionStart;
    const currentValue = input.value;
    const char = e.key.toUpperCase();
    
    // Если курсор на позиции 6 (где должен быть пробел) и вводится цифра
    if (cursorPos === 6 && currentValue.length === 6 && /\d/.test(char)) {
        e.preventDefault();
        // Автоматически добавляем пробел + цифру
        const newValue = currentValue + ' ' + char;
        input.value = newValue;
        input.setSelectionRange(8, 8); // Курсор после цифры региона
        return;
    }
    
    // Определяем, что можно вводить на текущей позиции
    const allowedType = getAllowedTypeAtPosition(cursorPos);
    
    if (!allowedType) {
        e.preventDefault();
        return;
    }
    
    if (allowedType === 'letter') {
        if (!PLATE_LETTERS.includes(char)) {
            e.preventDefault();
        }
    } else if (allowedType === 'digit') {
        if (!/\d/.test(char)) {
            e.preventDefault();
        }
    } else if (allowedType === 'space') {
        // Пробел в позиции 6 вставляется автоматически
        e.preventDefault();
    }
});

// При вставке (paste) — обрабатываем через applyPlateMask
$(document).on('paste', 'input[data-type="plate-mask"]', function(e) {
    e.preventDefault();
    const pastedText = (e.originalEvent.clipboardData || window.clipboardData).getData('text');
    const $input = $(this);
    const cursorPos = this.selectionStart;
    const currentValue = $input.val();
    
    // Вставляем вставленный текст в текущую позицию
    const newValue = currentValue.slice(0, cursorPos) + pastedText + currentValue.slice(cursorPos);
    const maskedValue = applyPlateMask(newValue);
    
    $input.val(maskedValue);
    
    // Устанавливаем курсор в конец
    this.setSelectionRange(maskedValue.length, maskedValue.length);
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

        const fullNameApplicant = $("input[name='fullNameApplicant']").val();
        const carMake = $("input[name='carMake']").val();
        const stateNumber = $("input[name='stateNumber']").val();
        const driverLastName = $("input[name='driverLastName']").val();
        const entryDate = $("input[name='entryDate']").val();
        const outDate = $("input[name='outDate']").val();
        const comment = $("textarea[name='comment']").val();

        const fullNameTrimmed = fullNameApplicant ? fullNameApplicant.trim() : '';
        const carMakeTrimmed = carMake ? carMake.trim() : '';
        const stateNumberTrimmed = stateNumber ? stateNumber.trim() : '';
        const driverLastNameTrimmed = driverLastName ? driverLastName.trim() : '';
        const commentTrimmed = comment ? comment.trim() : '';

        clearFieldError($('#fullNameApplicant'));

        if (!fullNameTrimmed) {
            showFieldError($('#fullNameApplicant'), $('#fullNameError'));
            showToast("Пожалуйста, укажите ФИО инициатора!", 'warning');
            $("input[name='fullNameApplicant']").focus();
            return;
        }

        if (!carMakeTrimmed && !stateNumberTrimmed && !driverLastNameTrimmed && !entryDate && !outDate && !commentTrimmed) {
            showToast("Пожалуйста, заполните хотя бы одно дополнительное поле!", 'warning');
            return;
        }

        // Сохраняем данные
        pendingSubmitData = {
            user_token: userToken,
            carMake: carMakeTrimmed,
            stateNumber: stateNumberTrimmed,
            driverLastName: driverLastNameTrimmed,
            fullNameApplicant: fullNameTrimmed,
            entryTime: $("input[name='entryTime']").val() || '',
            outTime: $("input[name='outTime']").val() || '',
            entryDate: entryDate || '',
            outDate: outDate || '',
            comment: commentTrimmed,
            inspection: $("input[name='inspection']").is(':checked') ? 1 : 0,
            yearRecord: $("input[name='yearRecord']").is(':checked') ? 1 : 0
        };

        // Показываем модалку подтверждения
        $('#confirmSubmitText').text('Вы уверены, что хотите отправить заявку на рассмотрение?');
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
            url: "submit_request.php",  // ✅ ПРАВИЛЬНО для index
            data: pendingSubmitData,
            dataType: 'json',
            success: function(response) {
                $('#confirmSubmitModal').removeClass('active');
                $btn.text(originalText).prop('disabled', false);
                
                if (response.success) {
                    showToast(response.message, 'success', 'submit_success_' + Date.now());
                    $("#carForm")[0].reset();
                    clearFieldError($('#fullNameApplicant'));
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

    // ======================== ОЧИСТКА ОШИБОК ПРИ ВВОДЕ ========================
    $("#fullNameApplicant").on('input', function() {
        if ($(this).val().trim()) {
            clearFieldError($(this));
        }
    });

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