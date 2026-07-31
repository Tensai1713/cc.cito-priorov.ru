$(document).ready(function() {

    // =========================================================================
    // 1. ГЕНЕРАЦИЯ И СОХРАНЕНИЕ USER TOKEN
    // =========================================================================
    function generateUserToken() {
        let token = localStorage.getItem('user_token');
        if (!token) {
            const randomStr = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            token = 'user_' + Date.now() + '_' + randomStr;
            localStorage.setItem('user_token', token);
        }
        return token;
    }
    const userToken = generateUserToken();

    // =========================================================================
    // 2. ЛОГИКА РЕГИСТРАЦИИ И ПРОВЕРКИ КОДА
    // =========================================================================
    let verifiedUserCode = '';
    let verifiedUserFullName = '';
    let isForceRegister = false; // Флаг для перезаписи данных
    const $codeInputs = $('.code-input');

    $('#showRegisterCodeBtn').click(function(e) {
        e.preventDefault();
        $('.auth-form').hide();
        $('#codeVerificationForm').fadeIn(200);
        setTimeout(() => $codeInputs.first().focus(), 250);
    });

    $('#backToLoginFromCode').click(function() {
        $('#codeVerificationForm').hide();
        $('.auth-form').first().fadeIn(200);
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
                    
                    // ПРОВЕРКА: Если код уже занят, сразу показываем модалку
                    if (response.is_registered) {
                        showToast('Этот код уже был использован для регистрации.', 'warning');
                        $('#codeVerificationForm').hide();
                        $('#codeReuseModal').fadeIn(200);
                    } else {
                        showToast(`Код принят. Добро пожаловать, ${verifiedUserFullName}!`, 'success');
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

    // Отправка формы регистрации
    $('#registrationForm').submit(function(e) {
        e.preventDefault();
        const login = $('#regLogin').val().trim();
        const password = $('#regPassword').val();
        const passwordConfirm = $('#regPasswordConfirm').val();
        const csrfToken = $('meta[name="csrf-token"]').attr('content');
        
        // ИСПРАВЛЕНО: проверка на минимальную длину 8 символов
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
                force_register: isForceRegister ? 1 : 0 // ИСПРАВЛЕНО: передаем флаг перезаписи
            },
            dataType: 'json',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-CSRF-TOKEN', csrfToken); },
            success: function(response) {
                $btn.text(originalText).prop('disabled', false);
                if (response.success) {
                    showToast(response.message, 'success');
                    isForceRegister = false;
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

    // Обработчики модалок перезаписи
    $('#confirmReuseBtn').click(function() {
        isForceRegister = true;
        $('#codeReuseModal').fadeOut(200);
        $('#registrationForm').fadeIn(200);
        $('#regLogin').focus();
    });

    $('#showSecurityContactBtn').click(function(e) {
        e.preventDefault();
        $('#codeReuseModal').fadeOut(200);
        $('#securityContactModal').fadeIn(200);
    });

    $('#closeSecurityContactBtn, #securityContactOverlay').click(function() {
        $('#securityContactModal').fadeOut(200);
        $('#codeVerificationForm').fadeIn(200);
        $codeInputs.val('');
        $codeInputs.first().focus();
    });

    $('#codeReuseOverlay').click(function() {
        $('#codeReuseModal').fadeOut(200);
        $('#codeVerificationForm').fadeIn(200);
        $codeInputs.val('');
        $codeInputs.first().focus();
    });

    // =========================================================================
    // 3. НЕЗАВИСИМАЯ ПРОВЕРКА ДАТЫ И ВРЕМЕНИ
    // =========================================================================
    function validateDateTime(entryDate, entryTime, outDate, outTime) {
        const errors = [];
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const nowMinutes = (now.getHours() * 60) + now.getMinutes();
        
        function parseDate(dateStr) {
            if (!dateStr || !dateStr.trim()) return null;
            const parts = dateStr.trim().split('.');
            if (parts.length !== 3) return null;
            const date = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
            return isNaN(date.getTime()) ? null : date;
        }
        function parseTime(timeStr) {
            if (!timeStr || !timeStr.trim()) return null;
            const parts = timeStr.trim().split(':');
            if (parts.length !== 2) return null;
            return (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10);
        }
        
        const eDate = parseDate(entryDate);
        const oDate = parseDate(outDate);
        const eTime = parseTime(entryTime);
        const oTime = parseTime(outTime);
        
        if (eDate && eDate < todayStart) errors.push('Проверьте дату въезда');
        if (eTime !== null && (eDate ? (eDate.getTime() === todayStart.getTime()) : true) && eTime < nowMinutes) errors.push('Проверьте время въезда');
        if (eDate && oDate && oDate < eDate) errors.push('Проверьте дату выезда');
        if (oTime !== null && (oDate ? (oDate.getTime() === todayStart.getTime()) : true) && oTime < nowMinutes) errors.push('Проверьте время выезда');
        const isSameDay = (eDate && oDate && eDate.getTime() === oDate.getTime()) || (!eDate && !oDate);
        if (isSameDay && eTime !== null && oTime !== null && oTime <= eTime) errors.push('Проверьте время выезда');
        
        return errors;
    }

    // =========================================================================
    // 4. АВТОКОМПЛИТ МАРКИ И МАСКИ ВВОДА
    // =========================================================================
    function initBrandAutocomplete($input) {
        const $wrapper = $input.closest('.autocomplete-wrapper');
        let $list = $wrapper.find('.autocomplete-list');
        if ($list.length === 0) $list = $('<div class="autocomplete-list"></div>').appendTo($wrapper);
        let activeIndex = -1, debounceTimer;
        
        $input.on('input', function() {
            const query = $(this).val().trim();
            if (query.length < 1) { $list.removeClass('active').empty(); return; }
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                $.ajax({ url: 'search_brands.php', data: { q: query }, dataType: 'json', success: function(brands) {
                    $list.empty();
                    if (!Array.isArray(brands) || brands.length === 0) { $list.removeClass('active'); return; }
                    brands.forEach((brand, index) => {
                        const highlighted = brand.replace(new RegExp(`(${query})`, 'gi'), '<span class="highlight">$1</span>');
                        const $item = $(`<div class="autocomplete-item" data-index="${index}">${highlighted}</div>`);
                        $item.on('click', function() { $input.val(brand); $list.removeClass('active').empty(); });
                        $list.append($item);
                    });
                    $list.addClass('active'); activeIndex = -1;
                }});
            }, 300);
        });
        $input.on('keydown', function(e) {
            const $items = $list.find('.autocomplete-item');
            if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, $items.length - 1); $items.removeClass('active').eq(activeIndex).addClass('active'); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); $items.removeClass('active').eq(activeIndex).addClass('active'); }
            else if (e.key === 'Enter' && activeIndex >= 0 && $list.hasClass('active')) { e.preventDefault(); $items.eq(activeIndex).click(); }
            else if (e.key === 'Escape') { $list.removeClass('active').empty(); }
        });
        $(document).on('click', function(e) { if (!$(e.target).closest('.autocomplete-wrapper').length) $list.removeClass('active').empty(); });
    }
    $('input[name="carMake"]').each(function() { $(this).wrap('<div class="autocomplete-wrapper"></div>'); initBrandAutocomplete($(this)); });

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
            const pos = this.selectionStart;
            this.value = (this.value.slice(0, pos) + cyrillic + this.value.slice(pos)).toUpperCase();
            this.setSelectionRange(pos + 1, pos + 1);
        }
    });

    $(document).on('input', 'input[data-type="plate-normalize"]', function() {
        const pos = this.selectionStart;
        const newVal = normalizePlateText(this.value);
        if (this.value !== newVal) { this.value = newVal; this.setSelectionRange(pos, pos); }
    });

    $(document).on('paste', 'input[data-type="plate-normalize"]', function(e) {
        e.preventDefault();
        const pasted = normalizePlateText((e.originalEvent.clipboardData || window.clipboardData).getData('text'));
        const pos = this.selectionStart;
        const newVal = normalizePlateText(this.value.slice(0, pos) + pasted + this.value.slice(pos));
        this.value = newVal;
        this.setSelectionRange(newVal.length, newVal.length);
    });

    $(document).on('input', 'input[data-type="date-mask"]', function() {
        let value = this.value.replace(/\D/g, '').slice(0, 8);
        let formatted = '';
        if (value.length > 0) {
            let day = value.slice(0, 2);
            if (day.length === 2) { const d = parseInt(day, 10); if (d > 31) day = '31'; if (d < 1) day = '01'; }
            formatted = day;
        }
        if (value.length > 2) {
            formatted += '.';
            let month = value.slice(2, 4);
            if (month.length === 2) { const m = parseInt(month, 10); if (m > 12) month = '12'; if (m < 1) month = '01'; }
            formatted += month;
        }
        if (value.length > 4) { formatted += '.' + value.slice(4, 8); }
        this.value = formatted;
    });

    $(document).on('keydown', 'input[data-type="date-mask"]', function(e) {
        const allowed = ['Backspace', 'Delete', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
        if (allowed.includes(e.key) || e.ctrlKey || e.metaKey) return;
        if (e.key < '0' || e.key > '9') e.preventDefault();
    });

    $(document).on('blur', 'input[data-type="date-mask"]', function() {
        const value = this.value;
        if (!value) return;
        const parts = value.split('.');
        if (parts.length === 3) {
            this.dataset.isoDate = `${parts[2].padStart(4, '0')}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    });

    // =========================================================================
    // 5. УВЕДОМЛЕНИЯ И ВАЛИДАЦИЯ
    // =========================================================================
    function showToast(message, type = 'success', notificationId = null) {
        if (notificationId && sessionStorage.getItem('notification_' + notificationId) === 'true') return;
        const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
        const toast = $(`<div class="toast ${type}"><div class="toast-icon">${icons[type] || icons.success}</div><div class="toast-message">${message}</div></div>`);
        $('#toastContainer').append(toast);
        setTimeout(() => toast.fadeOut(300, function() { $(this).remove(); }), 5000);
        if (notificationId) sessionStorage.setItem('notification_' + notificationId, 'true');
    }

    function showFieldError($field, $errorEl) {
        $field.addClass('field-error-active shake');
        if ($errorEl && $errorEl.length) $errorEl.addClass('visible');
        setTimeout(() => $field.removeClass('shake'), 500);
    }

    function clearFieldError($field) {
        $field.removeClass('field-error-active');
        $('#' + $field.attr('id') + 'Error').removeClass('visible');
    }

    // =========================================================================
    // 6. ОБРАБОТЧИК ФОРМЫ ЗАЯВКИ (ПОЛЬЗОВАТЕЛЬ)
    // =========================================================================
    let pendingSubmitData = null;

    $("#carForm").submit(function(event) {
        event.preventDefault();
        
        const carMake = ($("input[name='carMake']").val() || '').trim();
        const stateNumber = ($("input[name='stateNumber']").val() || '').trim(); // ЕДИНОЕ ПОЛЕ
        const driverLastName = ($("input[name='driverLastName']").val() || '').trim();
        const entryDate = ($("input[name='entryDate']").val() || '').trim();
        const outDate = ($("input[name='outDate']").val() || '').trim();
        const comment = ($("textarea[name='comment']").val() || '').trim();
        const entryTime = ($("input[name='entryTime']").val() || '').trim();
        const outTime = ($("input[name='outTime']").val() || '').trim();

        if (!carMake && !stateNumber && !driverLastName && !entryDate && !outDate && !comment) {
            showToast("Пожалуйста, заполните хотя бы одно дополнительное поле!", 'warning');
            return;
        }

        const dateTimeErrors = validateDateTime(entryDate, entryTime, outDate, outTime);
        if (dateTimeErrors.length > 0) {
            showToast(dateTimeErrors[0], 'warning', 'datetime_validation_' + Date.now());
            return;
        }

        pendingSubmitData = {
            carMake: carMake,
            stateNumber: stateNumber, // ЕДИНОЕ ПОЛЕ
            driverLastName: driverLastName,
            entryTime: entryTime,
            outTime: outTime,
            entryDate: entryDate,
            outDate: outDate,
            comment: comment,
            inspection: 0,
            yearRecord: 0,
            user_token: userToken // ТОКЕН ДОБАВЛЕН
        };
        
        $('#confirmSubmitText').text('Вы уверены, что хотите добавить эту запись?');
        $('#confirmSubmitOk').text('Отправить');
        $('#confirmSubmitModal').addClass('active');
    });

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
            url: "submit_request.php",
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

    $("#clearFormBtn").click(function() {
        $("#carForm")[0].reset();
        $('.field-error').removeClass('visible');
        $('.required-field').removeClass('field-error-active');
        showToast("Форма очищена", 'info', 'form_cleared_' + Date.now());
    });

    // =========================================================================
    // 7. МОИ ЗАЯВКИ И POLLING
    // =========================================================================
    $('#myRequestsBtn').click(function() { openMyRequestsModal(); });
    $('#myRequestsClose, #myRequestsOverlay').click(function() { $('#myRequestsModal').fadeOut(200); });

    function openMyRequestsModal() {
        const $list = $('#myRequestsList');
        $list.html('<div class="my-requests-loading">Загрузка...</div>');
        $('#myRequestsModal').fadeIn(200);
        $.ajax({
            type: "GET", url: "get_user_requests_list.php", data: { user_token: userToken }, dataType: 'json',
            success: function(response) {
                if (response.success) { renderMyRequests(response.requests); updateMyRequestsCount(response.requests); } 
                else { $list.html('<div class="my-requests-empty">Ошибка загрузки</div>'); }
            },
            error: function() { $list.html('<div class="my-requests-empty">Ошибка сети</div>'); }
        });
    }

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    function renderMyRequests(requests) {
        const $list = $('#myRequestsList');
        $list.empty();
        if (requests.length === 0) { $list.html('<div class="my-requests-empty">У вас пока нет заявок</div>'); return; }
        const statusMap = { 'pending': { text: 'На рассмотрении', class: 'pending' }, 'approved': { text: 'Одобрено', class: 'approved' }, 'rejected': { text: 'Отклонено', class: 'rejected' } };
        requests.forEach(function(req) {
            const status = statusMap[req.status] || { text: req.status, class: 'pending' };
            const date = req.created_at ? new Date(req.created_at) : null;
            const dateStr = date ? date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
            const timeStr = date ? date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '—';
            const brand = req.car_make || 'Без марки';
            const card = $(`<div class="request-card"><div class="request-card-info"><span class="request-card-id">#${req.id}</span><span class="request-card-brand">${escapeHtml(brand)}</span><span class="request-card-date">${dateStr} в ${timeStr}</span></div><span class="request-status ${status.class}">${status.text}</span></div>`);
            $list.append(card);
        });
    }

    function updateMyRequestsCount(requests) {
        const pendingCount = requests.filter(r => r.status === 'pending').length;
        const $count = $('#myRequestsCount');
        if (pendingCount > 0) { $count.text(pendingCount).show(); } else { $count.hide(); }
    }

    let lastCheckedRequests = {};
    let isFirstLoad = true;

    function checkUserRequests() {
        $.ajax({
            type: "GET", url: "check_user_requests.php", data: { user_token: userToken }, dataType: 'json',
            success: function(response) {
                if (response.success && response.requests) {
                    response.requests.forEach(function(req) {
                        const previousStatus = lastCheckedRequests[req.id];
                        if (!isFirstLoad && previousStatus !== undefined && previousStatus !== req.status) {
                            if (req.status === 'approved') showToast("Ваша заявка одобрена!", 'success');
                            else if (req.status === 'rejected') showToast("Ваша заявка отклонена.", 'error');
                        }
                        lastCheckedRequests[req.id] = req.status;
                    });
                    isFirstLoad = false;
                    updateMyRequestsCount(response.requests);
                }
            }
        });
    }
    setInterval(checkUserRequests, 5000);
    checkUserRequests();

    // =========================================================================
    // 8. ЗАКРЫТИЕ ПО ESCAPE
    // =========================================================================
    $(document).on('keydown', function(e) {
        if (e.key === 'Escape') {
            if ($('#confirmSubmitModal').hasClass('active')) { $('#confirmSubmitModal').removeClass('active'); pendingSubmitData = null; }
            if ($('#myRequestsModal').is(':visible')) { $('#myRequestsModal').fadeOut(200); }
            if ($('#codeReuseModal').is(':visible')) { $('#codeReuseModal').fadeOut(200); $('#codeVerificationForm').fadeIn(200); }
            if ($('#securityContactModal').is(':visible')) { $('#securityContactModal').fadeOut(200); $('#codeVerificationForm').fadeIn(200); }
        }
    });



     // =========================================================================
    // ИНИЦИАЛИЗАЦИЯ КАСТОМНОГО КАЛЕНДАРЯ (FLATPICKR)
    // =========================================================================
    if (typeof flatpickr === 'function') {
        
        // 1. Инициализация календаря дат
        flatpickr(".custom-date-picker", {
            dateFormat: "d.m.Y",
            locale: "ru",
            allowInput: true,
            disableMobile: "true",
            onOpen: function(selectedDates, dateStr, instance) {
                const yearInput = instance.yearElements[0];
                if (yearInput) {
                    yearInput.type = 'text';
                }
            }
        });

        // 2. Инициализация выбора времени
        flatpickr(".custom-time-picker", {
            enableTime: true,
            noCalendar: true,
            dateFormat: "H:i",
            time_24hr: true,
            allowInput: true,
            disableMobile: "true",
            defaultHour: 9,
            defaultMinute: 0,
            onChange: function(selectedDates, dateStr, instance) {
                // При любом изменении состояния Flatpickr записываем в главный инпут
                if (instance.input && dateStr) {
                    instance.input.value = dateStr;
                }
            }
        });

        // 3. Клик по иконке календаря
        $(document).on('click', '.calendar-icon', function() {
            const inputElement = $(this).prev('.custom-date-picker').get(0);
            if (inputElement && inputElement._flatpickr) {
                inputElement._flatpickr.open();
            }
        });

        // 4. Клик по иконке времени
        $(document).on('click', '.time-icon', function() {
            const inputElement = $(this).prev('.custom-time-picker').get(0);
            if (inputElement && inputElement._flatpickr) {
                inputElement._flatpickr.open();
            }
        });

        // =========================================================================
        // 5. ПЕРЕКЛЮЧЕНИЕ ЦИФР КОЛЕСИКОМ МЫШИ (МАКСИМАЛЬНО НАДЕЖНАЯ ВЕРСИЯ)
        // =========================================================================
        document.addEventListener('wheel', function(e) {
            if (e.target.classList.contains('flatpickr-hour') || e.target.classList.contains('flatpickr-minute')) {
                e.preventDefault(); 
                
                const currentValue = parseInt(e.target.value) || 0;
                const isHour = e.target.classList.contains('flatpickr-hour');
                const max = isHour ? 23 : 59;
                const delta = e.deltaY < 0 ? 1 : -1;
                
                let newValue = currentValue + delta;
                if (newValue > max) newValue = 0;
                if (newValue < 0) newValue = max;
                
                // 1. Обновляем визуально поле в календаре
                e.target.value = newValue.toString().padStart(2, '0');
                
                // 2. Находим ОТКРЫТЫЙ экземпляр flatpickr (универсальный способ)
                let fp = null;
                document.querySelectorAll('.custom-time-picker').forEach(input => {
                    if (input._flatpickr && input._flatpickr.isOpen) {
                        fp = input._flatpickr;
                    }
                });

                if (fp && fp.hourElement && fp.minuteElement) {
                    // Собираем время напрямую из полей календаря
                    const h = parseInt(fp.hourElement.value) || 0;
                    const m = parseInt(fp.minuteElement.value) || 0;
                    
                    // Создаем дату (берем текущую выбранную или сегодня)
                    const d = fp.selectedDates[0] || new Date();
                    d.setHours(h, m, 0, 0);
                    
                    // Обновляем состояние flatpickr (true = вызвать onChange)
                    fp.setDate(d, true);
                }
            }
        }, { passive: false });

        // 6. ЗАПАСНОЙ ВАРИАНТ: запись при потере фокуса (клик вне календаря)
        $(document).on('blur', '.custom-time-picker', function() {
            const input = this;
            const fp = input._flatpickr;
            
            if (fp) {
                // Если есть корректные выбранные даты, используем их
                if (fp.selectedDates && fp.selectedDates.length > 0) {
                    input.value = fp.formatDate(fp.selectedDates[0], "H:i");
                } 
                // Иначе берем напрямую из полей календаря (абсолютная защита от сброса)
                else if (fp.hourElement && fp.minuteElement) {
                    const h = fp.hourElement.value.padStart(2, '0');
                    const m = fp.minuteElement.value.padStart(2, '0');
                    input.value = `${h}:${m}`;
                }
                
                $(input).trigger('change');
            }
        });
    }

});