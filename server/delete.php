<?php
header('Content-Type: application/json; charset=utf-8');

try {
    $dbh = require __DIR__ . '/db.php';
    $id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
    $path = isset($_POST['path']) ? trim($_POST['path']) : '';

    if ($id <= 0) {
        throw new Exception('Invalid id');
    }

    $stmt = $dbh->prepare('SELECT path FROM memories WHERE id = :id');
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row) {
        $filePath = __DIR__ . '/uploads/' . $row['path'];
        if (is_file($filePath)) {
            @unlink($filePath);
        }
    }

    $del = $dbh->prepare('DELETE FROM memories WHERE id = :id');
    $del->execute([':id' => $id]);

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
