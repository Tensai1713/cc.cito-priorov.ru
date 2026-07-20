<?php
define('ADMIN_AUTH', true);
require_once __DIR__ . '/admin_auth.php';
require_once 'db_connect.php';
require_once 'helpers.php';
require_once 'allowed_ips.php';

$query = "SELECT * FROM CarCheckpoint ORDER BY id DESC LIMIT 10";
$result = $conn->query($query);

if ($result->num_rows > 0) {
    echo "<table class='my-table table1'>
            <thead>
            <tr class='table-header'>
                <th class='table-header-cell sortable' data-sort='car_make'>Марка <span class='sort-arrow'></span></th>
                <th class='table-header-cell sortable' data-sort='state_number'>Гос/номер <span class='sort-arrow'></span></th>
                <th class='table-header-cell sortable' data-sort='driver_last_name'>Фамилия водителя <span class='sort-arrow'></span></th>
                <th class='table-header-cell sortable' data-sort='full_name_applicant'>ФИО заказчика <span class='sort-arrow'></span></th>
                <th class='table-header-cell sortable' data-sort='entry_time'>Время въезда <span class='sort-arrow'></span></th>
                <th class='table-header-cell sortable' data-sort='out_time'>Время выезда <span class='sort-arrow'></span></th>
                <th class='table-header-cell sortable' data-sort='comment'>Комментарий <span class='sort-arrow'></span></th>
                <th class='table-header-cell sortable' data-sort='inspection'>Без досмотра <span class='sort-arrow'></span></th>
                <th class='table-header-cell sortable' data-sort='year_record'>Годовая запись <span class='sort-arrow'></span></th>
                <th class='table-header-cell sortable' data-sort='entry_date'>Дата въезда <span class='sort-arrow'></span></th>
                <th class='table-header-cell sortable' data-sort='out_date'>Дата выезда <span class='sort-arrow'></span></th>
                <th class='table-header-cell'>Действия</th>
            </tr>
            </thead>
            <tbody>";

    while ($row = $result->fetch_assoc()) {
        $rowColor = ($row['inspection'] == 1) ? ' style="background-color:rgba(255, 204, 0, 0.15); border-left: 4px solid #ffcc00;"' : '';

        $entryTime = formatTimeForInput($row['entry_time']);
        $outTime = formatTimeForInput($row['out_time']);
        $entryDate = formatDateForMask($row['entry_date']);
        $outDate = formatDateForMask($row['out_date']);

        echo "<tr class='table-row' $rowColor data-id='" . htmlspecialchars($row['id']) . "'>";
        echo "<td class='table-cell'><input type='text' class='edit-field' data-field='car_make' value='" . htmlspecialchars($row['car_make']) . "' disabled></td>";
        echo "<td class='table-cell'><input type='text' class='edit-field' data-field='state_number' data-type='plate-mask' maxlength='10' value='" . htmlspecialchars($row['state_number']) . "' disabled></td>";        echo "<td class='table-cell'><input type='text' class='edit-field' data-field='driver_last_name' value='" . htmlspecialchars($row['driver_last_name']) . "' disabled></td>";
        echo "<td class='table-cell'><input type='text' class='edit-field' data-field='full_name_applicant' value='" . htmlspecialchars($row['full_name_applicant']) . "' disabled></td>";
        echo "<td class='table-cell'><input type='time' class='edit-field' data-field='entry_time' value='" . $entryTime . "' disabled></td>";
        echo "<td class='table-cell'><input type='time' class='edit-field' data-field='out_time' value='" . $outTime . "' disabled></td>";
        echo "<td class='table-cell'><textarea class='edit-field' data-field='comment' disabled rows='4' style='resize:none;'>" . htmlspecialchars($row['comment']) . "</textarea></td>";
        echo "<td class='table-cell'><input type='checkbox' class='edit-field table-check' data-field='inspection' value='1' " . ($row['inspection'] == 1 ? 'checked' : '') . " disabled></td>";
        echo "<td class='table-cell'><input type='checkbox' class='edit-field table-check' data-field='year_record' value='1' " . ($row['year_record'] == 1 ? 'checked' : '') . " disabled></td>";
        echo "<td class='table-cell'><input type='text' class='edit-field' data-type='date-mask' data-field='entry_date' value='" . $entryDate . "' placeholder='ДД.ММ.ГГГГ' maxlength='10' disabled></td>";

        echo "<td class='table-cell'><input type='text' class='edit-field' data-type='date-mask' data-field='out_date' value='" . $outDate . "' placeholder='ДД.ММ.ГГГГ' maxlength='10' disabled></td>";     
        echo "<td class='table-cell'>
                <div style='display: flex; flex-direction: column; gap: 10px;'>
                    <button class='edit-btn table-btn'>Редактировать</button>
                    <button class='save-btn table-btn' style='display:none;'>Сохранить</button>
                    " . (canDelete() ? "<button class='delete-btn table-btn' data-id='" . htmlspecialchars($row['id']) . "'>Удалить</button>" : "") . "
                </div>
              </td>";
        echo "</tr>";
    }
    echo "</tbody></table>";
} else {
    echo "Записей не найдено.";
}

$conn->close();
?>