# Setup Railway untuk Deploy PHP + MySQL

## Langkah 1: Buat Akun Railway
1. Buka https://railway.app
2. Klik "Start Project"
3. Login dengan GitHub / Email

## Langkah 2: Buat Project Baru
1. Di Dashboard Railway, klik "New Project"
2. Pilih "Deploy from GitHub" atau "Create Empty Project"
3. Nama project: `elektrons` (atau sesuka kamu)

## Langkah 3: Setup MySQL Database
1. Di project, klik "Add"
2. Pilih "MySQL"
3. Database akan tercipta otomatis dengan credentials:
   - Host: `containers-us-west-xxx.railway.app` (lihat di Variables)
   - Database: `railway`
   - User: `root`
   - Password: lihat di Variables

## Langkah 4: Buat File Config untuk Railway
Buat file `Procfile` di root folder:
```
web: php -S 0.0.0.0:$PORT -t .
```

Buat file `.env.production` (opsional):
```
DB_HOST=containers-us-west-xxx.railway.app
DB_NAME=railway
DB_USER=root
DB_PASS=your_password_here
```

## Langkah 5: Upload Folder `server/` ke Railway
Opsi A (Pakai GitHub):
1. Push folder `server/` ke GitHub repo
2. Di Railway, connect GitHub repo
3. Deploy otomatis

Opsi B (Pakai Railway CLI):
1. Install Railway CLI: `npm i -g @railway/cli`
2. Run: `railway login`
3. Run: `railway link` (pilih project)
4. Run: `railway up`

## Langkah 6: Jalankan SQL Schema
1. Di Railway Dashboard, buka MySQL service
2. Klik "Data" tab
3. Copy-paste SQL dari `server/schema.sql`:
```sql
CREATE DATABASE IF NOT EXISTS railway CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE railway;

CREATE TABLE IF NOT EXISTS memories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  url TEXT NOT NULL,
  path VARCHAR(255) NOT NULL,
  caption VARCHAR(255) DEFAULT NULL,
  date DATE DEFAULT NULL,
  fallback TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
4. Run query

## Langkah 7: Copy URL Public Railway
1. Di Railway, buka PHP service
2. Lihat "Public URL" (misalnya: `https://elektrons-prod-xxxx.railway.app`)
3. Copy URL ini

## Langkah 8: Update `server/db.php`
Ganti dengan credentials Railway:
```php
$DB_HOST = getenv('DB_HOST') ?: 'containers-us-west-xxx.railway.app';
$DB_NAME = getenv('DB_NAME') ?: 'railway';
$DB_USER = getenv('DB_USER') ?: 'root';
$DB_PASS = getenv('DB_PASS') ?: 'your_password_here';
```

## Langkah 9: Update Endpoints di `index.html`
Ganti `getPhpBaseUrl()` dengan URL Railway:
```javascript
function getPhpBaseUrl() {
  return 'https://elektrons-prod-xxxx.railway.app/server';
}
```

Selesai! Sekarang upload foto akan masuk ke MySQL di Railway.
