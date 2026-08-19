$(document).ready(function() {
    // =========================================================================
    // 1. БЕЗОПАСНОСТЬ И СЕССИЯ (HEARTBEAT & CSRF)
    // =========================================================================
    (function() {
        function sendHeartbeat() {
            fetch('./heartbeat.php', { method: 'GET', credentials: 'same-origin', cache: 'no-store' })
            .then(response => {
                if (response.status === 401 || response.status === 403) { window.location.href = './'; return null; }
                return response.json();
            })
            .then(data => {
                if (data && data.success && data.csrf_token) {
                    $('meta[name="csrf-token"]').attr('content', data.csrf_token);
                    window.csrfToken = data.csrf_token;
                }
            }).catch(() => {});
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
    let isFirstPoll = true;
    let searchTimer;
    let resizeTimer;
    let hasUnsavedChanges = false;
    const undoStore = {};
    let loaderTimeout = null;
    let loaderVisible = false;
    let currentSearchXHR = null; // Для отмены предыдущего запроса поиска

    // =========================================================================
    // 3. УМНЫЙ SCREEN LOADER
    // =========================================================================
    function showScreenLoader() { $('#screenLoader').addClass('active'); }
    function hideScreenLoader() { $('#screenLoader').removeClass('active'); }
    function showLoaderWithDelay() {
        if (loaderVisible) return;
        loaderTimeout = setTimeout(() => { showScreenLoader(); loaderVisible = true; }, 1000);
    }
    function hideLoaderWithDelay() {
        if (loaderTimeout) { clearTimeout(loaderTimeout); loaderTimeout = null; }
        if (loaderVisible) { hideScreenLoader(); loaderVisible = false; }
    }
    function ajaxWithLoader(settings) {
        showLoaderWithDelay();
        const jqXHR = $.ajax(settings);
        jqXHR.always(function() { hideLoaderWithDelay(); });
        return jqXHR;
    }

    // =========================================================================
    // 4. УТИЛИТЫ И UI ТАБЛИЦЫ
    // =========================================================================
    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
    }

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

    function refreshTableUI() {
        $('.table-row:not(.editing) .edit-field[placeholder]').each(function() {
            const $field = $(this);
            if (!$field.data('original-placeholder')) $field.data('original-placeholder', $field.attr('placeholder'));
            $field.attr('placeholder', '');
        });
        $('.table-cell .edit-field').not('.table-check').each(function() {
            const $field = $(this);
            let $wrapper = $field.parent('.field-tooltip-wrapper');
            if ($wrapper.length === 0) {
                $field.wrap('<span class="field-tooltip-wrapper"></span>');
                $wrapper = $field.parent('.field-tooltip-wrapper');
            }
            function updateTooltip() {
                let value = $field.val();
                if (!value || value.trim() === '') { $wrapper.removeAttr('data-tooltip'); return; }
                $wrapper.attr('data-tooltip', value.trim());
            }
            updateTooltip();
            $field.off('input.tooltip change.tooltip').on('input.tooltip change.tooltip', updateTooltip);
        });
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
    $(window).on('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(refreshTableUI, 250);
    });

    // =========================================================================
    // 5. РАБОТА С ЗАЯВКАМИ (АДМИН)
    // =========================================================================
    function loadPendingRequests() {
        $.ajax({ type: "GET", url: "get_pending_requests.php", dataType: 'json', success: function(response) {
            if (response.success) {
                const newCount = response.count || 0;
                currentRequests = response.requests || [];
                if (!isFirstPoll && newCount > lastRequestCount) showToast('Поступила новая заявка!', 'info', 'new_req_' + Date.now());
                lastRequestCount = newCount;
                updateMessageUI(newCount);
                isFirstPoll = false;
            }
        }});
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
    function renderRequestsList() {
        const $list = $('#requestsList').empty();
        if (currentRequests.length === 0) {
            $list.html('<div class="empty-list">Нет необработанных заявок</div>');
        } else {
            currentRequests.forEach(function(req) {
                const date = req.created_at ? new Date(req.created_at).toLocaleString('ru-RU') : '';
                const item = $(`<div class="request-list-item" data-id="${req.id}">
                    <div class="request-list-item-header">
                        <span class="request-list-item-title">${escapeHtml(req.full_name_applicant || 'Без ФИО')}</span>
                        <span class="request-list-item-date">${date}</span>
                    </div>
                    <div class="request-list-item-body">
                        ${req.car_make ? '<span class="request-tag">' + escapeHtml(req.car_make) + '</span>' : ''}
                        ${req.state_number ? '<span class="request-tag">' + escapeHtml(req.state_number) + '</span>' : ''}
                        <span class="request-tag request-tag-id">#${req.id}</span>
                    </div>
                </div>`);
                item.click(() => openRequestDetail(req.id));
                $list.append(item);
            });
        }
    }
    $('#messageCard').click(function() { renderRequestsList(); $('#requestsListModal').fadeIn(200); });
    function openRequestDetail(id) {
        $.ajax({ type: "GET", url: "get_request_details.php", data: { id: id }, dataType: 'json', success: function(response) {
            if (response.success) {
                currentRequestId = id;
                $('#requestId').text(response.request.full_name_applicant || 'Заявка без ФИО');
                const $body = $('#requestDetailBody').empty();
                const fields = [
                    { label: 'Марка', value: response.request.car_make }, { label: 'Гос/номер', value: response.request.state_number },
                    { label: 'Фамилия водителя', value: response.request.driver_last_name }, { label: 'ФИО инициатора', value: response.request.full_name_applicant },
                    { label: 'Время въезда', value: response.request.entry_time }, { label: 'Время выезда', value: response.request.out_time },
                    { label: 'Дата въезда', value: response.request.entry_date }, { label: 'Дата выезда', value: response.request.out_date },
                    { label: 'Комментарий', value: response.request.comment }, { label: 'Без досмотра', value: response.request.inspection == 1 ? 'Да' : 'Нет' },
                    { label: 'Годовая запись', value: response.request.year_record == 1 ? 'Да' : 'Нет' }
                ];
                fields.forEach(f => {
                    if (f.value && f.value !== '' && f.value !== '0000-00-00' && f.value !== '00:00:00') {
                        $body.append(`<div class="detail-row"><span class="detail-label">${f.label}</span><span class="detail-value">${escapeHtml(String(f.value))}</span></div>`);
                    }
                });
                $('#requestsListModal').fadeOut(200, () => $('#requestDetailModal').fadeIn(200));
            }
        }});
    }
    $('#closeListBtn').click(() => $('#requestsListModal').fadeOut(200));
    $('#closeDetailBtn').click(() => $('#requestDetailModal').fadeOut(200));
    $('#approveBtn').click(() => currentRequestId && processRequest(currentRequestId, 'approve'));
    $('#rejectBtn').click(() => currentRequestId && processRequest(currentRequestId, 'reject'));

    function processRequest(id, action) {
        ajaxWithLoader({ type: "POST", url: "process_request.php", data: { id: id, action: action }, dataType: 'json' }).done(function(response) {
            if (response && response.success) {
                showToast(response.message, action === 'approve' ? 'success' : 'warning', 'request_' + action + '_' + id);
                currentRequests = currentRequests.filter(req => req.id !== id);
                const remainingCount = currentRequests.length;
                updateMessageUI(remainingCount);
                if (remainingCount > 0) {
                    renderRequestsList();
                    $('#requestDetailModal').fadeOut(200);
                    $('#requestsListModal').show();
                } else {
                    $('#requestDetailModal').fadeOut(200);
                    $('#requestsListModal').fadeOut(200);
                }
                loadPendingRequests();
                updateTableIfVisible();
            } else {
                showToast((response && response.message) ? response.message : "Неизвестная ошибка при обработке", 'error', 'request_error_' + id);
            }
        }).fail(function(xhr) {
            if (xhr.status === 403) { showToast("Сессия обновляется. Повторите действие.", 'warning'); setTimeout(() => location.reload(), 1500); } 
            else { showToast("Ошибка сети или сервера при обработке заявки", 'error', 'request_network_error_' + id); }
        });
    }

    // =========================================================================
    // 6. ЗАГРУЗКА И ПОИСК В ТАБЛИЦАХ (С ОПТИМИЗАЦИЕЙ СЕТИ)
    // =========================================================================
    function updateTableIfVisible() {
        if ($('.choice').is(':visible')) return;
        if ($('.new-entry.search').is(':visible')) performSearch();
        else if ($('.new-entry:not(.search)').is(':visible')) loadLastRecords();
    }
    function showTableLoader() {
        $("#results").html(`<div class="table-loader" id="tableLoader"><div class="skeleton-table"><div class="skeleton-header">${Array(6).fill('').map(() => `<div class="skeleton-cell"><div class="skeleton-block medium"></div></div>`).join('')}</div>${Array(3).fill('').map(() => `<div class="skeleton-row">${Array(6).fill('').map(() => `<div class="skeleton-cell"><div class="skeleton-block medium"></div></div>`).join('')}</div>`).join('')}</div></div>`);
    }
    function hideTableLoader(callback) {
        const loader = $('#tableLoader');
        const finish = () => { 
            if (callback) callback(); 
            refreshTableUI(); 
            initTablePickers(); 
        };
        if (loader.length) { loader.addClass('fade-out'); setTimeout(finish, 300); } else { finish(); }
    }
    function performSearch() {
        if (currentSearchXHR) currentSearchXHR.abort(); // Отмена предыдущего запроса
        
        currentSearchXHR = ajaxWithLoader({ 
            type: "GET", 
            url: "search_records.php", 
            cache: false, 
            data: { 
                search: $('#searchInput').val().trim(), 
                inspection: $('#inspectionFilter').is(':checked'), 
                yearRecord: $('#yearRecordFilter').is(':checked') 
            } 
        }).done(function(response) {
            currentSearchXHR = null;
            hideTableLoader(() => { $("#results").html(response); $('#results .my-table').addClass('table-loaded'); });
        }).fail(function(xhr) {
            currentSearchXHR = null;
            if (xhr.statusText !== 'abort') {
                hideTableLoader(() => $("#results").html('<div class="empty-message">Ошибка при загрузке данных</div>'));
            }
        });
    }
    function loadLastRecords() {
        ajaxWithLoader({ type: "GET", url: "get_last_records.php", cache: false }).done(function(response) {
            hideTableLoader(() => { $("#results").html(response); $('#results .my-table').addClass('table-loaded'); });
        }).fail(function() { hideTableLoader(() => $("#results").html('<div class="empty-message">Ошибка при загрузке данных</div>')); });
    }

    function initTablePickers() {
        if (typeof flatpickr === 'function') {
            $('.custom-date-picker').each(function() {
                if (!this._flatpickr) {
                    flatpickr(this, {
                        dateFormat: "d.m.Y", locale: "ru", allowInput: true, disableMobile: "true", position: 'above',
                        onOpen: function(selectedDates, dateStr, instance) {
                            instance.calendarContainer.classList.add('calendar-in-table');
                            const yearInput = instance.yearElements[0];
                            if (yearInput) yearInput.type = 'text';
                        }
                    });
                }
            });
            $('.custom-time-picker').each(function() {
                if (!this._flatpickr) {
                    flatpickr(this, {
                        enableTime: true, noCalendar: true, dateFormat: "H:i", time_24hr: true, allowInput: true, disableMobile: "true",
                        defaultHour: 9, defaultMinute: 0, hourIncrement: 1, minuteIncrement: 1, position: 'above',
                        onOpen: function(selectedDates, dateStr, instance) {
                            instance.calendarContainer.classList.add('time-picker-in-table');
                        },
                        onChange: function(selectedDates, dateStr, instance) {
                            if (instance.input && dateStr) instance.input.value = dateStr;
                        }
                    });
                }
            });
        }
    }

    // =========================================================================
    // 7. АВТОКОМПЛИТ МАРКИ
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
                    if (!brands || brands.length === 0) { $list.removeClass('active'); return; }
                    brands.forEach((brand, index) => {
                        const highlighted = brand.replace(new RegExp(`(${query})`, 'gi'), '<span class="highlight">$1</span>');
                        const $item = $(`<div class="autocomplete-item" data-index="${index}">${highlighted}</div>`);
                        $item.on('click', () => { $input.val(brand); $list.removeClass('active').empty(); });
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

    // =========================================================================
    // 8. ДОБАВЛЕНИЕ НОВОЙ ЗАПИСИ (АДМИН)
    // =========================================================================
    $('#entryBtn').click(function() { 
        $('.choice, .new-entry').hide(); 
        $('.new-entry:not(.search)').show(); 
        $('#newEntryBtnBack').show(); 
        $('#multipleCarsBtn').show(); 
        $("input[name='inspection'], input[name='yearRecord']").prop('checked', false);
        clearFieldError($('#fullNameApplicant')); 
        loadLastRecords(); 
    });

    $("#clearFormBtn").click(function() {
        $("#carForm")[0].reset(); 
        $('.field-error').removeClass('visible'); 
        $('.required-field').removeClass('field-error-active');
        showToast("Форма очищена", 'info', 'form_cleared_' + Date.now()); 
        hasUnsavedChanges = false; 
    });

    $("#fullNameApplicant").on('input', function() { 
        if ($(this).val().trim()) clearFieldError($(this)); 
    });

    $("#carForm").submit(function(event) {
        event.preventDefault();
        const fullNameApplicant = ($("input[name='fullNameApplicant']").val() || '').trim();
        const carMake = ($("input[name='carMake']").val() || '').trim();
        const stateNumber = ($("input[name='stateNumber']").val() || '').trim();
        const driverLastName = ($("input[name='driverLastName']").val() || '').trim();
        const entryDate = ($("input[name='entryDate']").val() || '').trim();
        const outDate = ($("input[name='outDate']").val() || '').trim();
        const comment = ($("textarea[name='comment']").val() || '').trim();
        const entryTime = ($("input[name='entryTime']").val() || '').trim();
        const outTime = ($("input[name='outTime']").val() || '').trim();

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

        const isInspection = $("input[name='inspection']").is(':checked') ? 1 : 0;
        const isYearRecord = $("input[name='yearRecord']").is(':checked') ? 1 : 0;

        pendingSubmitData = {
            carMake: carMake, stateNumber: stateNumber, driverLastName: driverLastName,
            fullNameApplicant: fullNameApplicant, entryTime: entryTime, outTime: outTime,
            entryDate: entryDate, outDate: outDate, comment: comment,
            inspection: isInspection, yearRecord: isYearRecord
        };
        pendingSubmitYearRecord = isYearRecord;
        
        $('#confirmSubmitText').text('Вы уверены, что хотите добавить эту запись?');
        $('#confirmSubmitOk').text('Добавить');
        $('#confirmSubmitModal').addClass('active');
    });

    $('#confirmSubmitCancel, #confirmSubmitOverlay').click(function() { 
        $('#confirmSubmitModal').removeClass('active'); 
        pendingSubmitData = null; 
    });
    
    $('#confirmSubmitOk').click(function() {
        if (!pendingSubmitData) return;
        const $btn = $(this);
        $btn.text('Добавление...').prop('disabled', true);
        
        ajaxWithLoader({ type: "POST", url: "record.php", data: pendingSubmitData, dataType: 'json' }).done(function(response) {
            $('#confirmSubmitModal').removeClass('active'); 
            $btn.prop('disabled', false);
            if (response.success) {
                showToast(response.message, 'success', 'record_add_success_' + Date.now());
                if (!pendingSubmitYearRecord) {
                    $("#carForm")[0].reset();
                    $("input[name='inspection'], input[name='yearRecord']").prop('checked', false);
                    clearFieldError($('#fullNameApplicant'));
                }
                updateTableIfVisible(); 
                hasUnsavedChanges = false;
            } else { 
                showToast(response.message || 'Ошибка', 'error', 'record_add_error_' + Date.now()); 
            }
            pendingSubmitData = null;
        }).fail(function() {
            $('#confirmSubmitModal').removeClass('active'); 
            $btn.prop('disabled', false);
            showToast("Произошла ошибка при отправке данных.", 'error', 'record_add_error_' + Date.now());
            pendingSubmitData = null;
        });
    });

    // =========================================================================
    // 9. РЕДАКТИРОВАНИЕ, СОХРАНЕНИЕ И ОТКАТ
    // =========================================================================
    $(document).on('click', '.edit-btn', function() {
        const $editingRow = $('.table-row.editing');
        if ($editingRow.length > 0) {
            showToast("Нельзя редактировать несколько записей одновременно.", 'warning', 'multi_edit_blocked_' + Date.now());
            return;
        }
        const row = $(this).closest('tr');
        const id = row.data('id');
        
        undoStore[id] = {
            car_make: row.find('input[data-field="car_make"]').val(),
            state_number: row.find('input[data-field="state_number"]').val(),
            driver_last_name: row.find('input[data-field="driver_last_name"]').val(),
            full_name_applicant: row.find('input[data-field="full_name_applicant"]').val(),
            entry_time: row.find('input[data-field="entry_time"]').val(),
            out_time: row.find('input[data-field="out_time"]').val(),
            entry_date: row.find('input[data-field="entry_date"]').val(),
            out_date: row.find('input[data-field="out_date"]').val(),
            comment: row.find('textarea[data-field="comment"]').val(),
            inspection: row.find('input[data-field="inspection"]').is(':checked'),
            year_record: row.find('input[data-field="year_record"]').is(':checked')
        };
        
        row.addClass('editing');
        row.find('.edit-field, .table-check').prop('disabled', false);
        row.find('input[data-type="plate-normalize"]').trigger('input');
        
        const $carInput = row.find('input[data-field="car_make"]');
        if (!$carInput.closest('.autocomplete-wrapper').length) {
            $carInput.wrap('<div class="autocomplete-wrapper"></div>');
            initBrandAutocomplete($carInput);
        }
        $(this).hide();
        row.find('.save-btn').show();
        hasUnsavedChanges = true;
        $('.undo-btn').hide().removeClass('show');
    });

    function updateRowColors(row, inspection) {
        if (inspection == 1) row.css({ 'background-color': 'rgba(255, 204, 0, 0.15)', 'border-left': '4px solid #ffcc00' });
        else row.css({ 'background-color': '', 'border-left': '' });
    }

    function hideEmptyDateMasks() {
        $('input[type="date"], input[type="time"]').each(function() {
            $(this).toggleClass('empty-date', !$(this).val()).toggleClass('empty-time', !$(this).val());
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
            entry_time: row.find('input[data-field="entry_time"]').val().trim(),
            out_time: row.find('input[data-field="out_time"]').val().trim(),
            entry_date: row.find('input[data-field="entry_date"]').val().trim(),
            out_date: row.find('input[data-field="out_date"]').val().trim(),
            comment: row.find('textarea[data-field="comment"]').val().trim(),
            inspection: row.find('input[data-field="inspection"]').is(':checked') ? 1 : 0,
            year_record: row.find('input[data-field="year_record"]').is(':checked') ? 1 : 0
        };

        if (!data.car_make && !data.state_number && !data.driver_last_name && !data.full_name_applicant && !data.comment && !data.entry_date && !data.out_date) {
            showToast("Пожалуйста, заполните хотя бы одно поле!", 'warning', 'validation_save_' + Date.now());
            return; 
        }

        ajaxWithLoader({ type: "POST", url: "update_record.php", data: data, dataType: 'json' }).done(function(response) {
            if (response && response.success) {
                showToast("Данные успешно обновлены!", 'success', 'record_update_' + id + '_' + Date.now());
                row.removeClass('editing');
                row.find('.edit-field, .table-check').prop('disabled', true);
                row.find('.edit-btn').show();
                row.find('.save-btn').hide();
                hideEmptyDateMasks();
                updateRowColors(row, data.inspection);
                hasUnsavedChanges = false;
                updateTableIfVisible();
                setTimeout(() => {
                    $('.undo-btn').hide().removeClass('show');
                    const $newRow = $(`tr[data-id="${id}"]`);
                    if ($newRow.length > 0 && undoStore[id]) {
                        $newRow.find('.undo-btn').attr('data-undo-id', id).show().addClass('show');
                    }
                }, 600);
            } else {
                showToast((response && response.message) ? response.message : "Ошибка при обновлении данных.", 'error', 'record_update_error_' + id + '_' + Date.now());
            }
        }).fail(function() {
            showToast("Ошибка сети при обновлении данных.", 'error', 'record_update_error_' + id + '_' + Date.now());
        });
    });

    $(document).on('click', '.undo-btn', async function() {
        const $undoBtn = $(this);
        const $row = $undoBtn.closest('tr');
        const id = parseInt($undoBtn.attr('data-undo-id')) || $row.data('id');
        const previousData = undoStore[id];
        if (!previousData) { showToast("Нет данных для отката", 'error', 'undo_no_data_' + Date.now()); return; }
        
        ajaxWithLoader({ type: "POST", url: "undo_record.php", data: { id: id, previousData: JSON.stringify(previousData) }, dataType: 'json', cache: false }).done(function(response) {
            if (response && response.success) {
                showToast("Данные восстановлены", 'success', 'undo_success_' + Date.now());
                delete undoStore[id];
                $undoBtn.hide().removeClass('show');
                setTimeout(() => { updateTableIfVisible(); }, 500);
            } else {
                showToast((response && response.message) ? response.message : "Ошибка при откате", 'error', 'undo_error_' + Date.now());
            }
        }).fail(function() {
            showToast("Ошибка сети при откате", 'error', 'undo_network_error_' + Date.now());
        });
    });

    $(document).on('click', '.delete-btn', function() { deleteId = $(this).data('id'); $('#confirmModal').addClass('active'); });
    $('#confirmCancel').click(function() { $('#confirmModal').removeClass('active'); deleteId = null; });
    $('#confirmOk').click(function() {
        if (!deleteId) return;
        ajaxWithLoader({ type: "POST", url: "delete_record.php", data: { id: deleteId }, dataType: 'json' }).done(function(response) {
            showToast(response.message, response.success ? 'success' : 'error', 'record_delete_' + deleteId);
            $('#confirmModal').removeClass('active');
            updateTableIfVisible();
            deleteId = null;
            $('.undo-btn').hide().removeClass('show');
        }).fail(function() {
            showToast("Произошла ошибка при удалении записи.", 'error', 'record_delete_error_' + deleteId);
        });
    });

    // =========================================================================
    // 10. НАВИГАЦИЯ, ПОИСК И СОРТИРОВКА
    // =========================================================================
    $('#searchBtn').click(function() { 
        $('.choice, .new-entry').hide(); 
        $('.new-entry.search').show(); 
        $('#newEntryBtnBack').show(); 
        $('#multipleCarsBtn').hide(); 
        performSearch(); 
    });
    $('#newEntryBtnBack').click(function() {
        if (hasUnsavedChanges && !confirm('У вас есть несохранённые изменения. Вернуться назад?')) return;
        $('.new-entry').hide(); 
        $('.choice').show(); 
        $(this).hide(); 
        $('#multipleCarsBtn').hide();
        $('#results').empty(); 
        hasUnsavedChanges = false; 
    });
    
    // Увеличена задержка до 800мс для экономии трафика в медленной сети
    $('#searchInput').on('input', function() { 
        clearTimeout(searchTimer); 
        searchTimer = setTimeout(performSearch, 800); 
    });
    
    $('#inspectionFilter, #yearRecordFilter').on('change', performSearch);
    $("#clearSearchBtn").click(function() {
        $('#searchInput').val(''); $('#inspectionFilter, #yearRecordFilter').prop('checked', false);
        performSearch(); showToast("Фильтры поиска сброшены", 'info', 'search_clear_' + Date.now());
    });

    $(document).on('click', '.table-header-cell.sortable', function() {
        const $th = $(this); const $table = $th.closest('table'); const column = $th.data('sort');
        if (!column) return;
        const $tbody = $table.find('tbody');
        if ($tbody.find('tr.table-row').first().data('original-index') === undefined) {
            $tbody.find('tr.table-row').each(function(index) { $(this).data('original-index', index); });
        }
        let direction = $th.hasClass('sort-asc') ? 'desc' : ($th.hasClass('sort-desc') ? 'reset' : 'asc');
        $table.find('.table-header-cell').removeClass('sort-asc sort-desc');
        const $rows = $tbody.find('tr.table-row').get();
        if (direction === 'reset') {
            $rows.sort((a, b) => ($(a).data('original-index') || 0) - ($(b).data('original-index') || 0));
        } else {
            $th.addClass(direction === 'asc' ? 'sort-asc' : 'sort-desc');
            const columnIndex = $th.index();
            $rows.sort(function(a, b) {
                const valA = getValueFromCell($(a).find('td').eq(columnIndex), column);
                const valB = getValueFromCell($(b).find('td').eq(columnIndex), column);
                const type = ['inspection', 'year_record', 'id'].includes(column) ? 'number' : (['entry_date', 'out_date', 'entry_time', 'out_time'].includes(column) ? 'date' : 'text');
                if (type === 'number') return direction === 'asc' ? (parseFloat(valA)||0) - (parseFloat(valB)||0) : (parseFloat(valB)||0) - (parseFloat(valA)||0);
                if (type === 'date') {
                    const dA = /^\d{2}\.\d{2}\.\d{4}$/.test(valA) ? new Date(valA.split('.')[2], valA.split('.')[1]-1, valA.split('.')[0]).getTime() : 0;
                    const dB = /^\d{2}\.\d{2}\.\d{4}$/.test(valB) ? new Date(valB.split('.')[2], valB.split('.')[1]-1, valB.split('.')[0]).getTime() : 0;
                    return direction === 'asc' ? dA - dB : dB - dA;
                }
                return direction === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
            });
        }
        $.each($rows, function(idx, row) { $tbody.append(row); });
        $tbody.find('tr.table-row').each(function() {
            const $inp = $(this).find('input[data-field="inspection"]');
            if ($inp.length) updateRowColors($(this), $inp.is(':checked') ? 1 : 0);
        });
    });

    function getValueFromCell($cell, column) {
        const $cb = $cell.find('input[type="checkbox"]');
        if ($cb.length) return $cb.is(':checked') ? '1' : '0';
        const $inp = $cell.find('input.edit-field, textarea.edit-field');
        return $inp.length ? $inp.val() || '' : $cell.text().trim();
    }

    loadPendingRequests();
    setInterval(loadPendingRequests, 5000);
    setTimeout(refreshTableUI, 500);
    $(document).on('DOMNodeInserted', '#results', function() { setTimeout(refreshTableUI, 100); });

    // =========================================================================
    // 11. ПРОВЕРКА ГОСНОМЕРА
    // =========================================================================
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

    // =========================================================================
    // 12. ИНИЦИАЛИЗАЦИЯ КАСТОМНОГО КАЛЕНДАРЯ (FLATPICKR) - ЕДИНЫЙ БЛОК
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
                if (yearInput) yearInput.type = 'text';
            }
        });

        // 2. Инициализация выбора времени (С ШАГОМ ПРОКРУТКИ)
        flatpickr(".custom-time-picker", {
            enableTime: true,
            noCalendar: true,
            dateFormat: "H:i",
            time_24hr: true,
            allowInput: true,
            disableMobile: "true",
            defaultHour: 9,
            defaultMinute: 0,
            hourIncrement: 1,      // Шаг для часов
            minuteIncrement: 1,    // Шаг для минут (1, 5, 10, 15...)
            onChange: function(selectedDates, dateStr, instance) {
                if (instance.input && dateStr) {
                    instance.input.value = dateStr;
                }
            }
        });

        // 3. Клик по иконке календаря
        $(document).on('click', '.calendar-icon', function() {
            const inputElement = $(this).prev('.custom-date-picker').get(0);
            if (inputElement && inputElement._flatpickr) inputElement._flatpickr.open();
        });

        // 4. Клик по иконке времени
        $(document).on('click', '.time-icon', function() {
            const inputElement = $(this).prev('.custom-time-picker').get(0);
            if (inputElement && inputElement._flatpickr) inputElement._flatpickr.open();
        });

        // 5. Переключение цифр колесиком мыши (С ПОДДЕРЖКОЙ ШАГА)
        document.addEventListener('wheel', function(e) {
            if (e.target.classList.contains('flatpickr-hour') || e.target.classList.contains('flatpickr-minute')) {
                e.preventDefault(); 
                const currentValue = parseInt(e.target.value) || 0;
                const isHour = e.target.classList.contains('flatpickr-hour');
                
                let fp = null;
                document.querySelectorAll('.custom-time-picker').forEach(input => {
                    if (input._flatpickr && input._flatpickr.isOpen) fp = input._flatpickr;
                });

                const step = fp ? (isHour ? (fp.config.hourIncrement || 1) : (fp.config.minuteIncrement || 5)) : (isHour ? 1 : 5);
                const max = isHour ? 23 : 59;
                const delta = e.deltaY < 0 ? step : -step;
                
                let newValue = currentValue + delta;
                if (newValue > max) newValue = isHour ? 0 : (max - (max % step));
                if (newValue < 0) newValue = isHour ? max : max;
                
                e.target.value = newValue.toString().padStart(2, '0');

                if (fp && fp.hourElement && fp.minuteElement) {
                    const h = parseInt(fp.hourElement.value) || 0;
                    const m = parseInt(fp.minuteElement.value) || 0;
                    const d = fp.selectedDates[0] || new Date();
                    d.setHours(h, m, 0, 0);
                    fp.setDate(d, true);
                }
            }
        }, { passive: false });

        // 6. Запасной вариант: запись при потере фокуса
        $(document).on('blur', '.custom-time-picker', function() {
            const input = this;
            const fp = input._flatpickr;
            const currentValue = $(input).val().trim();
            
            // КРИТИЧЕСКИ ВАЖНО: если поле пустое — НЕ восстанавливаем старое время
            if (currentValue === '') {
                if (fp) {
                    fp.selectedDates = [];
                    if (fp.hourElement) fp.hourElement.value = '';
                    if (fp.minuteElement) fp.minuteElement.value = '';
                }
                return; // Выходим, не давая старому времени вернуться
            }
            
            if (fp) {
                if (fp.selectedDates && fp.selectedDates.length > 0) {
                    input.value = fp.formatDate(fp.selectedDates[0], "H:i");
                } else if (fp.hourElement && fp.minuteElement) {
                    const h = fp.hourElement.value.padStart(2, '0');
                    const m = fp.minuteElement.value.padStart(2, '0');
                    input.value = `${h}:${m}`;
                }
                $(input).trigger('change');
            }
        });
    }

    // =========================================================================
    // 13. МАСКА И ОБРАБОТЧИК РУЧНОГО ВВОДА ДАТЫ И ВРЕМЕНИ - ЕДИНЫЙ БЛОК
    // =========================================================================
    $(document).on('input', '.custom-date-picker', function(e) {
        const input = this;
        const fp = input._flatpickr;
        
        // Если изменение инициировано самим Flatpickr - пропускаем
        if (fp && fp._isSettingValue) return;
        
        let value = input.value.replace(/[^\d]/g, '');
        if (value.length > 8) value = value.slice(0, 8);
        
        // 🛡️ ГЛАВНОЕ ИСПРАВЛЕНИЕ: Если значение уже в идеальном формате, не трогаем его!
        // Это предотвращает прерывание первого клика по календарю.
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(input.value)) {
            return;
        }
        
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

    $(document).on('blur', '.custom-date-picker', function() {
        const input = this;
        const fp = input._flatpickr;
        const currentValue = $(input).val().trim();

        // Если поле пустое, принудительно очищаем и выходим
        if (currentValue === '') {
            if (fp) {
                fp.selectedDates = [];
                fp.latestSelectedDateObj = null;
            }
            return;
        }
        
        if (fp && currentValue) {
            const dateMatch = currentValue.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
            if (dateMatch) {
                const day = parseInt(dateMatch[1], 10);
                const month = parseInt(dateMatch[2], 10) - 1;
                const year = parseInt(dateMatch[3], 10);
                const date = new Date(year, month, day);
                
                if (!isNaN(date.getTime())) {
                    fp.selectedDates = [date];
                    fp.latestSelectedDateObj = date;
                }
            }
        }
    });

    $(document).on('input', '.custom-time-picker', function(e) {
        const input = this;
        const fp = input._flatpickr;
        if (fp && fp._isSettingValue) return;
        
        let value = input.value.replace(/[^\d]/g, '');
        if (value.length > 4) value = value.slice(0, 4);
        
        let formatted = '';
        if (value.length > 0) {
            let hours = value.slice(0, 2);
            if (hours.length === 2) {
                const h = parseInt(hours, 10);
                if (h > 23) hours = '23';
                if (h < 0 && hours.length === 2) hours = '00';
            }
            formatted = hours;
        }
        if (value.length > 2) {
            formatted += ':';
            let minutes = value.slice(2, 4);
            if (minutes.length === 2) {
                const m = parseInt(minutes, 10);
                if (m > 59) minutes = '59';
                if (m < 0 && minutes.length === 2) minutes = '00';
            }
            formatted += minutes;
        }
        input.value = formatted;
    });

    $(document).on('blur', '.custom-time-picker', function() {
        const input = this;
        const fp = input._flatpickr;
        const currentValue = $(input).val().trim();

        // ГЛАВНОЕ ИСПРАВЛЕНИЕ: Если поле пустое, принудительно очищаем flatpickr и выходим
        if (currentValue === '') {
            if (fp) fp.clear();
            return; // Прерываем выполнение, чтобы старое время не вернулось
        }
        
        if (fp) {
            if (fp.selectedDates && fp.selectedDates.length > 0) {
                input.value = fp.formatDate(fp.selectedDates[0], "H:i");
            } else if (fp.hourElement && fp.minuteElement) {
                const h = fp.hourElement.value.padStart(2, '0');
                const m = fp.minuteElement.value.padStart(2, '0');
                input.value = `${h}:${m}`;
            }
            $(input).trigger('change');
        }
    });


        // =========================================================================
    // ОЧИСТКА ДАТЫ И ВРЕМЕНИ ПО КЛАВИШЕ BACKSPACE
    // =========================================================================
    $(document).on('keydown', '.custom-date-picker, .custom-time-picker', function(e) {
        if (e.key === 'Backspace') {
            const fp = this._flatpickr;
            if (fp && (fp.isOpen || $(this).val().trim().length > 0)) {
                fp.clear();
                fp.close();
                
                // КРИТИЧЕСКИ ВАЖНО: сбрасываем внутренние поля часов и минут,
                // иначе "запасной" blur обработчик вернёт старое время
                if (fp.hourElement) fp.hourElement.value = '';
                if (fp.minuteElement) fp.minuteElement.value = '';
                
                // Очищаем selectedDates принудительно
                fp.selectedDates = [];
                
                e.preventDefault();
            }
        }
    });

    // =========================================================================
    // 14. МОДАЛКА "НЕСКОЛЬКО МАШИН" (БЫСТРЫЙ ВВОД)
    // =========================================================================
    let multipleCarsRowCounter = 0;

    $('#multipleCarsBtn').click(function() {
        $('#multipleCarsList').empty();
        multipleCarsRowCounter = 0;
        addMultipleCarRow();
        addMultipleCarRow();
        $('#multipleCarsModal').fadeIn(200);
        setTimeout(function() {
            $('#multipleCarsList .multiple-car-input').first().focus();
        }, 250);
    });

    function closeMultipleCarsModal() {
        $('#multipleCarsModal').fadeOut(200);
    }
    $('#closeMultipleCarsBtn, #cancelMultipleCarsBtn, #multipleCarsOverlay').click(closeMultipleCarsModal);

    function addMultipleCarRow() {
        multipleCarsRowCounter++;
        const rowNum = multipleCarsRowCounter;
        
        let html = '<div class="multiple-car-row" data-row="' + rowNum + '">';
        html += '<span class="row-number">' + rowNum + '</span>';
        html += '<input type="text" class="edit-field multiple-car-input" data-type="plate-normalize" placeholder="Гос/номер" maxlength="15" autocomplete="off">';
        html += '<button class="remove-row-btn" type="button" title="Удалить строку">';
        html += '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">';
        html += '<path d="M18 6L6 18M6 6L18 18" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
        html += '</svg>';
        html += '</button>';
        html += '</div>';
        
        const $row = $(html);
        $('#multipleCarsList').append($row);
        
        const list = $('#multipleCarsList')[0];
        if (list) list.scrollTop = list.scrollHeight;
        
        return $row.find('.multiple-car-input');
    }

    $(document).on('click', '.remove-row-btn', function() {
        const $row = $(this).closest('.multiple-car-row');
        const $list = $('#multipleCarsList');
        if ($list.find('.multiple-car-row').length <= 1) {
            showToast('Должна остаться хотя бы одна строка', 'warning');
            return;
        }
        $row.fadeOut(200, function() {
            $(this).remove();
            renumberRows();
        });
    });

    function renumberRows() {
        $('#multipleCarsList .multiple-car-row').each(function(index) {
            $(this).find('.row-number').text(index + 1);
        });
        multipleCarsRowCounter = $('#multipleCarsList .multiple-car-row').length;
    }

    $(document).on('focus', '.multiple-car-input', function() {
        const $input = $(this);
        const $row = $input.closest('.multiple-car-row');
        const $list = $('#multipleCarsList');
        const $lastRow = $list.find('.multiple-car-row').last();
        
        if ($row.is($lastRow)) {
            let allPreviousFilled = true;
            $list.find('.multiple-car-input').not($input).each(function() {
                if ($(this).val().trim().length === 0) {
                    allPreviousFilled = false;
                    return false;
                }
            });
            if (allPreviousFilled) addMultipleCarRow();
        }
    });

    $(document).on('blur', '.multiple-car-input', function() {
        const $input = $(this);
        const $row = $input.closest('.multiple-car-row');
        const $list = $('#multipleCarsList');
        const $lastRow = $list.find('.multiple-car-row').last();
        
        if (!$row.is($lastRow) && $input.val().trim().length === 0) {
            if ($list.find('.multiple-car-row').length > 1) {
                $row.fadeOut(200, function() {
                    $(this).remove();
                    renumberRows();
                });
            }
        }
    });

    $('#submitMultipleCarsBtn').click(function() {
        const stateNumbers = [];
        $('#multipleCarsList .multiple-car-input').each(function() {
            const val = $(this).val().trim();
            if (val) stateNumbers.push(val);
        });
        
        if (stateNumbers.length === 0) {
            showToast('Заполните хотя бы один госномер!', 'warning');
            return;
        }

        const $btn = $(this);
        const originalText = $btn.text();
        $btn.text('Добавление...').prop('disabled', true);
        
        $.ajax({
            type: "POST",
            url: "add_multiple_records.php",
            data: { stateNumbers: JSON.stringify(stateNumbers) },
            dataType: 'json',
            success: function(response) {
                $btn.text(originalText).prop('disabled', false);
                if (response.success) {
                    showToast(response.message, 'success', 'multiple_add_success_' + Date.now());
                    closeMultipleCarsModal();
                    updateTableIfVisible();
                } else {
                    showToast(response.message || 'Ошибка при добавлении', 'error', 'multiple_add_error_' + Date.now());
                }
            },
            error: function() {
                $btn.text(originalText).prop('disabled', false);
                showToast('Ошибка сети при добавлении записей', 'error', 'multiple_add_network_error_' + Date.now());
            }
        });
    });

}); // КОНЕЦ $(document).ready