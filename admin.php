<?php
define('ADMIN_AUTH', true);
require_once __DIR__ . '/admin_auth.php';
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="<?= htmlspecialchars($_SESSION['admin_csrf_token'] ?? '') ?>">
    <link rel="shortcut icon" href="img/favicon.ico" type="image/x-icon">
    <link rel="icon" href="img/favicon.ico" type="image/x-icon">
    <title>Админ</title>
    <link rel="stylesheet" href="./style.css">
    <link rel="stylesheet" href="./admin.css">
    <script defer src="./jquery.min.js"></script>
    <script defer src="./admin.js"></script>
</head>
<body>
<div class="toast-container" id="toastContainer"></div>

<!-- УВЕДОМЛЕНИЯ О ЗАЯВКАХ -->
<div class="admin-messages" id="adminMessages">
    <div class="message-wrapper" id="messageWrapper" style="display: none;">
        <div class="message-badge" id="messageBadge">0</div>
        <div class="message-card pulse" id="messageCard">
            <div class="message-content">
                <div class="message-title">Новые заявки</div>
                <div class="message-text" id="messageText">Ожидание рассмотрения</div>
            </div>
            <div class="message-arrow">›</div>
        </div>
    </div>
</div>

<!-- МОДАЛКА СПИСКА ЗАЯВОК -->
<div class="requests-list-modal" id="requestsListModal" style="display: none;">
    <div class="requests-list-content">
        <h2 class="requests-list-title">Список заявок</h2>
        <div class="requests-list" id="requestsList"></div>
        <button class="btn btn-close-list" id="closeListBtn">Закрыть</button>
    </div>
</div>

<!-- МОДАЛКА ДЕТАЛЕЙ ЗАЯВКИ -->
<div class="request-detail-modal" id="requestDetailModal" style="display: none;">
    <div class="request-detail-content">
        <button class="btn-close-modal" id="closeDetailBtn">✕</button>
        <h2 class="request-detail-title">Заявка от - <span id="requestId"></span></h2>
        <div class="request-detail-body" id="requestDetailBody"></div>
        <div class="request-detail-actions">
            <button class="btn btn-approve" id="approveBtn">✓ Одобрить</button>
            <button class="btn btn-reject" id="rejectBtn">✕ Отклонить</button>
        </div>
    </div>
</div>

<!-- МОДАЛКА ПОДТВЕРЖДЕНИЯ УДАЛЕНИЯ -->
<div class="confirm-modal" id="confirmModal">
    <div class="confirm-modal-content">
        <h2 class="confirm-modal-title">Подтверждение удаления</h2>
        <p class="confirm-modal-text">Вы уверены, что хотите удалить эту запись?</p>
        <div class="confirm-modal-actions">
            <button class="btn btn-cancel" id="confirmCancel">Отмена</button>
            <button class="btn btn-confirm" id="confirmOk">Удалить</button>
        </div>
    </div>
</div>

<!-- ЛОГО -->
<img class="logo" src="./img/logo.png" alt="">

<!-- ГЛАВНОЕ МЕНЮ -->
<div class="choice">
    <button id="entryBtn" class="record_btn btn">
        <svg class="record-svg" width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 20V17H15V15H18V12H20V15H23V17H20V20H18ZM3 21C2.45 21 1.97933 20.8043 1.588 20.413C1.19667 20.0217 1.00067 19.5507 1 19V5C1 4.45 1.196 3.97933 1.588 3.588C1.98 3.19667 2.45067 3.00067 3 3H17C17.55 3 18.021 3.196 18.413 3.588C18.805 3.98 19.0007 4.45067 19 5V10H17V8H3V19H16V21H3Z" fill="#F4F4F4"/>
        </svg>
        Добавить запись
    </button>
    <button id="searchBtn" class="search__btn btn">
        <svg class="edit-svg" width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3H5C4.46957 3 3.96086 3.21071 3.58579 3.58579C3.21071 3.96086 3 4.46957 3 5V19C3 19.5304 3.21071 20.0391 3.58579 20.4142C3.96086 20.7893 4.46957 21 5 21H19C19.5304 21 20.0391 20.7893 20.4142 20.4142C20.7893 20.0391 21 19.5304 21 19V12" stroke="#F4F4F4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M18.375 2.625C18.7728 2.22717 19.3124 2.00368 19.875 2.00368C20.4376 2.00368 20.9772 2.22717 21.375 2.625C21.7728 3.02282 21.9963 3.56239 21.9963 4.125C21.9963 4.68761 21.7728 5.22717 21.375 5.625L12.362 14.639C12.1246 14.8762 11.8312 15.0499 11.509 15.144L8.636 15.984C8.54995 16.0091 8.45874 16.0106 8.37191 15.9884C8.28508 15.9661 8.20583 15.9209 8.14245 15.8576C8.07907 15.7942 8.03389 15.7149 8.01165 15.6281C7.9894 15.5413 7.9909 15.45 8.016 15.364L8.856 12.491C8.95053 12.169 9.12454 11.8761 9.362 11.639L18.375 2.625Z" stroke="#F4F4F4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Поиск записей
    </button>
