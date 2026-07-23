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
    let searchTimer;
    let resizeTimer;
    let hasUnsavedChanges = false;
    const undoStore = {};

    // =========================================================================
    // 3. ЗАЩИТА ОТ ПОТЕРИ ДАННЫХ
    // =========================================================================
    $(document).on('input change', '.new-entry__input, .new-entry__input-comment, .new-entry__input-checkbox', () => hasUnsavedChanges = true);
    $(document).on('change', '.table-check', () => hasUnsavedChanges = true);

    window.addEventListener('beforeunload', function(e) {
        if (hasUnsavedChanges) {
            e.returnValue = 'У вас есть несохранённые изменения.';
            return e.returnValue;
        }
    });


    // ==================== SCREEN LOADER ====================
function showScreenLoader() {
    $('#screenLoader').addClass('active');
}

function hideScreenLoader() {
    $('#screenLoader').removeClass('active');
}

    // =========================================================================
    // 4. УТИЛИТЫ И УВЕДОМЛЕНИЯ
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
        setTimeout(() => toast.fadeOut(300, function() { $(this).remove(); }), 3000);
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
    // 5. UI ТАБЛИЦЫ
    // =========================================================================
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
    // 6. РАБОТА С ЗАЯВКАМИ
    // =========================================================================
    function loadPendingRequests() {
        $.ajax({ type: "GET", url: "get_pending_requests.php", dataType: 'json', success: function(response) {
            if (response.success) {
                currentRequests = response.requests;
                if (response.count > lastRequestCount && lastRequestCount > 0) showToast('Поступила новая заявка!', 'info');
                lastRequestCount = response.count;
                updateMessageUI(response.count);
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

    $('#messageCard').click(function() {
        const $list = $('#requestsList').empty();
        if (currentRequests.length === 0) {
            $list.html('<div class="empty-list">Нет заявок</div>');
        } else {
            currentRequests.forEach(function(req) {
                const date = req.created_at ? new Date(req.created_at).toLocaleString('ru-RU') : '';
                const item = $(`<div class="request-list-item" data-id="${req.id}">
                    <div class="request-list-item-header"><span class="request-list-item-title">${escapeHtml(req.full_name_applicant || 'Без ФИО')}</span><span class="request-list-item-date">${date}</span></div>
                    <div class="request-list-item-body">
                        ${req.car_make ? '<span class="request-tag">' + escapeHtml(req.car_make) + '</span>' : ''}
                        ${req.state_number ? '<span class="request-tag">' + escapeHtml(req.state_number) + '</span>' : ''}
                        <span class="request-tag request-tag-id">#${req.id}</span>
                    </div></div>`);
                item.click(() => openRequestDetail(req.id));
                $list.append(item);
            });
        }
        $('#requestsListModal').fadeIn(200);
    });

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
      showScreenLoader();
        $.ajax({ type: "POST", url: "process_request.php", data: { id: id, action: action }, dataType: 'json', success: function(response) {
            if (response.success) {
                showToast(response.message, action === 'approve' ? 'success' : 'warning', 'request_' + action + '_' + id);
                $('#requestDetailModal').fadeOut(200);
                loadPendingRequests();
                updateTableIfVisible();
            } else {
                showToast(response.message, 'error', 'request_error_' + id);
            }
        }});
    }

    // =========================================================================
    // 7. ЗАГРУЗКА И ПОИСК В ТАБЛИЦАХ
    // =========================================================================
    function updateTableIfVisible() {
        if ($('.choice').is(':visible')) return;
        if ($('.new-entry.search').is(':visible')) performSearch();
        else if ($('.new-entry:not(.search)').is(':visible')) loadLastRecords();
    }

    function showTableLoader() {
        $("#results").html(`<div class="table-loader" id="tableLoader"><div class="skeleton-table"><div class="skeleton-header">${Array(12).fill('').map(() => `<div class="skeleton-cell"><div class="skeleton-block medium"></div></div>`).join('')}</div>${Array(5).fill('').map(() => `<div class="skeleton-row">${Array(12).fill('').map(() => `<div class="skeleton-cell"><div class="skeleton-block medium"></div></div>`).join('')}</div>`).join('')}</div></div>`);
    }

    function hideTableLoader(callback) {
        const loader = $('#tableLoader');
        const finish = () => { if (callback) callback(); refreshTableUI(); };
        if (loader.length) { loader.addClass('fade-out'); setTimeout(finish, 300); } else { finish(); }
    }

function performSearch() {
    showScreenLoader();
    $.ajax({
        type: "GET",
        url: "search_records.php",
        cache: false,
        data: {
            search: $('#searchInput').val().trim(),
            inspection: $('#inspectionFilter').is(':checked'),
            yearRecord: $('#yearRecordFilter').is(':checked'),
            dateFilter: $('#dateFilter').val()
        },
        success: function(response) {
            hideScreenLoader();
            hideTableLoader(() => {
                $("#results").html(response);
                $('#results .my-table').addClass('table-loaded');
            });
        },
        error: () => {
            hideScreenLoader();
            hideTableLoader(() => $("#results").html('<div class="empty-message">Ошибка при загрузке данных</div>'));
        }
    });
}

function loadLastRecords() {
    showScreenLoader();
    $.ajax({
        type: "GET",
        url: "get_last_records.php",
        cache: false,
        success: function(response) {
            hideScreenLoader();
            hideTableLoader(() => {
                $("#results").html(response);
                $('#results .my-table').addClass('table-loaded');
            });
        },
        error: () => {
            hideScreenLoader();
            hideTableLoader(() => $("#results").html('<div class="empty-message">Ошибка при загрузке данных</div>'));
        }
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
    // 9. ДОБАВЛЕНИЕ НОВОЙ ЗАПИСИ
    // =========================================================================
    $("#carForm").submit(function(event) {
        event.preventDefault();
        const fullNameApplicant = $("input[name='fullNameApplicant']").val().trim();
        if (!fullNameApplicant) { showFieldError($('#fullNameApplicant'), $('#fullNameError')); showToast("Пожалуйста, укажите ФИО инициатора!", 'warning'); return; }
        if (!$("input[name='carMake']").val().trim() && !$("input[name='stateNumber']").val().trim() && !$("input[name='driverLastName']").val().trim() && !$("input[name='entryDate']").val() && !$("input[name='outDate']").val() && !$("textarea[name='comment']").val().trim()) {
            showToast("Пожалуйста, заполните хотя бы одно дополнительное поле!", 'warning'); return;
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
        $btn.text('Добавление...').prop('disabled', true);
        $.ajax({ type: "POST", url: "record.php", data: pendingSubmitData, dataType: 'json', success: function(response) {
            $('#confirmSubmitModal').removeClass('active'); $btn.prop('disabled', false);
            if (response.success) {
                showToast(response.message, 'success', 'record_add_success_' + Date.now());
                if (!pendingSubmitYearRecord) $("#carForm")[0].reset();
                updateTableIfVisible(); hasUnsavedChanges = false;
            } else { showToast(response.message, 'error', 'record_add_error_' + Date.now()); }
            pendingSubmitData = null;
        }, error: function(xhr) {
            $('#confirmSubmitModal').removeClass('active'); $btn.prop('disabled', false);
            showToast("Произошла ошибка при отправке данных.", 'error', 'record_add_error_' + Date.now());
            pendingSubmitData = null;
        }});
    });

    // =========================================================================
    // 10. РЕДАКТИРОВАНИЕ, СОХРАНЕНИЕ И ОТКАТ
    // =========================================================================
   $(document).on('click', '.edit-btn', function() {
            const $editingRow = $('.table-row.editing');
            if ($editingRow.length > 0) {
                showToast("Нельзя редактировать несколько записей одновременно.", 'warning', 'multi_edit_blocked_' + Date.now());
                return;
            }
            const row = $(this).closest('tr');
            const id = row.data('id');
            
            // Сохраняем данные до редактирования
            undoStore[id] = {
                car_make: row.find('input[data-field="car_make"]').val(),
                state_number_main: row.find('input[data-field="state_number_main"]').val(),
                state_number_region: row.find('input[data-field="state_number_region"]').val(),
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
    const previousData = undoStore[id];
    
    const stateMain = row.find('input[data-field="state_number_main"]').val().trim();
    const stateRegion = row.find('input[data-field="state_number_region"]').val().trim();
    const finalStateNumber = stateRegion ? `${stateMain} ${stateRegion}` : stateMain;

    const data = {
        id: id,
        car_make: row.find('input[data-field="car_make"]').val().trim(),
        state_number: finalStateNumber,
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

    showScreenLoader(); // ← ДОБАВИТЬ

    try {
        const response = await $.ajax({
            type: "POST",
            url: "update_record.php",
            data: data,
            dataType: 'json'
        });

        hideScreenLoader(); // ← ДОБАВИТЬ

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
                    const $undoBtn = $newRow.find('.undo-btn');
                    $undoBtn.attr('data-undo-id', id);
                    $undoBtn.show().addClass('show');
                }
            }, 600);
        } else {
            const errorMsg = (response && response.message) ? response.message : "Ошибка при обновлении данных.";
            showToast(errorMsg, 'error', 'record_update_error_' + id + '_' + Date.now());
        }
    } catch (error) {
        hideScreenLoader(); // ← ДОБАВИТЬ
        showToast("Ошибка при обновлении данных.", 'error', 'record_update_error_' + id + '_' + Date.now());
    }
});

$(document).on('click', '.undo-btn', async function() {
    const $undoBtn = $(this);
    const $row = $undoBtn.closest('tr');
    const id = parseInt($undoBtn.attr('data-undo-id')) || $row.data('id');
    const previousData = undoStore[id];
    
    if (!previousData) {
        showToast("Нет данных для отката", 'error', 'undo_no_data_' + Date.now());
        return;
    }
    
    showScreenLoader(); // ← ДОБАВИТЬ
    
    try {
        const response = await $.ajax({
            type: "POST",
            url: "undo_record.php",
            data: {
                id: id,
                previousData: JSON.stringify(previousData)
            },
            dataType: 'json',
            cache: false
        });
        
        hideScreenLoader(); // ← ДОБАВИТЬ
        
        if (response && response.success) {
            showToast("Данные восстановлены", 'success', 'undo_success_' + Date.now());
            delete undoStore[id];
            $undoBtn.hide().removeClass('show');
            
            setTimeout(() => {
                updateTableIfVisible();
            }, 500);
        } else {
            showToast((response && response.message) ? response.message : "Ошибка при откате", 'error', 'undo_error_' + Date.now());
        }
    } catch (error) {
        hideScreenLoader(); // ← ДОБАВИТЬ
        showToast("Ошибка сети при откате", 'error', 'undo_network_error_' + Date.now());
    }
});

        $(document).on('click', '.delete-btn', function() {
            deleteId = $(this).data('id');
            $('#confirmModal').addClass('active');
        });
        $('#confirmCancel').click(function() { $('#confirmModal').removeClass('active'); deleteId = null; });
        $('#confirmOk').click(function() {
            if (!deleteId) return;
            
            showScreenLoader(); // ← ДОБАВИТЬ
            
            $.ajax({
                type: "POST",
                url: "delete_record.php",
                data: { id: deleteId },
                dataType: 'json',
                success: function(response) {
                    hideScreenLoader(); // ← ДОБАВИТЬ
                    showToast(response.message, response.success ? 'success' : 'error', 'record_delete_' + deleteId);
                    $('#confirmModal').removeClass('active');
                    updateTableIfVisible();
                    deleteId = null;
                    $('.undo-btn').hide().removeClass('show');
                },
                error: function() {
                    hideScreenLoader(); // ← ДОБАВИТЬ
                    showToast("Произошла ошибка при удалении записи.", 'error', 'record_delete_error_' + deleteId);
                }
            });
        });

    // =========================================================================
    // 11. НАВИГАЦИЯ И ПОИСК
    // =========================================================================
    $('#entryBtn').click(function() { $('.choice, .new-entry').hide(); $('.new-entry:not(.search)').show(); $('#newEntryBtnBack').show(); loadLastRecords(); });
    $('#searchBtn').click(function() { $('.choice, .new-entry').hide(); $('.new-entry.search').show(); $('#newEntryBtnBack').show(); performSearch(); });
    
    $('#newEntryBtnBack').click(function() {
        if (hasUnsavedChanges && !confirm('У вас есть несохранённые изменения. Вернуться назад?')) return;
        $('.new-entry').hide(); $('.choice').show(); $(this).hide(); $('#results').empty(); hasUnsavedChanges = false; 
    });

    $("#clearFormBtn").click(function() {
        $("#carForm")[0].reset(); $('.field-error').removeClass('visible'); $('.required-field').removeClass('field-error-active');
        showToast("Форма очищена", 'info', 'form_cleared_' + Date.now()); hasUnsavedChanges = false; 
    });

    $('#searchInput').on('input', function() { clearTimeout(searchTimer); searchTimer = setTimeout(performSearch, 500); });
    $('#inspectionFilter, #yearRecordFilter, #dateFilter').on('change', performSearch);
    $("#clearSearchBtn").click(function() {
        $('#searchInput').val(''); $('#inspectionFilter, #yearRecordFilter').prop('checked', false); $('#dateFilter').val('');
        performSearch(); showToast("Фильтры поиска сброшены", 'info', 'search_clear_' + Date.now());
    });

    $(document).on('keydown', function(e) {
        if (e.key === 'Escape') {
            if ($('#confirmSubmitModal').hasClass('active')) { $('#confirmSubmitModal').removeClass('active'); pendingSubmitData = null; }
            if ($('#confirmModal').hasClass('active')) { $('#confirmModal').removeClass('active'); deleteId = null; }
            if ($('#requestDetailModal').is(':visible')) $('#requestDetailModal').fadeOut(200);
            if ($('#requestsListModal').is(':visible')) $('#requestsListModal').fadeOut(200);
        }
    });

    // =========================================================================
    // 12. СОРТИРОВКА ТАБЛИЦЫ
    // =========================================================================
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

    // =========================================================================
    // 13. ИНИЦИАЛИЗАЦИЯ
    // =========================================================================
    loadPendingRequests();
    setInterval(loadPendingRequests, 5000);
    setTimeout(refreshTableUI, 500);
    $(document).on('DOMNodeInserted', '#results', function() { setTimeout(refreshTableUI, 100); });
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