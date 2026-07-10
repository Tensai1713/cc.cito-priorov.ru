<?php
/**
 * Форматирование даты в формат d.m.Y
 * Принимает дату в любом формате и возвращает отформатированную строку
 */
function formatDate($date) {
    if (empty($date)) {
        return '';
    }
    
    $date = trim($date);
    
    // Проверяем на невалидные значения
    if ($date === '0000-00-00' || $date === '1970-01-01' || $date === '01.01.1970') {
        return '';
    }
    
    // Пытаемся распарсить дату
    $timestamp = strtotime($date);
    
    if ($timestamp === false) {
        // Если не удалось распарсить, возвращаем как есть
        return $date;
    }
    
    // Проверяем валидность timestamp
    if ($timestamp <= 0) {
        return '';
    }
    
    return date('d.m.Y', $timestamp);
}

/**
 * Форматирование времени в формат H:i
 */
function formatTime($time) {
    if (empty($time)) {
        return '';
    }
    
    $time = trim($time);
    
    // Проверяем на невалидные значения
    if ($time === '00:00:00' || $time === '00:00') {
        return '';
    }
    
    // Пытаемся распарсить время
    $timestamp = strtotime($time);
    
    if ($timestamp === false) {
        return $time;
    }
    
    return date('H:i', $timestamp);
}


// Конвертация YYYY-MM-DD → DD.MM.YYYY для маски даты
function formatDateForMask($date) {
    if (empty($date)) return '';
    // Если уже в формате DD.MM.YYYY
    if (preg_match('/^\d{2}\.\d{2}\.\d{4}$/', $date)) {
        return $date;
    }
    // Если в формате YYYY-MM-DD
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        $parts = explode('-', $date);
        return $parts[2] . '.' . $parts[1] . '.' . $parts[0];
    }
    return '';
}

// Конвертация DD.MM.YYYY → YYYY-MM-DD для БД
function convertDateForDB($date) {
    if (empty($date)) return null;
    // Если уже в формате YYYY-MM-DD
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        return $date;
    }
    // Если в формате DD.MM.YYYY
    if (preg_match('/^(\d{2})\.(\d{2})\.(\d{4})$/', $date, $matches)) {
        return $matches[3] . '-' . $matches[2] . '-' . $matches[1];
    }
    return null;
}

/**
 * Форматирование даты для input type="date" (формат Y-m-d)
 */
function formatDateForInput($date) {
    if (empty($date)) {
        return '';
    }
    
    $date = trim($date);
    
    if ($date === '0000-00-00' || $date === '1970-01-01') {
        return '';
    }
    
    // Если уже в формате Y-m-d
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        return $date;
    }
    
    // Пытаемся распарсить
    $timestamp = strtotime($date);
    
    if ($timestamp === false || $timestamp <= 0) {
        return '';
    }
    
    return date('Y-m-d', $timestamp);
}

/**
 * Форматирование времени для input type="time" (формат H:i)
 */
function formatTimeForInput($time) {
    if (empty($time)) {
        return '';
    }
    
    $time = trim($time);
    
    if ($time === '00:00:00' || $time === '00:00') {
        return '';
    }
    
    // Если уже в формате H:i
    if (preg_match('/^\d{2}:\d{2}$/', $time)) {
        return $time;
    }
    
    // Если в формате H:i:s
    if (preg_match('/^\d{2}:\d{2}:\d{2}$/', $time)) {
        return substr($time, 0, 5);
    }
    
    $timestamp = strtotime($time);
    
    if ($timestamp === false) {
        return '';
    }
    
    return date('H:i', $timestamp);
}
?>