</div>

<!-- КНОПКА НАЗАД -->
<button id="newEntryBtnBack" class="btn new-entry__btn-back" style="display: none;">Назад</button>

<!-- ФОРМА ДОБАВЛЕНИЯ ЗАПИСИ -->
<div class="new-entry" style="display: none;">
    <form class="new-entry__panel" id="carForm">
        <div class="new-entry__inputs">
            <div class="new-entry__column grid-item1">
                <label>Марка</label>
                <input class="new-entry__input" type="text" name="carMake">
            </div>
            <div class="new-entry__column grid-item2">
                <label>Гос/номер</label>
                <input class="new-entry__input" type="text" name="stateNumber">
            </div>
            <div class="new-entry__column grid-item3">
                <label>Фамилия водителя</label>
                <input class="new-entry__input" type="text" name="driverLastName">
            </div>
            <div class="new-entry__column grid-item4">
                <label>ФИО инициатора <span class="required">*</span></label>
                <input class="new-entry__input required-field" type="text" name="fullNameApplicant" id="fullNameApplicant">
                <div class="field-error" id="fullNameError">Это поле обязательно для заполнения</div>
            </div>
            <div class="new-entry__column grid-item5">
                <label>Время въезда</label>
                <input class="new-entry__input" type="time" name="entryTime">
            </div>
            <div class="new-entry__column grid-item6">
                <label>Время выезда</label>
                <input class="new-entry__input" type="time" name="outTime">
            </div>
            <div class="new-entry__column new-entry__column-comment grid-item7">
                <label class="comment-label">Комментарий</label>
                <textarea class="new-entry__input new-entry__input-comment" style="resize: none;" name="comment"></textarea>
            </div>
            <div class="new-entry__column grid-item8">
                <label>Без досмотра</label>
                <input class="new-entry__input-checkbox" type="checkbox" name="inspection">
            </div>
            <div class="new-entry__column grid-item12">
                <label>Годовая запись</label>
                <input class="new-entry__input-checkbox" type="checkbox" name="yearRecord">
            </div>
            <div class="new-entry__column grid-item9">
                <label>Дата въезда /<br>начала работ</label>
                <input class="new-entry__input" type="text" data-type="date-mask" name="entryDate" id="entryDate" placeholder="ДД.ММ.ГГГГ" maxlength="10">
            </div>
            <div class="new-entry__column grid-item10">
                <label>Дата выезда /<br>окончания работ</label>
                <input class="new-entry__input" type="text" data-type="date-mask" name="outDate" id="outDate" placeholder="ДД.ММ.ГГГГ" maxlength="10">
            </div>
            <button class="btn grid-item11" type="submit">Добавить</button>
            <button class="btn grid-item13" type="button" id="clearFormBtn">Очистить</button>
        </div>
    </form>
</div>

<!-- ПАНЕЛЬ ПОИСКА -->
<div class="new-entry search" style="display: none;">
    <div class="search-panel">
        <div class="search-container">
            <div class="search-input-wrapper">
                <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <input type="text" id="searchInput" class="search-input" placeholder="Поиск по всем полям...">
            </div>
            <div class="search-filters">
                <div class="search-checkboxes">
                    <label class="checkbox-label">
                        <input type="checkbox" id="inspectionFilter" class="search-checkbox">
                        <span>Без досмотра</span>
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" id="yearRecordFilter" class="search-checkbox">
                        <span>Годовая запись</span>
                    </label>
                </div>
                <div class="search-date-wrapper">
                    <svg class="date-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 7V3M16 7V3M7 11H17M5 21H19C20.1046 21 21 20.1046 21 19V8C21 6.89543 20.1046 6 19 6H5C3.89543 6 3 6.89543 3 8V19C3 20.1046 3.89543 21 5 21Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <input type="text" data-type="date-mask" id="dateFilter" class="search-date" placeholder="ДД.ММ.ГГГГ" maxlength="10">
                </div>
                <button type="button" id="clearSearchBtn" class="btn btn-clear-search">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Очистить
                </button>
            </div>
        </div>
    </div>
</div>

<!-- КОНТЕЙНЕР ДЛЯ ТАБЛИЦ -->
<div id="results"></div>

<!-- МОДАЛКА ПОДТВЕРЖДЕНИЯ ОТПРАВКИ -->
<div class="confirm-submit-modal" id="confirmSubmitModal">
    <div class="confirm-submit-overlay" id="confirmSubmitOverlay"></div>
    <div class="confirm-submit-content">
        <h2 class="confirm-submit-title">Подтверждение</h2>
        <p class="confirm-submit-text" id="confirmSubmitText">Вы уверены, что хотите отправить данные?</p>
        <div class="confirm-submit-actions">
            <button class="btn btn-cancel" id="confirmSubmitCancel">Отмена</button>
            <button class="btn btn-confirm" id="confirmSubmitOk">Отправить</button>
        </div>
    </div>
</div>

</body>
</html>