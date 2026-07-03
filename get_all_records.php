<?php
require_once 'db_connect.php';
require_once 'helpers.php';

$query = "SELECT * FROM CarCheckpoint";
$result = $conn->query($query);

if ($result->num_rows > 0) {
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

        $entryTime = formatTimeForInput($row['entry_time']);
        $outTime = formatTimeForInput($row['out_time']);
        $entryDate = formatDateForInput($row['entry_date']);
        $outDate = formatDateForInput($row['out_date']);

        echo "<tr class='table-row' $rowColor data-id='" . htmlspecialchars($row['id']) . "'>";
        echo "<td class='table-cell'><input type='text' class='edit-field' data-field='car_make' value='" . htmlspecialchars($row['car_make']) . "' disabled></td>";
        echo "<td class='table-cell'><input type='text' class='edit-field' data-field='state_number' value='" . htmlspecialchars($row['state_number']) . "' disabled></td>";
        echo "<td class='table-cell'><input type='text' class='edit-field' data-field='driver_last_name' value='" . htmlspecialchars($row['driver_last_name']) . "' disabled></td>";
        echo "<td class='table-cell'><input type='text' class='edit-field' data-field='full_name_applicant' value='" . htmlspecialchars($row['full_name_applicant']) . "' disabled></td>";
        echo "<td class='table-cell'><input type='time' class='edit-field' data-field='entry_time' value='" . $entryTime . "' disabled></td>";
        echo "<td class='table-cell'><input type='time' class='edit-field' data-field='out_time' value='" . $outTime . "' disabled></td>";
        echo "<td class='table-cell'><textarea class='edit-field' data-field='comment' disabled rows='4' style='resize:none;'>" . htmlspecialchars($row['comment']) . "</textarea></td>";
        echo "<td class='table-cell'><input type='checkbox' class='edit-field table-check' data-field='inspection' value='1' " . ($row['inspection'] == 1 ? 'checked' : '') . " disabled></td>";
        echo "<td class='table-cell'><input type='checkbox' class='edit-field table-check' data-field='year_record' value='1' " . ($row['year_record'] == 1 ? 'checked' : '') . " disabled></td>";
        echo "<td class='table-cell'><input type='date' class='edit-field' data-field='entry_date' value='" . $entryDate . "' disabled></td>";
        echo "<td class='table-cell'><input type='date' class='edit-field' data-field='out_date' value='" . $outDate . "' disabled></td>";
        echo "<td class='table-cell'>
                <div style='display: flex; flex-direction: column; gap: 10px;'>
                    <button class='edit-btn table-btn'>Редактировать</button>
                    <button class='save-btn table-btn' style='display:none;'>Сохранить</button>
                    <button class='delete-btn table-btn' data-id='" . htmlspecialchars($row['id']) . "'>Удалить</button>
                </div>
              </td>";
        echo "</tr>";
    }
    echo "</table>";
} else {
    echo "Записи не найдены.";
}

$conn->close();
?>