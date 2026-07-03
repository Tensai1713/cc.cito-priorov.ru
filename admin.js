$(document).ready(function() {

  const csrfToken = $('meta[name="csrf-token"]').attr('content');

// Добавляем токен ко всем AJAX-запросам
$.ajaxSetup({
    beforeSend: function(xhr, settings) {
        if (settings.type === 'POST') {
            xhr.setRequestHeader('X-CSRF-TOKEN', csrfToken);
        }
    }
});







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



  // Для формы добавления записи
    $('input[name="carMake"]').each(function() {
        $(this).wrap('<div class="autocomplete-wrapper"></div>');
        initBrandAutocomplete($(this));
    });
    
    // Для таблицы (редактирование)
    $(document).on('click', '.edit-btn', function() {
        const row = $(this).closest('tr');
        const $carInput = row.find('input[data-field="car_make"]');
        
        if (!$carInput.closest('.autocomplete-wrapper').length) {
            $carInput.wrap('<div class="autocomplete-wrapper"></div>');
            initBrandAutocomplete($carInput);
        }
    });

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

  // ======================== СИСТЕМА УПРАВЛЕНИЯ УВЕДОМЛЕНИЯМИ ========================

function hasNotificationBeenShown(notificationId) {
    return sessionStorage.getItem('notification_' + notificationId) === 'true';
}

function markNotificationAsShown(notificationId) {
    sessionStorage.setItem('notification_' + notificationId, 'true');
}

function resetAllNotifications() {
    Object.keys(sessionStorage).forEach(function(key) {
        if (key.startsWith('notification_')) {
            sessionStorage.removeItem(key);
        }
    });
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

// ======================== КАСТОМНЫЙ ТУЛТИП ДЛЯ ПЕРЕПОЛНЕНИЯ ========================
const $tooltip = $('<div class="cell-tooltip"></div>').appendTo('body');

$(document).on('mouseenter', '.edit-field', function() {
    const el = this;
    const val = $(el).val();
    if (!val) return;

    // Проверяем переполнение по ширине (для input) или высоте (для textarea)
    const isOverflowing = el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;

    if (isOverflowing) {
        $tooltip.text(val).addClass('visible');
    }
});

$(document).on('mousemove', '.edit-field', function(e) {
    if ($tooltip.hasClass('visible')) {
        let x = e.clientX + 15;
        let y = e.clientY + 15;

        // Проверяем, не выходит ли тултип за пределы экрана
        const tooltipRect = $tooltip[0].getBoundingClientRect();
        if (x + tooltipRect.width > window.innerWidth) {
            x = e.clientX - tooltipRect.width - 15;
        }
        if (y + tooltipRect.height > window.innerHeight) {
            y = e.clientY - tooltipRect.height - 15;
        }

        $tooltip.css({ left: x, top: y });
    }
});

$(document).on('mouseleave', '.edit-field', function() {
    $tooltip.removeClass('visible');
});




    // ======================== ТОСТЫ ========================
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
        }, 3000);
    }

    // ======================== ЛОГИКА ЗАЯВОК ========================
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
                updateMessageUI(response.count);
            }
        }
    });
}

    function updateMessageUI(count) {
        const wrapper = $('#messageWrapper');
        const badge = $('#messageBadge');
        const card = $('#messageCard');
        const text = $('#messageText');

        if (count > 0) {
            wrapper.show();
            badge.text(count).show();
            text.text(count === 1 ? '1 новая заявка' : count + ' новых заявок');
            card.addClass('pulse');
            if (count > lastRequestCount && lastRequestCount > 0) {
                  showToast('Поступило ' + (count - lastRequestCount) + ' новых заявок!', 'info');
              }
        } else {
            wrapper.hide();
        }
        lastRequestCount = count;
    }

    $('#messageCard').click(function() {
        if (currentRequests.length === 0) return;
        if (currentRequests.length === 1) {
            openRequestDetail(currentRequests[0].id);
        } else {
            openRequestsList();
        }
    });

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

    $('#closeListBtn').click(function() {
        $('#requestsListModal').fadeOut(200);
    });

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
                
                // Заголовок — ФИО инициатора вместо номера
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

    $('#closeDetailBtn').click(function() {
        $('#requestDetailModal').fadeOut(200);
    });

    $('#approveBtn').click(function() {
        if (!currentRequestId) return;
        processRequest(currentRequestId, 'approve');
    });

    $('#rejectBtn').click(function() {
        if (!currentRequestId) return;
        processRequest(currentRequestId, 'reject');
    });

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
                
                // Обновляем таблицу только если она сейчас видима
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

function updateTableIfVisible() {
    const isSearchOpen = !$('.search').hasClass('none');
    const isEntryOpen = !$('.new-entry:not(.search)').hasClass('none');
    
    if (isSearchOpen) {
        performSearch();
    } else if (isEntryOpen) {
        loadLastRecords();
    }
}

