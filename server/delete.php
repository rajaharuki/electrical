<?php
header('Content-Type: application/json; charset=utf-8');

try {
    $dbh = require __DIR__ . '/db.php';
    $id = isset($_POST['id']) ? (int) $_POST['id'] : 0;

    if ($id <= 0) {
        throw new Exception('Invalid id');
    }

    $del = $dbh->prepare('DELETE FROM memories WHERE id = :id');
    $del->execute([':id' => $id]);

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>