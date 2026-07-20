$(document).ready(function() {

    // =========================================================================
    // 1. БЕЗОПАСНОСТЬ И СЕССИЯ (HEARTBEAT & CSRF)
    // =========================================================================
    (function() {
        function sendHeartbeat() {
            fetch('./heartbeat.php', {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-store'
            })
            .then(response => {
                if (response.status === 401 || response.status === 403) {
                    window.location.href = './';
                    return null;
                }
                return response.json();
            })
            .then(data => {
                if (data && data.success && data.csrf_token) {
                    $('meta[name="csrf-token"]').attr('content', data.csrf_token);
                    window.csrfToken = data.csrf_token;
                }
            })
            .catch(() => {});
        }
        sendHeartbeat();
        setInterval(sendHeartbeat, 5 * 60 * 1000);
    })();

    const csrfToken = $('meta[name="csrf-token"]').attr('content');
    $.ajaxSetup({
        beforeSend: function(xhr, settings) {
            if (settings.type === 'POST') {
                xhr.setRequestHeader('X-CSRF-TOKEN', csrfToken || window.csrfToken);
            }
        }
    });

    // =========================================================================
    // 2. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
    // =========================================================================
    let pendingSubmitData = null;
    let pendingSubmitYearRecord = 0;
    let deleteId = null;
    let currentRequests = [];
    let currentRequestId = null;
    let lastRequestCount = 0;
    let searchTimer;
    let resizeTimer;





    // =========================================================================
// ЗАЩИТА ОТ ПОТЕРИ ДАННЫХ ПРИ ЗАКРЫТИИ/ОБНОВЛЕНИИ ВКЛАДКИ
// =========================================================================
let hasUnsavedChanges = false;

// Отслеживаем изменения в формах
$(document).on('input change', '.new-entry__input, .new-entry__input-comment, .new-entry__input-checkbox', function() {
    hasUnsavedChanges = true;
});

// Отслеживаем включение режима редактирования
$(document).on('click', '.edit-btn', function() {
    hasUnsavedChanges = true;
});

// Отслеживаем изменения чекбоксов в таблицах
$(document).on('change', '.table-check', function() {
    hasUnsavedChanges = true;
});

// Сбрасываем флаг при успешном сохранении формы
$(document).on('click', '#confirmSubmitOk', function() {
    // Флаг сбросится после успешной отправки (в success callback)
});

// Сбрасываем флаг при успешном сохранении записи в таблице
$(document).on('click', '.save-btn', function() {
    // Флаг сбросится после успешного сохранения (в success callback)
});

// Браузерный alert при попытке закрыть/обновить вкладку
window.addEventListener('beforeunload', function(e) {
    if (hasUnsavedChanges) {
        const message = 'У вас есть несохранённые изменения. Вы уверены, что хотите покинуть страницу?';
        e.returnValue = message;
        return message;
    }
});

    // =========================================================================
    // 3. УТИЛИТЫ И УВЕДОМЛЕНИЯ
    // =========================================================================
    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    function hasNotificationBeenShown(notificationId) {
        return sessionStorage.getItem('notification_' + notificationId) === 'true';
    }

    function markNotificationAsShown(notificationId) {
        sessionStorage.setItem('notification_' + notificationId, 'true');
    }

    function showToast(message, type = 'success', notificationId = null) {
        if (notificationId && hasNotificationBeenShown(notificationId)) return;
        
        const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
        const toast = $(`
            <div class="toast ${type}">
                <div class="toast-icon">${icons[type] || icons.success}</div>
                <div class="toast-message">${message}</div>
            </div>
        `);
        
        $('#toastContainer').append(toast);
        setTimeout(() => toast.fadeOut(300, function() { $(this).remove(); }), 3000);
        
        if (notificationId) markNotificationAsShown(notificationId);
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
    // 4. UI ТАБЛИЦЫ: PLACEHOLDER'Ы И TOOLTIP'Ы
    // =========================================================================
    function refreshTableUI() {
        // 1. Управление placeholder'ами
        $('.table-row:not(.editing) .edit-field[placeholder]').each(function() {
            const $field = $(this);
            if (!$field.data('original-placeholder')) {
                $field.data('original-placeholder', $field.attr('placeholder'));
            }
            $field.attr('placeholder', '');
        });

        // 2. Управление tooltip'ами и чекбоксами
        $('.table-cell .edit-field').not('.table-check').each(function() {
            const $field = $(this);
            let $wrapper = $field.parent('.field-tooltip-wrapper');
            if ($wrapper.length === 0) {
                $field.wrap('<span class="field-tooltip-wrapper"></span>');
                $wrapper = $field.parent('.field-tooltip-wrapper');
            }
            
            function updateTooltip() {
                let value = $field.val();
                if (!value || value.trim() === '') {
                    $wrapper.removeAttr('data-tooltip');
                    return;
                }
                value = value.trim();
                
                // Проверка переполнения
                let isOverflowing = false;
                try {
                    if ($field[0].tagName === 'TEXTAREA') {
                        isOverflowing = $field[0].scrollHeight > $field[0].clientHeight + 2;
                    } else {
                        const style = window.getComputedStyle($field[0]);
                        const clone = document.createElement('span');
                        clone.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${style.font};padding:0;margin:0;border:none;`;
                        clone.textContent = value;
                        document.body.appendChild(clone);
                        const textWidth = clone.offsetWidth;
                        document.body.removeChild(clone);
                        const availableWidth = $field[0].clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
                        isOverflowing = textWidth > availableWidth + 2;
                    }
                } catch (e) {}

                if (isOverflowing) {
                    $wrapper.attr('data-tooltip', value);
                } else {
                    $wrapper.removeAttr('data-tooltip');
                }
            }
            updateTooltip();
            $field.off('input.tooltip change.tooltip').on('input.tooltip change.tooltip', updateTooltip);
        });

        // 3. Кастомные чекбоксы
        $('.table-row').each(function() {
            const $row = $(this);
            const isEditing = $row.hasClass('editing');
            $row.find('.table-check').each(function() {
                const $cell = $(this).closest('.table-cell');
                if (!isEditing) {
                    $cell.addClass('checkbox-cell');
                    $cell.toggleClass('checkbox-checked', $(this).prop('checked'));
                } else {
                    $cell.removeClass('checkbox-cell checkbox-checked');
                }
            });
        });
    }

    $(document).on('click', '.edit-btn', function() {
        $(this).closest('tr').find('.edit-field').each(function() {
            const orig = $(this).data('original-placeholder');
            if (orig) $(this).attr('placeholder', orig);
        });
    });

    $(document).on('click', '.save-btn', function() {
        $(this).closest('tr').find('.edit-field[placeholder]').attr('placeholder', '');
    });

    $(window).on('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(refreshTableUI, 250);
    });

    // =========================================================================
    // 5. МАСКА ДАТЫ
    // =========================================================================
    $(document).on('input', 'input[data-type="date-mask"]', function() {
        let value = this.value.replace(/\D/g, '');
        if (value.length > 8) value = value.slice(0, 8);
        let formatted = '';
        if (value.length > 0) {
            let day = value.slice(0, 2);
            if (day.length === 2) day = (parseInt(day, 10) > 31) ? '31' : ((parseInt(day, 10) < 1) ? '01' : day);
            formatted = day;
        }
        if (value.length > 2) {
            formatted += '.';
            let month = value.slice(2, 4);
            if (month.length === 2) month = (parseInt(month, 10) > 12) ? '12' : ((parseInt(month, 10) < 1) ? '01' : month);
            formatted += month;
        }
        if (value.length > 4) {
            formatted += '.' + value.slice(4, 8);
        }
        this.value = formatted;
    });

    $(document).on('keydown', 'input[data-type="date-mask"]', function(e) {
        const allowed = ['Backspace', 'Delete', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
        if (allowed.includes(e.key) || e.ctrlKey || e.metaKey) return;
        if (e.key < '0' || e.key > '9') e.preventDefault();
    });

    $(document).on('blur', 'input[data-type="date-mask"]', function() {
        if (!this.value) return;
        const parts = this.value.split('.');
        if (parts.length === 3) {
            this.dataset.isoDate = `${parts[2].padStart(4, '0')}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    });

    // =========================================================================
    // 6. РАБОТА С ЗАЯВКАМИ (PENDING)
    // =========================================================================
    function loadPendingRequests() {
        $.ajax({
            type: "GET",
            url: "get_pending_requests.php",
            dataType: 'json',
            success: function(response) {
                if (response.success) {
                    currentRequests = response.requests;
                    const count = response.count;
                    if (count > lastRequestCount && lastRequestCount > 0) {
                        showToast('Поступила новая заявка!', 'info');
                    }
                    lastRequestCount = count;
                    updateMessageUI(count);
                }
            }
        });
    }

    function updateMessageUI(count) {
        const $wrapper = $('#messageWrapper');
        if (count > 0) {
            $wrapper.show();
            $('#messageBadge').text(count);
            $('#messageText').text(count === 1 ? '1 новая заявка' : (count < 5 ? count + ' новые заявки' : count + ' новых заявок'));
            $('#messageCard').addClass('pulse');
        } else {
            $wrapper.hide();
            $('#messageCard').removeClass('pulse');
        }
    }

    function openRequestsList() {
        const $list = $('#requestsList').empty();
        if (currentRequests.length === 0) {
            $list.html('<div class="empty-list">Нет заявок</div>');
        } else {
            currentRequests.forEach(function(req) {
                const date = req.created_at ? new Date(req.created_at).toLocaleString('ru-RU') : '';
                const title = req.full_name_applicant || 'Без ФИО';
                const item = $(`
                    <div class="request-list-item" data-id="${req.id}">
                        <div class="request-list-item-header">
                            <span class="request-list-item-title">${escapeHtml(title)}</span>
                            <span class="request-list-item-date">${date}</span>
                        </div>
                        <div class="request-list-item-body">
                            ${req.car_make ? '<span class="request-tag">' + escapeHtml(req.car_make) + '</span>' : ''}
                            ${req.state_number ? '<span class="request-tag">' + escapeHtml(req.state_number) + '</span>' : ''}
                            ${req.driver_last_name ? '<span class="request-tag">👤 ' + escapeHtml(req.driver_last_name) + '</span>' : ''}
                            <span class="request-tag request-tag-id">#${req.id}</span>
                        </div>
                    </div>
                `);
                item.click(() => openRequestDetail(req.id));
                $list.append(item);
            });
        }
        $('#requestsListModal').fadeIn(200);
    }

    function openRequestDetail(id) {
        $.ajax({
            type: "GET",
            url: "get_request_details.php",
            data: { id: id },
            dataType: 'json',
            success: function(response) {
                if (response.success) {
                    const req = response.request;
                    currentRequestId = id;
                    $('#requestId').text(req.full_name_applicant || 'Заявка без ФИО');
                    const $body = $('#requestDetailBody').empty();
                    
                    const fields = [
                        { label: 'Марка', value: req.car_make },
                        { label: 'Гос/номер', value: req.state_number },
                        { label: 'Фамилия водителя', value: req.driver_last_name },
                        { label: 'ФИО инициатора', value: req.full_name_applicant },
                        { label: 'Время въезда', value: req.entry_time },
                        { label: 'Время выезда', value: req.out_time },
                        { label: 'Дата въезда', value: req.entry_date },
                        { label: 'Дата выезда', value: req.out_date },
                        { label: 'Комментарий', value: req.comment },
                        { label: 'Без досмотра', value: req.inspection == 1 ? 'Да' : 'Нет' },
                        { label: 'Годовая запись', value: req.year_record == 1 ? 'Да' : 'Нет' },
                        { label: 'IP адрес', value: req.ip_address },
                        { label: 'Дата подачи', value: req.created_at ? new Date(req.created_at).toLocaleString('ru-RU') : '' }
                    ];

                    fields.forEach(f => {
                        if (f.value && f.value !== '' && f.value !== '0000-00-00' && f.value !== '00:00:00') {
                            $body.append(`<div class="detail-row"><span class="detail-label">${f.label}</span><span class="detail-value">${escapeHtml(String(f.value))}</span></div>`);
                        }
                    });
                    $('#requestsListModal').fadeOut(200, () => $('#requestDetailModal').fadeIn(200));
                } else {
                    showToast(response.message, 'error');
                }
            }
        });
    }

    function processRequest(id, action) {
        $.ajax({
            type: "POST",
            url: "process_request.php",
            data: { id: id, action: action },
            dataType: 'json',
            success: function(response) {
                if (response.success) {
                    showToast(response.message, action === 'approve' ? 'success' : 'warning', 'request_' + action + '_' + id);
                    $('#requestDetailModal').fadeOut(200);
                    loadPendingRequests();
                    updateTableIfVisible();
                } else {
                    showToast(response.message, 'error', 'request_error_' + id);
                }
            },
            error: function(xhr) {
                if (xhr.status === 403) {
                    showToast("Сессия обновляется. Повторите действие.", 'warning');
                    setTimeout(() => location.reload(), 1500);
                } else {
                    showToast("Ошибка при обработке заявки", 'error', 'request_network_error_' + id);
                }
            }
        });
    }

    $('#messageCard').click(openRequestsList);
    $('#closeListBtn').click(() => $('#requestsListModal').fadeOut(200));
    $('#closeDetailBtn').click(() => $('#requestDetailModal').fadeOut(200));
    $('#approveBtn').click(() => currentRequestId && processRequest(currentRequestId, 'approve'));
    $('#rejectBtn').click(() => currentRequestId && processRequest(currentRequestId, 'reject'));

    // =========================================================================
    // 7. ЗАГРУЗКА И ПОИСК В ТАБЛИЦАХ
    // =========================================================================
    function updateTableIfVisible() {
        if ($('.choice').is(':visible')) return;
        if ($('.new-entry.search').is(':visible')) performSearch();
        else if ($('.new-entry:not(.search)').is(':visible')) loadLastRecords();
    }

    function showTableLoader() {
        const loaderHtml = `
            <div class="table-loader" id="tableLoader">
                <div class="skeleton-table">
                    <div class="skeleton-header">${Array(12).fill('').map(() => `<div class="skeleton-cell"><div class="skeleton-block medium"></div></div>`).join('')}</div>
                    ${Array(5).fill('').map(() => `
                        <div class="skeleton-row">
                            <div class="skeleton-cell"><div class="skeleton-block long"></div></div>
                            <div class="skeleton-cell"><div class="skeleton-block short"></div></div>
                            <div class="skeleton-cell"><div class="skeleton-block medium"></div></div>
                            <div class="skeleton-cell"><div class="skeleton-block long"></div></div>
                            <div class="skeleton-cell"><div class="skeleton-block short"></div></div>
                            <div class="skeleton-cell"><div class="skeleton-block short"></div></div>
                            <div class="skeleton-cell"><div class="skeleton-block long"></div></div>
                            <div class="skeleton-cell"><div class="skeleton-block checkbox"></div></div>
                            <div class="skeleton-cell"><div class="skeleton-block checkbox"></div></div>
                            <div class="skeleton-cell"><div class="skeleton-block medium"></div></div>
                            <div class="skeleton-cell"><div class="skeleton-block medium"></div></div>
                            <div class="skeleton-cell"><div class="skeleton-block btn-block"></div></div>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        $("#results").html(loaderHtml);
    }

    function hideTableLoader(callback) {
        const loader = $('#tableLoader');
        const finish = () => {
            if (callback) callback();
            refreshTableUI(); // Единый вызов обновления UI
        };
        if (loader.length) {
            loader.addClass('fade-out');
            setTimeout(finish, 300);
        } else {
            finish();
        }
    }

    function performSearch() {
        showTableLoader();
        $.ajax({
            type: "GET",
            url: "search_records.php",
            data: {
                search: $('#searchInput').val().trim(),
                inspection: $('#inspectionFilter').is(':checked'),
                yearRecord: $('#yearRecordFilter').is(':checked'),
                dateFilter: $('#dateFilter').val()
            },
            success: function(response) {
                hideTableLoader(() => {
                    $("#results").html(response);
                    $('#results .my-table').addClass('table-loaded');
                });
            },
            error: () => hideTableLoader(() => $("#results").html('<div class="empty-message">Ошибка при загрузке данных</div>'))
        });
    }

    function loadLastRecords() {
        showTableLoader();
        $.ajax({
            type: "GET",
            url: "get_last_records.php",
            success: function(response) {
                hideTableLoader(() => {
                    $("#results").html(response);
                    $('#results .my-table').addClass('table-loaded');
                });
            },
            error: () => hideTableLoader(() => $("#results").html('<div class="empty-message">Ошибка при загрузке данных</div>'))
        });
    }

    // =========================================================================
    // 8. АВТОКОМПЛИТ МАРКИ
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
                $.ajax({
                    url: 'search_brands.php',
                    data: { q: query },
                    dataType: 'json',
                    success: function(brands) {
                        $list.empty();
                        if (!brands || brands.length === 0) { $list.removeClass('active'); return; }
                        brands.forEach((brand, index) => {
                            const highlighted = brand.replace(new RegExp(`(${query})`, 'gi'), '<span class="highlight">$1</span>');
                            const $item = $(`<div class="autocomplete-item" data-index="${index}">${highlighted}</div>`);
                            $item.on('click', () => { $input.val(brand); $list.removeClass('active').empty(); });
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
            if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, $items.length - 1); $items.removeClass('active').eq(activeIndex).addClass('active'); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); $items.removeClass('active').eq(activeIndex).addClass('active'); }
            else if (e.key === 'Enter' && activeIndex >= 0 && $list.hasClass('active')) { e.preventDefault(); $items.eq(activeIndex).click(); }
            else if (e.key === 'Escape') { $list.removeClass('active').empty(); }
        });
        
        $(document).on('click', function(e) {
            if (!$(e.target).closest('.autocomplete-wrapper').length) $list.removeClass('active').empty();
        });
    }
    $('input[name="carMake"]').each(function() {
        $(this).wrap('<div class="autocomplete-wrapper"></div>');
        initBrandAutocomplete($(this));
    });

    // =========================================================================
    // 9. ДОБАВЛЕНИЕ НОВОЙ ЗАПИСИ (ФОРМА)
    // =========================================================================
    $("#carForm").submit(function(event) {
        event.preventDefault();
        const fullNameApplicant = $("input[name='fullNameApplicant']").val().trim();
        const carMake = $("input[name='carMake']").val().trim();
        const stateNumber = $("input[name='stateNumber']").val().trim();
        const driverLastName = $("input[name='driverLastName']").val().trim();
        const entryDate = $("input[name='entryDate']").val();
        const outDate = $("input[name='outDate']").val();
        const comment = $("textarea[name='comment']").val().trim();

        clearFieldError($('#fullNameApplicant'));
        if (!fullNameApplicant) {
            showFieldError($('#fullNameApplicant'), $('#fullNameError'));
            showToast("Пожалуйста, укажите ФИО инициатора!", 'warning');
            $("input[name='fullNameApplicant']").focus();
            return;
        }
        if (!carMake && !stateNumber && !driverLastName && !entryDate && !outDate && !comment) {
            showToast("Пожалуйста, заполните хотя бы одно дополнительное поле!", 'warning');
            return;
        }

        pendingSubmitData = $(this).serialize();
        pendingSubmitYearRecord = $("input[name='yearRecord']").is(':checked') ? 1 : 0;
        $('#confirmSubmitText').text('Вы уверены, что хотите добавить эту запись?');
        $('#confirmSubmitOk').text('Добавить');
        $('#confirmSubmitModal').addClass('active');
    });

    $("#fullNameApplicant").on('input', function() { if ($(this).val().trim()) clearFieldError($(this)); });
    $('#confirmSubmitCancel, #confirmSubmitOverlay').click(function() { $('#confirmSubmitModal').removeClass('active'); pendingSubmitData = null; });
    
    $('#confirmSubmitOk').click(function() {
        if (!pendingSubmitData) return;
        const $btn = $(this);
        const originalText = $btn.text();
        $btn.text('Добавление...').prop('disabled', true);
        
        $.ajax({
            type: "POST", url: "record.php", data: pendingSubmitData, dataType: 'json',
            success: function(response) {
                $('#confirmSubmitModal').removeClass('active');
                $btn.text(originalText).prop('disabled', false);
                
                if (response.success) {
                    showToast(response.message, 'success', 'record_add_success_' + Date.now());
                    if (!pendingSubmitYearRecord) {
                        $("#carForm")[0].reset();
                    }
                    updateTableIfVisible();
                    hasUnsavedChanges = false; // ← ДОБАВИТЬ
                } else {
                    showToast(response.message, 'error', 'record_add_error_' + Date.now());
                }
                pendingSubmitData = null;
            },
            error: function(xhr) {
                $('#confirmSubmitModal').removeClass('active');
                $btn.text(originalText).prop('disabled', false);
                let errorMsg = "Произошла ошибка при отправке данных.";
                try { const err = JSON.parse(xhr.responseText); if (err.message) errorMsg = err.message; } catch (e) {}
                showToast(errorMsg, 'error', 'record_add_error_' + Date.now());
                pendingSubmitData = null;
            }
        });
    });

    // =========================================================================
    // 10. РЕДАКТИРОВАНИЕ И УДАЛЕНИЕ ЗАПИСЕЙ В ТАБЛИЦЕ
    // =========================================================================
    $(document).on('click', '.edit-btn', function() {
        const row = $(this).closest('tr');
        row.addClass('editing');
        row.find('.edit-field, .table-check').prop('disabled', false);
        const $carInput = row.find('input[data-field="car_make"]');
        if (!$carInput.closest('.autocomplete-wrapper').length) {
            $carInput.wrap('<div class="autocomplete-wrapper"></div>');
            initBrandAutocomplete($carInput);
        }
        $(this).hide();
        row.find('.save-btn').show();
    });

    $(document).on('change', '.table-check[data-field="inspection"]', function() {
        updateRowColors($(this).closest('tr'), $(this).is(':checked') ? 1 : 0);
    });

    function updateRowColors(row, inspection) {
        if (inspection == 1) {
            row.css({ 'background-color': 'rgba(255, 204, 0, 0.15)', 'border-left': '4px solid #ffcc00' });
        } else {
            row.css({ 'background-color': '', 'border-left': '' });
        }
    }

    function hideEmptyDateMasks() {
    $('input[type="date"]').each(function() {
        if (!$(this).val()) {
            $(this).addClass('empty-date');
        } else {
            $(this).removeClass('empty-date');
        }
    });
    
    $('input[type="time"]').each(function() {
        if (!$(this).val()) {
            $(this).addClass('empty-time');
        } else {
            $(this).removeClass('empty-time');
        }
    });
}

    $(document).on('click', '.save-btn', async function() {
    const row = $(this).closest('tr');
    const id = row.data('id');
    
    const data = {
        id: id,
        car_make: row.find('input[data-field="car_make"]').val().trim(),
        state_number: row.find('input[data-field="state_number"]').val().trim(),
        driver_last_name: row.find('input[data-field="driver_last_name"]').val().trim(),
        full_name_applicant: row.find('input[data-field="full_name_applicant"]').val().trim(),
        entry_time: row.find('input[data-field="entry_time"]').val(),
        out_time: row.find('input[data-field="out_time"]').val(),
        entry_date: row.find('input[data-field="entry_date"]').val(),
        out_date: row.find('input[data-field="out_date"]').val(),
        comment: row.find('textarea[data-field="comment"]').val().trim(),
        inspection: row.find('input[data-field="inspection"]').is(':checked') ? 1 : 0,
        year_record: row.find('input[data-field="year_record"]').is(':checked') ? 1 : 0
    };

    if (!data.car_make && !data.state_number && !data.driver_last_name && 
        !data.full_name_applicant && !data.comment && !data.entry_date && !data.out_date) {
        showToast("Пожалуйста, заполните хотя бы одно поле!", 'warning', 'validation_save_' + Date.now());
        return; 
    }

    try {
        const response = await $.ajax({
            type: "POST",
            url: "update_record.php",
            data: data,
            dataType: 'json' // ← ДОБАВЛЕНО: явно указываем тип ответа
        });

        // Проверяем ответ сервера
        if (response && response.success) {
            showToast("Данные успешно обновлены!", 'success', 'record_update_' + id + '_' + Date.now());
            
            row.removeClass('editing');
            row.find('.edit-field').prop('disabled', true);
            row.find('.table-check').prop('disabled', true);
            row.find('.edit-btn').show();
            row.find('.save-btn').hide();

            hideEmptyDateMasks();
            updateRowColors(row, data.inspection);
            updateTableIfVisible();
            hasUnsavedChanges = false;
        } else {
            const errorMsg = (response && response.message) ? response.message : "Ошибка при обновлении данных.";
            showToast(errorMsg, 'error', 'record_update_error_' + id + '_' + Date.now());
        }
        
    } catch (error) {
        console.error("Ошибка при запросе: ", error);
        showToast("Ошибка при обновлении данных.", 'error', 'record_update_error_' + id + '_' + Date.now());
    }
});

    $(document).on('click', '.delete-btn', function() {
        deleteId = $(this).data('id');
        $('#confirmModal').addClass('active');
    });
    $('#confirmCancel').click(function() { $('#confirmModal').removeClass('active'); deleteId = null; });
    $('#confirmOk').click(function() {
        if (!deleteId) return;
        $.ajax({
            type: "POST", url: "delete_record.php", data: { id: deleteId }, dataType: 'json',
            success: function(response) {
                showToast(response.success ? response.message : response.message, response.success ? 'success' : 'error', 'record_delete_' + deleteId);
                $('#confirmModal').removeClass('active');
                updateTableIfVisible();
                deleteId = null;
            },
            error: function(xhr) {
                let errorMsg = "Произошла ошибка при удалении записи.";
                try { const err = JSON.parse(xhr.responseText); if (err.message) errorMsg = err.message; } catch (e) {}
                showToast(errorMsg, 'error', 'record_delete_error_' + deleteId);
            }
        });
    });

    // =========================================================================
    // 11. НАВИГАЦИЯ И ПОИСК
    // =========================================================================
    $('#entryBtn').click(function() {
        $('.choice, .new-entry').hide();
        $('.new-entry:not(.search)').show();
        $('#newEntryBtnBack').show();
        loadLastRecords();
    });

    $('#searchBtn').click(function() {
        $('.choice, .new-entry').hide();
        $('.new-entry.search').show();
        $('#newEntryBtnBack').show();
        performSearch();
    });

    $('#newEntryBtnBack').click(function() {
    if (hasUnsavedChanges) {
        if (!confirm('У вас есть несохранённые изменения. Вы уверены, что хотите вернуться назад?')) {
            return;
        }
    }
    
    $('.new-entry').hide();
    $('.choice').show();
    $(this).hide();
    $('#results').empty();
    hasUnsavedChanges = false; 
});

    $("#clearFormBtn").click(function() {
    $("#carForm")[0].reset();
    
    $('.field-error').removeClass('visible');
    $('.required-field').removeClass('field-error-active');
    
    showToast("Форма очищена", 'info', 'form_cleared_' + Date.now());
    hasUnsavedChanges = false; 
});

    $('#searchInput').on('input', function() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(performSearch, 500);
    });
    $('#inspectionFilter, #yearRecordFilter, #dateFilter').on('change', performSearch);

    $("#clearSearchBtn").click(function() {
        $('#searchInput').val('');
        $('#inspectionFilter, #yearRecordFilter').prop('checked', false);
        $('#dateFilter').val('');
        performSearch();
        showToast("Фильтры поиска сброшены", 'info', 'search_clear_' + Date.now());
    });

    $(document).on('keydown', function(e) {
        if (e.key === 'Escape') {
            if ($('#confirmSubmitModal').hasClass('active')) { $('#confirmSubmitModal').removeClass('active'); pendingSubmitData = null; }
            if ($('#confirmModal').hasClass('active')) { $('#confirmModal').removeClass('active'); deleteId = null; }
            if ($('#requestDetailModal').is(':visible')) { $('#requestDetailModal').fadeOut(200); }
            if ($('#requestsListModal').is(':visible')) { $('#requestsListModal').fadeOut(200); }
        }
    });



        // =========================================================================
    // 11.5. СОРТИРОВКА ТАБЛИЦЫ (Восстановлено)
    // =========================================================================
    $(document).on('click', '.table-header-cell.sortable', function() {
        const $th = $(this);
        const $table = $th.closest('table');
        const column = $th.data('sort');
        
        if (!column) return;
        
        const $tbody = $table.find('tbody');
        const $firstRow = $tbody.find('tr.table-row').first();
        
        // Сохраняем исходный порядок, если еще не сохранен
        if ($firstRow.data('original-index') === undefined) {
            $tbody.find('tr.table-row').each(function(index) {
                $(this).data('original-index', index);
            });
        }
        
        // Определяем направление сортировки (3 состояния: asc -> desc -> reset)
        let direction = null;
        if ($th.hasClass('sort-asc')) {
            direction = 'desc';
        } else if ($th.hasClass('sort-desc')) {
            direction = 'reset';
        } else {
            direction = 'asc';
        }
        
        // Сбрасываем классы сортировки у всех шапок
        $table.find('.table-header-cell').removeClass('sort-asc sort-desc');
        
        const $rows = $tbody.find('tr.table-row').get();
        
        // Третий клик — восстановление исходного порядка
        if (direction === 'reset') {
            $rows.sort(function(a, b) {
                return ($(a).data('original-index') || 0) - ($(b).data('original-index') || 0);
            });
            $.each($rows, function(idx, row) {
                $tbody.append(row);
            });
            // Восстанавливаем цвета строк
            $tbody.find('tr.table-row').each(function() {
                const $inspectionInput = $(this).find('input[data-field="inspection"]');
                if ($inspectionInput.length) {
                    updateRowColors($(this), $inspectionInput.is(':checked') ? 1 : 0);
                }
            });
            return;
        }
        
        if (!direction) return;
        
        // Устанавливаем класс сортировки
        $th.addClass(direction === 'asc' ? 'sort-asc' : 'sort-desc');
        
        // Получаем индекс столбца
        const columnIndex = $th.index();
        
        // Сортируем строки
        $rows.sort(function(a, b) {
            const $cellA = $(a).find('td').eq(columnIndex);
            const $cellB = $(b).find('td').eq(columnIndex);
            
            let valA = getValueFromCell($cellA, column);
            let valB = getValueFromCell($cellB, column);
            
            const type = getColumnType(column);
            
            if (type === 'number') {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
                return direction === 'asc' ? valA - valB : valB - valA;
            } else if (type === 'date') {
                const dateA = parseDate(valA);
                const dateB = parseDate(valB);
                return direction === 'asc' ? dateA - dateB : dateB - dateA;
            } else {
                valA = String(valA).toLowerCase();
                valB = String(valB).toLowerCase();
                if (valA < valB) return direction === 'asc' ? -1 : 1;
                if (valA > valB) return direction === 'asc' ? 1 : -1;
                return 0;
            }
        });
        
        $.each($rows, function(idx, row) {
            $tbody.append(row);
        });
        
        // Обновляем цвета строк после сортировки
        $tbody.find('tr.table-row').each(function() {
            const $inspectionInput = $(this).find('input[data-field="inspection"]');
            if ($inspectionInput.length) {
                updateRowColors($(this), $inspectionInput.is(':checked') ? 1 : 0);
            }
        });
    });

    function getValueFromCell($cell, column) {
        const $checkbox = $cell.find('input[type="checkbox"]');
        if ($checkbox.length) {
            return $checkbox.is(':checked') ? '1' : '0';
        }
        const $input = $cell.find('input.edit-field, textarea.edit-field');
        if ($input.length) {
            return $input.val() || '';
        }
        return $cell.text().trim();
    }

    function getColumnType(column) {
        const numberColumns = ['inspection', 'year_record', 'id'];
        const dateColumns = ['entry_date', 'out_date', 'entry_time', 'out_time', 'created_at'];
        
        if (numberColumns.includes(column)) return 'number';
        if (dateColumns.includes(column)) return 'date';
        return 'text';
    }

    function parseDate(dateStr) {
        if (!dateStr) return 0;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const parts = dateStr.split('-');
            return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
        }
        if (/^\d{2}:\d{2}$/.test(dateStr)) {
            const parts = dateStr.split(':');
            return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
            const parts = dateStr.split('.');
            return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
        }
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    }

    // =========================================================================
    // 12. ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
    // =========================================================================
    loadPendingRequests();
    setInterval(loadPendingRequests, 5000);
    
    // Первичный запуск обновления UI таблицы (если она уже есть на странице)
    setTimeout(refreshTableUI, 500);
    $(document).on('DOMNodeInserted', '#results', function() {
        setTimeout(refreshTableUI, 100);
    });

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