function loadAllRecords() {
    showTableLoader();
    
    $.ajax({
        type: "GET",
        url: "get_all_records.php",
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

    // ======================== СТАРАЯ ЛОГИКА (МЕНЮ, ФОРМЫ, ТАБЛИЦА) ========================
    
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

    // Отправка формы добавления
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

    $.ajax({
        type: "POST",
        url: "record.php",
        data: $(this).serialize(),
        success: function(response) {
            showToast(response, 'success', 'record_add_success_' + Date.now());
            if (!yearRecord) {
                $("#carForm")[0].reset();
            }
            // Обновляем таблицу только если она видима
            updateTableIfVisible();
        },
        error: function() {
            showToast("Произошла ошибка при отправке данных.", 'error', 'record_add_error_' + Date.now());
        }
    });
});

    // Очистка формы добавления
    $("#clearFormBtn").click(function() {
        $("#carForm")[0].reset(); 
    });

    // Очистка формы поиска
    $("#clearSearchBtn").click(function() {
    $('#searchInput').val('');
    $('#inspectionFilter').prop('checked', false);
    $('#yearRecordFilter').prop('checked', false);
    $('#dateFilter').val('');
    performSearch();
    showToast("Фильтры поиска сброшены", 'info', 'search_clear_' + Date.now());
});

    // ======================== УДАЛЕНИЕ ЗАПИСИ ========================
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
        success: function(response) {
            showToast(response, 'success', 'record_delete_' + deleteId);
            $('#confirmModal').removeClass('active');
            updateTableIfVisible();
            deleteId = null;
        },
        error: function() {
            showToast("Произошла ошибка при удалении записи.", 'error', 'record_delete_error_' + deleteId);
        }
    });
});

    // ======================== ПОИСК ========================
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
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

    const debouncedSearch = debounce(performSearch, 1000);

    $('#searchInput').on('input', function() {
        debouncedSearch();
    });

    $('#inspectionFilter, #yearRecordFilter').on('change', function() {
        performSearch();
    });

    $('#dateFilter').on('change', function() {
        performSearch();
    });

    // ======================== ЗАГРУЗКА ПОСЛЕДНИХ ЗАПИСЕЙ ========================
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

    // ======================== ПЕРЕКЛЮЧЕНИЕ ПАНЕЛЕЙ ========================
    const newEntryPanel = document.querySelector('.new-entry:not(.search)');
    const newEntryBtn = document.querySelector('#entryBtn');
    const choicePanel = document.querySelector('.choice');
    const newEntryBtnBack = document.querySelector('#newEntryBtnBack');
    const searchPanel = document.querySelector('.search');
    const searchBtn = document.querySelector('#searchBtn');
    const resultsContainer = document.querySelector('#results');

    newEntryBtn.addEventListener('click', () => {
        newEntryPanel.classList.remove('none');
        choicePanel.classList.add('none');
        newEntryBtnBack.classList.remove('none');
        searchPanel.classList.add('none');
        loadLastRecords();
    });

    searchBtn.addEventListener('click', () => {
        searchPanel.classList.remove('none');
        choicePanel.classList.add('none');
        newEntryBtnBack.classList.remove('none');
        newEntryPanel.classList.add('none');
        performSearch();
    });

    newEntryBtnBack.addEventListener('click', () => {
        newEntryPanel.classList.add('none');
        searchPanel.classList.add('none');
        choicePanel.classList.remove('none');
        newEntryBtnBack.classList.add('none');
        resultsContainer.innerHTML = '';
    });

    // ======================== РЕДАКТИРОВАНИЕ ========================
    $(document).on('click', '.edit-btn', function() {
    const row = $(this).closest('tr');
    
    // Плавная анимация активации
    row.addClass('editing');
    
    // Небольшая задержка для плавности transition
    setTimeout(() => {
        row.find('.edit-field').prop('disabled', false);
        row.find('.table-check').prop('disabled', false);
    }, 50);
    
    $(this).hide();
    row.find('.save-btn').show();
});

    function updateRowColors(row, inspection) {
    if (inspection == 1) {
        row.css({'background-color': 'rgba(255, 204, 0, 0.15)', 'border-left': '4px solid #ffcc00'});
    } else {
        row.css({'background-color': '', 'border-left': ''});
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
        
        // Обновляем таблицу только если она видима
        updateTableIfVisible();
        
    } catch (error) {
        console.error("Ошибка при запросе: ", error);
        showToast("Ошибка при обновлении данных.", 'error', 'record_update_error_' + id);
    }
});

    // ======================== СКРЫТИЕ МАСОК ========================
    function hideEmptyDateMasks() {
        $('input[type="date"]:disabled, input[type="time"]:disabled').each(function() {
            const $input = $(this);
            const value = $input.val();
            $input.attr('placeholder', '');
            if (!value || value === '') {
                $input.css('color', 'transparent');
            } else {
                $input.css('color', '');
            }
        });
    }

    // ======================== УТИЛИТЫ ========================
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ======================== ЗАПУСК ========================
    setInterval(loadPendingRequests, 3000);
    loadPendingRequests();
});