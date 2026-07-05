<?php
// server/db.php
// DB connection helper using Replit's auto-injected DATABASE_URL (Neon Postgres)

$databaseUrl = getenv('DATABASE_URL');

if (!$databaseUrl) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'DATABASE_URL environment variable not found']);
    exit;
}

try {
    $parts = parse_url($databaseUrl);

    $host = $parts['host'];
    $port = isset($parts['port']) ? $parts['port'] : 5432;
    $dbname = ltrim($parts['path'], '/');
    $user = $parts['user'];
    $pass = $parts['pass'];

    $dsn = "pgsql:host=$host;port=$port;dbname=$dbname;sslmode=require";

    $dbh = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'DB connection failed: ' . $e->getMessage()]);
    exit;
}

return $dbh;
?>