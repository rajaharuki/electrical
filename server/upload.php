<?php
// server/upload.php
// Simple upload endpoint: saves files under server/uploads/ and records metadata in MySQL `memories` table.

header('Content-Type: application/json; charset=utf-8');

// allow large uploads for testing (adjust in php.ini for production)
// ini_set('upload_max_filesize', '50M');

// ensure upload dir
$uploadDir = __DIR__ . '/uploads';
if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

// require DB helper
$dbh = require __DIR__ . '/db.php';

$results = [];

try {
    // caption and date may be present
    $caption = isset($_POST['caption']) ? trim($_POST['caption']) : '';
    $date = isset($_POST['date']) ? trim($_POST['date']) : date('Y-m-d');

    if (empty($_FILES)) {
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
        $target = $uploadDir . '/' . $filename;
        if (!move_uploaded_file($tmp, $target)) {
            $results[] = ['index' => $idx, 'success' => false, 'error' => 'Failed to move uploaded file'];
            continue;
        }

        // store metadata in DB
        $urlPath = 'server/uploads/' . $filename; // public path relative to project root
        $stmt = $dbh->prepare('INSERT INTO memories (url, path, caption, date, created_at) VALUES (:url, :path, :caption, :date, NOW())');
        $stmt->execute([
            ':url' => $urlPath,
            ':path' => $filename,
            ':caption' => $caption ?: $orig,
            ':date' => $date
        ]);
        $id = $dbh->lastInsertId();

        $results[] = ['index' => $idx, 'success' => true, 'id' => $id, 'url' => $urlPath];
    }

    echo json_encode(['success' => true, 'results' => $results]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

?>
