$(document).ready(function() {


  // ==================== HEARTBEAT  ====================
// Продлеваем сессию каждые 5 минут, пока страница открыта
(function() {
    function sendHeartbeat() {
        fetch('./heartbeat.php', {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store'
        })
        .then(response => {
            if (response.status === 401) {
                // Сессия умерла — редирект на вход
                window.location.href = './';
            }
        })
        .catch(error => {
            // Игнорируем ошибки сети
        });
    }
    
    // Запускаем сразу при загрузке
    sendHeartbeat();
    
    // И каждые 5 минут
    setInterval(sendHeartbeat, 5 * 60 * 1000);
})();

    // ======================== CSRF-ЗАЩИТА ========================
    const csrfToken = $('meta[name="csrf-token"]').attr('content');

    $.ajaxSetup({
        beforeSend: function(xhr, settings) {
            if (settings.type === 'POST') {
                xhr.setRequestHeader('X-CSRF-TOKEN', csrfToken);
            }
        }
    });


 // ======================== СОРТИРОВКА ТАБЛИЦЫ ========================
$(document).on('click', '.table-header-cell.sortable', function() {
    const $th = $(this);
    const $table = $th.closest('table');
    const column = $th.data('sort');
    
    if (!column) return;
    
    // Если у строк ещё нет original-index — сохраняем текущий порядок
    const $tbody = $table.find('tbody');
    const $firstRow = $tbody.find('tr.table-row').first();
    if ($firstRow.data('original-index') === undefined) {
        $tbody.find('tr.table-row').each(function(index) {
            $(this).data('original-index', index);
        });
    }
    
    // Определяем направление сортировки (3 состояния)
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
        
        // Обновляем цвета строк
        $tbody.find('tr.table-row').each(function() {
            const $inspectionInput = $(this).find('input[data-field="inspection"]');
            if ($inspectionInput.length) {
                updateRowColors($(this), $inspectionInput.is(':checked') ? 1 : 0);
            }
        });
        return;
    }
    
    // Если direction === null — выходим
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
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        }
    });
    
    $.each($rows, function(idx, row) {
        $tbody.append(row);
    });
    
    // Обновляем цвета строк
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
        }, 3000);
        
        if (notificationId) {
            markNotificationAsShown(notificationId);
        }
    }


