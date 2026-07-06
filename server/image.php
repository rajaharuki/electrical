<?php
// server/image.php
// Streams a photo's bytes straight from Postgres. This is what <img src> points to now.

$dbh = require __DIR__ . '/db.php';

$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($id <= 0) {
    http_response_code(400);
    exit('Invalid id');
}

$stmt = $dbh->prepare('SELECT data, mime FROM memories WHERE id = :id');
$stmt->execute([':id' => $id]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$row || $row['data'] === null) {
    http_response_code(404);
    exit('Not found');
}

header('Content-Type: ' . ($row['mime'] ?: 'application/octet-stream'));
header('Cache-Control: public, max-age=31536000, immutable');
echo $row['data'];
?>