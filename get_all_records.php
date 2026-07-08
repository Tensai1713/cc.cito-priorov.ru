<?php
// 1. Включаем жесткую авторизацию админки перед любыми действиями
define('ADMIN_AUTH', true);
require_once __DIR__ . '/admin_auth.php';

// 2. Подключаем базу данных и вспомогательные функции
require_once 'db_connect.php';
require_once 'helpers.php';

// 3. Добавляем базовый лимит, чтобы сервер не падал при росте базы
// Выводим последние 200 записей (для пагинации код можно расширить)
$query = "SELECT * FROM CarCheckpoint ORDER BY id DESC LIMIT 200";
$result = $conn->query($query);

if ($result && $result->num_rows > 0) {
    echo "<table class='my-table table2'>
            <tr class='table-header'>
                <th class='table-header-cell'>Марка</th>
                <th class='table-header-cell'>Гос/номер</th>
                <th class='table-header-cell'>Фамилия водителя</th>
                <th class='table-header-cell'>ФИО заказчика</th>
                <th class='table-header-cell'>Время въезда</th>
                <th class='table-header-cell'>Время выезда</th>
                <th class='table-header-cell'>Комментарий</th>
                <th class='table-header-cell'>Без досмотра</th>
                <th class='table-header-cell'>Годовая запись</th>
                <th class='table-header-cell'>Дата въезда</th>
                <th class='table-header-cell'>Дата выезда</th>
                <th class='table-header-cell'>Действия</th>
            </tr>";

    while ($row = $result->fetch_assoc()) {
        $rowColor = ($row['inspection'] == 1) ? ' style="background-color:rgba(255, 204, 0, 0.15); border-left: 4px solid #ffcc00;"' : '';

        // Экранируем и форматируем выводимые значения во избежание XSS
        $entryTime = htmlspecialchars(formatTimeForInput($row['entry_time'] ?? ''), ENT_QUOTES, 'UTF-8');
        $outTime = htmlspecialchars(formatTimeForInput($row['out_time'] ?? ''), ENT_QUOTES, 'UTF-8');
        $entryDate = htmlspecialchars(formatDateForInput($row['entry_date'] ?? ''), ENT_QUOTES, 'UTF-8');
        $outDate = htmlspecialchars(formatDateForInput($row['out_date'] ?? ''), ENT_QUOTES, 'UTF-8');
        $rowId = htmlspecialchars($row['id'], ENT_QUOTES, 'UTF-8');

        echo "<tr class='table-row' $rowColor data-id='" . $rowId . "'>";
        echo "<td class='table-cell'><input type='text' class='edit-field' data-field='car_make' value='" . htmlspecialchars($row['car_make'] ?? '', ENT_QUOTES, 'UTF-8') . "' disabled></td>";
        echo "<td class='table-cell'><input type='text' class='edit-field' data-field='state_number' value='" . htmlspecialchars($row['state_number'] ?? '', ENT_QUOTES, 'UTF-8') . "' disabled></td>";
        echo "<td class='table-cell'><input type='text' class='edit-field' data-field='driver_last_name' value='" . htmlspecialchars($row['driver_last_name'] ?? '', ENT_QUOTES, 'UTF-8') . "' disabled></td>";
        echo "<td class='table-cell'><input type='text' class='edit-field' data-field='full_name_applicant' value='" . htmlspecialchars($row['full_name_applicant'] ?? '', ENT_QUOTES, 'UTF-8') . "' disabled></td>";
        echo "<td class='table-cell'><input type='time' class='edit-field' data-field='entry_time' value='" . $entryTime . "' disabled></td>";
        echo "<td class='table-cell'><input type='time' class='edit-field' data-field='out_time' value='" . $outTime . "' disabled></td>";
        echo "<td class='table-cell'><textarea class='edit-field' data-field='comment' disabled rows='4' style='resize:none;'>" . htmlspecialchars($row['comment'] ?? '', ENT_QUOTES, 'UTF-8') . "</textarea></td>";
        echo "<td class='table-cell'><input type='checkbox' class='edit-field table-check' data-field='inspection' value='1' " . ($row['inspection'] == 1 ? 'checked' : '') . " disabled></td>";
        echo "<td class='table-cell'><input type='checkbox' class='edit-field table-check' data-field='year_record' value='1' " . ($row['year_record'] == 1 ? 'checked' : '') . " disabled></td>";
        echo "<td class='table-cell'><input type='text' class='edit-field' data-type='date-mask' data-field='entry_date' value='" . htmlspecialchars($entryDateDisplay) . "' placeholder='ДД.ММ.ГГГГ' maxlength='10' disabled></td>";
        echo "<td class='table-cell'><input type='text' class='edit-field' data-type='date-mask' data-field='out_date' value='" . htmlspecialchars($outDateDisplay) . "' placeholder='ДД.ММ.ГГГГ' maxlength='10' disabled></td>";
        echo "<td class='table-cell'>
                <div style='display: flex; flex-direction: column; gap: 10px;'>
                    <button class='edit-btn table-btn'>Редактировать</button>
                    <button class='save-btn table-btn' style='display:none;'>Сохранить</button>
                    <button class='delete-btn table-btn' data-id='" . $rowId . "'>Удалить</button>
                </div>
              </td>";
        echo "</tr>";
    }
    echo "</table>";
} else {
    echo "Записи не найдены.";
}

if ($result) {
    $result->close();
}
$conn->close();
?>