// ==================== МАСКА ДАТЫ ДЛЯ TEXT-ПОЛЕЙ ====================
$(document).on('input', 'input[data-type="date-mask"]', function() {
    const input = this;
    let value = input.value.replace(/\D/g, ''); // Только цифры
    
    // Форматируем: ДДММГГГГ
    if (value.length > 8) value = value.slice(0, 8);
    
    let formatted = '';
    if (value.length > 0) {
        // День (первые 2 цифры)
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
        // Месяц (следующие 2 цифры)
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
        // Год (последние 4 цифры) — при переполнении сдвиг
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

    // ======================== ЗАЯВКИ ========================
    let currentRequests = [];
    let currentRequestId = null;
    let lastRequestCount = 0;

    function loadPendingRequests() {
        $.ajax({
            type: "GET",
            url: "get_pending_requests.php",
            dataType: 'json',
            success: function(response) {
                if (response.success) {
                    currentRequests = response.requests;
                    const count = response.count;
                    
                    updateMessageUI(count);
                    
                    if (count > lastRequestCount && lastRequestCount > 0) {
                        showToast('Поступила новая заявка!', 'info');
                    }
                    
                    lastRequestCount = count;
                }
            }
        });
    }

 function updateMessageUI(count) {
    const $wrapper = $('#messageWrapper');
    const $badge = $('#messageBadge');
    const $card = $('#messageCard');
    const $text = $('#messageText');

    if (count > 0) {
        $wrapper.show();
        $badge.text(count);
        
        if (count === 1) {
            $text.text('1 новая заявка');
        } else if (count < 5) {
            $text.text(count + ' новые заявки');
        } else {
            $text.text(count + ' новых заявок');
        }
        
        $card.addClass('pulse');
    } else {
        $wrapper.hide();
        $card.removeClass('pulse');
    }
}

function openRequestsList() {
    const list = $('#requestsList');
    list.empty();

    if (currentRequests.length === 0) {
        list.html('<div class="empty-list">Нет заявок</div>');
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
            item.click(function() {
                openRequestDetail($(this).data('id'));
            });
            list.append(item);
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
                
                const title = req.full_name_applicant || 'Заявка без ФИО';
                $('#requestId').text(title);
                
                const body = $('#requestDetailBody');
                body.empty();
                
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

                fields.forEach(function(f) {
                    if (f.value && f.value !== '' && f.value !== '0000-00-00' && f.value !== '00:00:00') {
                        body.append(`
                            <div class="detail-row">
                                <span class="detail-label">${f.label}</span>
                                <span class="detail-value">${escapeHtml(String(f.value))}</span>
                            </div>
                        `);
                    }
                });

                $('#requestsListModal').fadeOut(200, function() {
                    $('#requestDetailModal').fadeIn(200);
                });
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
        error: function() {
            showToast("Ошибка при обработке заявки", 'error', 'request_network_error_' + id);
        }
    });
}

    $('#messageCard').click(function() {
        openRequestsList();
    });

    $('#closeListBtn').click(function() {
        $('#requestsListModal').fadeOut(200);

    });

    $('#closeDetailBtn').click(function() {
        $('#requestDetailModal').fadeOut(200);
    });

    $('#approveBtn').click(function() {
        if (currentRequestId) {
            processRequest(currentRequestId, 'approve');
        }
    });

    $('#rejectBtn').click(function() {
        if (currentRequestId) {
            processRequest(currentRequestId, 'reject');
        }
    });

    // ======================== ПОИСК И ТАБЛИЦЫ ========================
    function updateTableIfVisible() {
    if ($('.choice').is(':visible')) {
        return;
    }
    
    const isSearchOpen = $('.new-entry.search').is(':visible');
    const isEntryOpen = $('.new-entry:not(.search)').is(':visible');
    
    if (isSearchOpen) {
        performSearch();
    } else if (isEntryOpen) {
        loadLastRecords();
    }
}

    function performSearch() {
        showTableLoader();
        
        const search = $('#searchInput').val().trim();
        const inspection = $('#inspectionFilter').is(':checked');
        const yearRecord = $('#yearRecordFilter').is(':checked');
        const dateFilter = $('#dateFilter').val();

        $.ajax({
            type: "GET",
            url: "search_records.php",
            data: {
                search: search,
                inspection: inspection,
                yearRecord: yearRecord,
                dateFilter: dateFilter
            },
            success: function(response) {
                hideTableLoader(() => {
                    $("#results").html(response);
                    $('#results .my-table').addClass('table-loaded');
                    hideEmptyDateMasks();
                });
            },
            error: function() {
                hideTableLoader(() => {
                    $("#results").html('<div class="empty-message">Ошибка при загрузке данных</div>');
                });
            }
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
                    hideEmptyDateMasks();
                });
            },
            error: function() {
                hideTableLoader(() => {
                    $("#results").html('<div class="empty-message">Ошибка при загрузке данных</div>');
                });
            }
        });
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

    // ======================== АНИМАЦИЯ ЗАГРУЗКИ ТАБЛИЦЫ ========================
    function showTableLoader() {
        const loaderHtml = `
            <div class="table-loader" id="tableLoader">
                <div class="skeleton-table">
                    <div class="skeleton-header">
                        ${Array(12).fill('').map(() => `<div class="skeleton-cell"><div class="skeleton-block medium"></div></div>`).join('')}
                    </div>
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
            </div>
        `;
        
        $("#results").html(loaderHtml);
    }

    function hideTableLoader(callback) {
        const loader = $('#tableLoader');
        if (loader.length) {
            loader.addClass('fade-out');
            setTimeout(() => {
                if (callback) callback();
            }, 300);
        } else {
            if (callback) callback();
        }
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



    let pendingSubmitData = null;
let pendingSubmitYearRecord = 0;

    // ======================== ФОРМА ДОБАВЛЕНИЯ ЗАПИСИ ========================
    $("#carForm").submit(function(event) {
    event.preventDefault();

    const carMake = $("input[name='carMake']").val().trim();
    const stateNumber = $("input[name='stateNumber']").val().trim();
    const driverLastName = $("input[name='driverLastName']").val().trim();
    const fullNameApplicant = $("input[name='fullNameApplicant']").val().trim();
    const entryDate = $("#entryDate").val();
    const outDate = $("#outDate").val();
    const comment = $("textarea[name='comment']").val().trim();
    const yearRecord = $("input[name='yearRecord']").is(':checked') ? 1 : 0;

    if (!carMake && !stateNumber && !driverLastName && !fullNameApplicant &&
        !entryDate && !outDate && !comment) {
        showToast("Пожалуйста, заполните хотя бы одно поле!", 'warning', 'validation_fields_' + Date.now());
        return;
    }

    // Сохраняем данные и показываем модалку
    pendingSubmitData = $(this).serialize();
    pendingSubmitYearRecord = yearRecord;
    
    $('#confirmSubmitText').text('Вы уверены, что хотите добавить эту запись?');
    $('#confirmSubmitOk').text('Добавить');
    $('#confirmSubmitModal').addClass('active');
});

// ======================== ОБРАБОТЧИКИ МОДАЛКИ ПОДТВЕРЖДЕНИЯ ========================
$('#confirmSubmitCancel').click(function() {
    $('#confirmSubmitModal').removeClass('active');
    pendingSubmitData = null;
});

$('#confirmSubmitOverlay').click(function() {
    $('#confirmSubmitModal').removeClass('active');
    pendingSubmitData = null;
});

$('#confirmSubmitOk').click(function() {
    if (!pendingSubmitData) return;
    
    const $btn = $(this);
    const originalText = $btn.text();
    $btn.text('Добавление...').prop('disabled', true);
    
    $.ajax({
        type: "POST",
        url: "record.php",
        data: pendingSubmitData,
        dataType: 'json',
        success: function(response) {
            $('#confirmSubmitModal').removeClass('active');
            $btn.text(originalText).prop('disabled', false);
            
            if (response.success) {
                showToast(response.message, 'success', 'record_add_success_' + Date.now());
                if (!pendingSubmitYearRecord) {
                    $("#carForm")[0].reset();
                }
                updateTableIfVisible();
            } else {
                showToast(response.message, 'error', 'record_add_error_' + Date.now());
            }
            pendingSubmitData = null;
        },
        error: function(xhr) {
            $('#confirmSubmitModal').removeClass('active');
            $btn.text(originalText).prop('disabled', false);
            
            let errorMsg = "Произошла ошибка при отправке данных.";
            try {
                const errResponse = JSON.parse(xhr.responseText);
                if (errResponse.message) errorMsg = errResponse.message;
            } catch (e) {}
            showToast(errorMsg, 'error', 'record_add_error_' + Date.now());
            pendingSubmitData = null;
        }
    });
});

// Закрытие по Escape
$(document).on('keydown', function(e) {
    if (e.key === 'Escape' && $('#confirmSubmitModal').hasClass('active')) {
        $('#confirmSubmitModal').removeClass('active');
        pendingSubmitData = null;
    }
});

    // ======================== РЕДАКТИРОВАНИЕ ЗАПИСЕЙ ========================
    $(document).on('click', '.edit-btn', function() {
        const row = $(this).closest('tr');
        row.addClass('editing');
        row.find('.edit-field').prop('disabled', false);
        row.find('.table-check').prop('disabled', false);
        
        const $carInput = row.find('input[data-field="car_make"]');
        if (!$carInput.closest('.autocomplete-wrapper').length) {
            $carInput.wrap('<div class="autocomplete-wrapper"></div>');
            initBrandAutocomplete($carInput);
        }
        
        $(this).hide();
        row.find('.save-btn').show();
    });

    $(document).on('change', '.table-check[data-field="inspection"]', function() {
        const row = $(this).closest('tr');
        const inspection = $(this).is(':checked') ? 1 : 0;
        updateRowColors(row, inspection);
    });

    function updateRowColors(row, inspection) {
        if (inspection == 1) {
            row.css({
                'background-color': 'rgba(255, 204, 0, 0.15)',
                'border-left': '4px solid #ffcc00'
            });
        } else {
            row.css({
                'background-color': '',
                'border-left': ''
            });
        }
    }

    $(document).on('click', '.save-btn', async function() {
        const row = $(this).closest('tr');
        row.removeClass('editing');
        const id = row.data('id');

        const inspectionValue = row.find('input[data-field="inspection"]').is(':checked') ? 1 : 0;
        const yearRecord = row.find('input[data-field="year_record"]').is(':checked') ? 1 : 0;

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
            inspection: inspectionValue,
            year_record: yearRecord
        };

        if (!data.car_make && !data.state_number && !data.driver_last_name && 
            !data.full_name_applicant && !data.comment && !data.entry_date && !data.out_date) {
            showToast("Пожалуйста, заполните хотя бы одно поле!", 'warning', 'validation_save_' + Date.now());
            return; 
        }

        try {
            await $.ajax({
                type: "POST",
                url: "update_record.php",
                data: data
            });

            showToast("Данные успешно обновлены!", 'success', 'record_update_' + id);

            row.find('.edit-field').prop('disabled', true);
            row.find('.table-check').prop('disabled', true);
            row.find('.edit-btn').show();
            row.find('.save-btn').hide();

            hideEmptyDateMasks();
            updateRowColors(row, data.inspection);
            updateTableIfVisible();
            
        } catch (error) {
            console.error("Ошибка при запросе: ", error);
            showToast("Ошибка при обновлении данных.", 'error', 'record_update_error_' + id);
        }
    });

    // ======================== УДАЛЕНИЕ ЗАПИСЕЙ ========================
