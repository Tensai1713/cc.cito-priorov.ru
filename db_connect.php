<?php

if (!defined('ADMIN_AUTH') && !defined('USER_ACCESS')) {
    http_response_code(403);
    exit('Доступ запрещён');
}


define('ADMIN_AUTH', true);
require_once __DIR__ . '/admin_auth.php';


$servername = "localhost";
$username = "useralex";
$password = "Alex@1713alex"; 
$dbname = "CarCheck";

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
?>