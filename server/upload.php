<?php
// server/upload.php
// Upload endpoint: stores file bytes directly in Postgres (persistent),
// instead of local disk (which gets wiped when Autoscale recycles the instance).
 
header('Content-Type: application/json; charset=utf-8');
 
$dbh = require __DIR__ . '/db.php';
 
$results = [];
 
try {
    $caption = isset($_POST['caption']) ? trim($_POST['caption']) : '';
    $date = isset($_POST['date']) ? trim($_POST['date']) : date('Y-m-d');
 
    if (empty($_FILES) || !isset($_FILES['files'])) {
        throw new Exception('No files uploaded');
    }
 
    foreach ($_FILES['files']['error'] as $idx => $err) {
        if ($err !== UPLOAD_ERR_OK) {
            $results[] = ['index' => $idx, 'success' => false, 'error' => 'Upload error code ' . $err];
            continue;
        }
        $tmp = $_FILES['files']['tmp_name'][$idx];
        $orig = basename($_FILES['files']['name'][$idx]);
        $safe = preg_replace('/[^A-Za-z0-9._-]/', '_', $orig);
        $filename = time() . '_' . $idx . '_' . $safe;
 
        $mime = $_FILES['files']['type'][$idx] ?: 'application/octet-stream';
        $bytes = file_get_contents($tmp);
        if ($bytes === false) {
            $results[] = ['index' => $idx, 'success' => false, 'error' => 'Failed to read uploaded file'];
            continue;
        }
 
        $stream = fopen('php://memory', 'r+');
        fwrite($stream, $bytes);
        rewind($stream);
 
        $stmt = $dbh->prepare('INSERT INTO memories (url, path, caption, date, data, mime, created_at) VALUES (:url, :path, :caption, :date, :data, :mime, NOW()) RETURNING id');
        $stmt->bindValue(':url', '', PDO::PARAM_STR); // filled in after insert (see below)
        $stmt->bindValue(':path', $filename, PDO::PARAM_STR);
        $stmt->bindValue(':caption', $caption ?: $orig, PDO::PARAM_STR);
        $stmt->bindValue(':date', $date, PDO::PARAM_STR);
        $stmt->bindValue(':data', $stream, PDO::PARAM_LOB);
        $stmt->bindValue(':mime', $mime, PDO::PARAM_STR);
        $stmt->execute();
        $id = $stmt->fetchColumn();
        fclose($stream);
 
        // now set the url to point at the image-serving endpoint using the real id
        $upd = $dbh->prepare('UPDATE memories SET url = :url WHERE id = :id');
        $upd->execute([':url' => '/server/image.php?id=' . $id, ':id' => $id]);
 
        $results[] = ['index' => $idx, 'success' => true, 'id' => $id, 'url' => '/server/image.php?id=' . $id];
    }
 
    echo json_encode(['success' => true, 'results' => $results]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>