let deleteId = null;

$(document).on('click', '.delete-btn', function() {
    deleteId = $(this).data('id');
    $('#confirmModal').addClass('active');
});

$('#confirmCancel').click(function() {
    $('#confirmModal').removeClass('active');
    deleteId = null;
});

$('#confirmOk').click(function() {
    if (!deleteId) return;
    
    $.ajax({
        type: "POST",
        url: "delete_record.php",
        data: { id: deleteId },
        dataType: 'json',
        success: function(response) {
            if (response.success) {
                showToast(response.message, 'success', 'record_delete_' + deleteId);
            } else {
                showToast(response.message, 'error', 'record_delete_error_' + deleteId);
            }
            $('#confirmModal').removeClass('active');
            updateTableIfVisible();
            deleteId = null;
        },
        error: function(xhr) {
            let errorMsg = "Произошла ошибка при удалении записи.";
            try {
                const errResponse = JSON.parse(xhr.responseText);
                if (errResponse.message) errorMsg = errResponse.message;
            } catch (e) {}
            showToast(errorMsg, 'error', 'record_delete_error_' + deleteId);
        }
    });
});

    // ======================== НАВИГАЦИЯ ========================
$('#entryBtn').click(function() {
    $('.choice').hide();
    $('.new-entry').hide();
    $('.new-entry:not(.search)').show();
    $('#newEntryBtnBack').show();
    loadLastRecords();
});


