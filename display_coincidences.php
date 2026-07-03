<?php
require_once 'db_connect.php';
require_once 'helpers.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $car_make = strtolower($_POST['carMakeSearch'] ?? '');
    $state_number = strtolower($_POST['stateNumberSearch'] ?? '');
    $driver_last_name = strtolower($_POST['driverLastNameSearch'] ?? '');
    $full_name_applicant = strtolower($_POST['fullNameApplicantSearch'] ?? '');
    $entry_time = $_POST['entryTimeSearch'] ?? '';
    $out_time = $_POST['outTimeSearch'] ?? '';
    $inspection_checked = isset($_POST['inspectionCheckbox']);
    $year_record_checked = isset($_POST['yearRecordCheckbox']);
    $entry_date = $_POST['entryDateSearch'] ?? '';
    $out_date = $_POST['outDateSearch'] ?? '';
    $comment_search = strtolower($_POST['commentSearch'] ?? '');

    $query = "SELECT * FROM CarCheckpoint WHERE 
        (LOWER(car_make) LIKE LOWER(?) OR ? = '') AND 
        (LOWER(state_number) LIKE LOWER(?) OR ? = '') AND 
        (LOWER(driver_last_name) LIKE LOWER(?) OR ? = '') AND 
        (LOWER(full_name_applicant) LIKE LOWER(?) OR ? = '')";

    if ($inspection_checked) {
        $query .= " AND (inspection = '1')";
    }

    if ($year_record_checked) {
        $query .= " AND (year_record = '1')";
    }

    if (!empty($entry_date)) {
        $query .= " AND (entry_date = ?)";
    }
    if (!empty($entry_time)) {
        $query .= " AND (entry_time = ?)";
    }
    if (!empty($out_date)) {
        $query .= " AND (out_date = ?)";
    }
    if (!empty($out_time)) {
        $query .= " AND (out_time = ?)";
    }
    if (!empty($comment_search)) {
        $query .= " AND (LOWER(comment) LIKE LOWER(?))";
    }

    $stmt = $conn->prepare($query);
    
    $searchCarMake = "%$car_make%";
    $searchStateNumber = "%$state_number%";
    $searchDriverLastName = "%$driver_last_name%";
    $searchFullNameApplicant = "%$full_name_applicant%";
    $searchComment = "%$comment_search%";

    $params = [
        $searchCarMake, $car_make,
        $searchStateNumber, $state_number,
        $searchDriverLastName, $driver_last_name,
        $searchFullNameApplicant, $full_name_applicant,
    ];

    if (!empty($entry_date)) {
        $params[] = $entry_date;
    }
    if (!empty($entry_time)) {
        $params[] = $entry_time;
    }
    if (!empty($out_date)) {
        $params[] = $out_date;
    }
    if (!empty($out_time)) {
        $params[] = $out_time;
    }
    if (!empty($comment_search)) {
        $params[] = $searchComment;
    }

    $bindTypes = str_repeat('s', count($params));
    $stmt->bind_param($bindTypes, ...$params);

    $stmt->execute();
    $result = $stmt->get_result();

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
        echo "Совпадений не найдено.";
    }

    $stmt->close();
}
$conn->close();
?>