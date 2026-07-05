<?php
header('Content-Type: application/json; charset=utf-8');

try {
    $dbh = require __DIR__ . '/db.php';

    $stmt = $dbh->query('SELECT id, url, path, caption, date, fallback, created_at FROM memories ORDER BY created_at DESC, id DESC');
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $items = array_map(function ($row) {
        if (!empty($row['url']) && strpos($row['url'], 'http') !== 0 && strpos($row['url'], '/') !== 0) {
            $row['url'] = '/' . ltrim($row['url'], '/');
        }
        return $row;
    }, $rows);

    echo json_encode(['success' => true, 'items' => $items]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