$('#searchBtn').click(function() {
    $('.choice').hide();
    $('.new-entry').hide();
    $('.new-entry.search').show();
    $('#newEntryBtnBack').show();
    performSearch();
});

$('#newEntryBtnBack').click(function() {
    $('.new-entry').hide();
    $('.choice').show();
    $(this).hide();
    $('#results').empty();
});

$("#clearFormBtn").click(function() {
    $("#carForm")[0].reset();
    
    // Сбрасываем ошибки валидации
    $('.field-error').removeClass('visible');
    $('.required-field').removeClass('field-error-active');
    
    showToast("Форма очищена", 'info', 'form_cleared_' + Date.now());
});

    // ======================== ПОИСК ========================
    let searchTimer;
    
    $('#searchInput').on('input', function() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(performSearch, 500);
    });

    $('#inspectionFilter, #yearRecordFilter').change(performSearch);
    
    $('#dateFilter').change(performSearch);

    $("#clearSearchBtn").click(function() {
        $('#searchInput').val('');
        $('#inspectionFilter').prop('checked', false);
        $('#yearRecordFilter').prop('checked', false);
        $('#dateFilter').val('');
        performSearch();
        showToast("Фильтры поиска сброшены", 'info', 'search_clear_' + Date.now());
    });

    // ======================== УТИЛИТЫ ========================
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    // ======================== ИНИЦИАЛИЗАЦИЯ ========================
    loadPendingRequests();
    setInterval(loadPendingRequests, 5000);

});