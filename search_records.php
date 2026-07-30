<?php
define('ADMIN_AUTH', true);
require_once __DIR__ . '/admin_auth.php';
require_once 'db_connect.php';
require_once 'helpers.php';
require_once 'allowed_ips.php';

$search = trim($_GET['search'] ?? '');
$inspection = isset($_GET['inspection']) && $_GET['inspection'] === 'true' ? 1 : 0;
$yearRecord = isset($_GET['yearRecord']) && $_GET['yearRecord'] === 'true' ? 1 : 0;
$dateFilter = trim($_GET['dateFilter'] ?? '');

$query = "SELECT * FROM CarCheckpoint WHERE 1=1";
$params = [];
$types = '';

if (!empty($search)) {
    $searchTerm = "%$search%";
    $query .= " AND (LOWER(car_make) LIKE LOWER(?) OR LOWER(state_number) LIKE LOWER(?) OR LOWER(driver_last_name) LIKE LOWER(?) OR LOWER(full_name_applicant) LIKE LOWER(?) OR LOWER(comment) LIKE LOWER(?) OR entry_time LIKE ? OR out_time LIKE ? OR entry_date LIKE ? OR out_date LIKE ?)";
    $params = array_fill(0, 9, $searchTerm);
    $types .= str_repeat('s', 9);
}

if (!empty($dateFilter)) {
    $query .= " AND (entry_date = ? OR out_date = ?)";
    $params[] = $dateFilter;
    $params[] = $dateFilter;
    $types .= 'ss';
}

if ($inspection) $query .= " AND inspection = 1";
if ($yearRecord) $query .= " AND year_record = 1";

$query .= " ORDER BY id DESC";
$stmt = $conn->prepare($query);
if (!empty($params)) $stmt->bind_param($types, ...$params);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    echo "<table class='my-table table2'>
            <thead>
            <tr class='table-header'>
                <th class='table-header-cell sortable' data-sort='car_make'>Марка <span class='sort-arrow'></span></th>
                <th class='table-header-cell sortable' data-sort='state_number'>Гос/номер <span class='sort-arrow'></span></th>
                <th class='table-header-cell sortable' data-sort='driver_last_name'>Фамилия водителя <span class='sort-arrow'></span></th>
                <th class='table-header-cell sortable' data-sort='full_name_applicant'>ФИО инициатора<span class='sort-arrow'></span></th>
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

        $stateNumber = $row['state_number'] ?? '';
        $stateMain = $stateNumber;
        $stateRegion = '';
        if (strpos($stateNumber, ' ') !== false) {
            $parts = explode(' ', $stateNumber, 2);
            $stateMain = trim($parts[0]);
            $stateRegion = trim($parts[1]);
        }

        echo "<tr class='table-row' $rowColor data-id='" . htmlspecialchars($row['id']) . "'>";
        echo "<td class='table-cell'><input type='text' class='edit-field' data-field='car_make' value='" . htmlspecialchars($row['car_make']) . "' disabled></td>";
        
        echo "<td class='table-cell'>";
        echo "<div class='plate-row'>";
        echo "<input type='text' class='edit-field plate-row-main' data-field='state_number_main' value='" . htmlspecialchars($stateMain) . "' data-type='plate-normalize' maxlength='10' disabled>";
        echo "<input type='text' class='edit-field plate-row-region' data-field='state_number_region' value='" . htmlspecialchars($stateRegion) . "' data-type='plate-normalize' maxlength='6' disabled placeholder='Регион'>";
        echo "</div>";
        echo "</td>";

        echo "<td class='table-cell'><input type='text' class='edit-field' data-field='driver_last_name' value='" . htmlspecialchars($row['driver_last_name']) . "' disabled></td>";
        echo "<td class='table-cell'><input type='text' class='edit-field' data-field='full_name_applicant' value='" . htmlspecialchars($row['full_name_applicant']) . "' disabled></td>";
        echo "<td class='table-cell'><input type='time' class='edit-field' data-field='entry_time' value='" . $entryTime . "' disabled></td>";
        echo "<td class='table-cell'><input type='time' class='edit-field' data-field='out_time' value='" . $outTime . "' disabled></td>";
        echo "<td class='table-cell'><textarea class='edit-field' data-field='comment' disabled rows='4' style='resize:none;'>" . htmlspecialchars($row['comment']) . "</textarea></td>";
        echo "<td class='table-cell'><input type='checkbox' class='edit-field table-check' data-field='inspection' value='1' " . ($row['inspection'] == 1 ? 'checked' : '') . " disabled></td>";
        echo "<td class='table-cell'><input type='checkbox' class='edit-field table-check' data-field='year_record' value='1' " . ($row['year_record'] == 1 ? 'checked' : '') . " disabled></td>";
        echo "<td class='table-cell'><input type='text' class='edit-field' data-type='date-mask' data-field='entry_date' value='" . $entryDate . "' placeholder='ДД.ММ.ГГГГ' maxlength='10' disabled></td>";
        echo "<td class='table-cell'><input type='text' class='edit-field' data-type='date-mask' data-field='out_date' value='" . $outDate . "' placeholder='ДД.ММ.ГГГГ' maxlength='10' disabled></td>";
        
        $deleteBtn = canDelete() ? "<button class='delete-btn table-btn' data-id='" . htmlspecialchars($row['id']) . "'>Удалить</button>" : "";
        
        echo "<td class='table-cell actions-cell'>";
        echo "<div style='display: flex; flex-direction: column; gap: 10px;'>";
        echo "<button class='edit-btn table-btn'>Редактировать</button>";
        echo "<button class='save-btn table-btn' style='display:none;'>Сохранить</button>";
        echo $deleteBtn;
        echo "</div>";
        echo "<button class='undo-btn' style='display:none;' title='Отменить последнее сохранение'>";
        echo "<svg width='18' height='18' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>";
        echo "<path d='M3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C9.5 21 7.2 19.9 5.6 18.1' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/>";
        echo "<path d='M3 7V12H8' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/>";
        echo "</svg>";
        echo "</button>";
        echo "</td>";
        echo "</tr>";
    }
    echo "</tbody></table>";
} else {
    echo "<div class='empty-message'>Совпадений не найдено</div>";
}
$stmt->close();
$conn->close();
?>