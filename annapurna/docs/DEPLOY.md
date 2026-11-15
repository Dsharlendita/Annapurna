# Panduan Online (Hosting) Annapurna Adventure

Daftar periksa sebelum website dipakai customer sungguhan. Kerjakan berurutan.

## 1. Pengaturan `.env` di server

```
APP_ENV=production
APP_DEBUG=false
APP_URL=https://domain-toko.com

# Akun awal (seeder TIDAK memakai kata sandi demo owner123/dita123 di server online)
SEED_OWNER_PASSWORD=isi-kata-sandi-kuat
SEED_ADMIN_PASSWORD=isi-kata-sandi-kuat

QUEUE_CONNECTION=sync
SESSION_SECURE_COOKIE=true
```

- `APP_DEBUG=false` wajib. Kalau `true`, pesan error menampilkan isi `.env` (kata sandi database, kunci Google).
- Jalankan `php artisan key:generate` sekali di server baru.
- Lalu:
  ```
  composer install --no-dev --optimize-autoloader
  php artisan migrate --force
  php artisan db:seed --force          # hanya sekali, saat database masih kosong
  php artisan storage:link
  php artisan optimize
  ```
- Kalau `SEED_OWNER_PASSWORD` tidak diisi, seeder membuat kata sandi acak dan **menampilkannya sekali di terminal**. Catat saat itu juga. Owner dan Admin wajib mengganti kata sandi saat pertama masuk.
- Akun `customer@annapurna.id` dan contoh transaksi **tidak dibuat** di server online.

## 2. HTTPS

Website online wajib memakai `https://`, karena login Google tidak berjalan di `http://` selain alamat lokal. Biasanya cukup mengaktifkan SSL gratis (Let's Encrypt) di panel hosting.

## 3. Login Google

Buka Google Cloud Console → proyek **Annapurna Web** → **Clients** → **Annapurna Web**:

1. Tambahkan **Authorized redirect URI**: `https://domain-toko.com/auth/google/callback`
2. **Ganti Client Secret**, karena secret lama sempat dibagikan saat pengembangan: **Add secret** → salin → isi `GOOGLE_CLIENT_SECRET` di `.env` server → hapus secret lama.
3. Di menu **Audience**, klik **Publish app** supaya semua customer bisa masuk, tidak hanya Test users.
4. Ganti **User support email** di menu **Branding** ke email toko.

## 3b. Google Drive (rekap bulanan)

Memakai Client ID/Secret yang sama dengan login Google. Alamat callback juga sama, jadi tidak perlu menambah redirect URI.

1. Google Cloud Console → **APIs & Services → Library** → cari **Google Drive API** → **Enable**.
2. Menu **Data Access** → **Add or remove scopes** → centang `.../auth/drive.file` → **Update** → **Save**. Izin ini hanya memberi akses ke folder & file yang dibuat website, bukan isi Drive lainnya, jadi tidak perlu verifikasi Google.
3. Pastikan aplikasi sudah **Publish app** (langkah 3 di atas). Selama masih mode *Testing*, izin Drive **kedaluwarsa setiap 7 hari** dan Owner harus menekan Hubungkan lagi.
4. Masuk sebagai Owner → **Google Drive & Email** → **Hubungkan** → pilih akun Google toko → centang izin Google Drive → **Lanjutkan**.

Rekap dibuat otomatis saat panel admin/owner pertama kali dibuka setelah jadwal (default tanggal 1 pukul 06.00 WIB). Bila sampai pukul 10.00 belum dibuat, Owner mendapat notifikasi (`rekap:ingatkan`, butuh cron di langkah 5). Email ringkasan baru benar-benar terkirim bila langkah 4 (email) diisi; tanpa itu, link folder tetap ada di halaman Integrasi.

## 4. Email (opsional: kode verifikasi & email staff)

```
MAIL_MAILER=smtp
MAIL_SCHEME=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=annapurnaadv@gmail.com
MAIL_PASSWORD="App Password 16 huruf"
MAIL_FROM_ADDRESS="annapurnaadv@gmail.com"
MAIL_FROM_NAME="Annapurna Adventure"
```

App Password dibuat di myaccount.google.com/apppasswords (Verifikasi 2 Langkah harus aktif). Selama `MAIL_MAILER=log`, tombol "Masuk dengan kode" disembunyikan otomatis.

## 5. Jadwal otomatis (cron)

Pembatalan booking yang tidak dibayar (setiap 15 menit), pengingat laundry (setiap pukul 09.00), dan pengingat rekap Google Drive (pukul 10.00 WIB) baru berjalan kalau scheduler Laravel dijalankan. Di panel hosting (menu **Cron Jobs**), tambahkan:

```
* * * * * cd /path/ke/annapurna && php artisan schedule:run >> /dev/null 2>&1
```

Di laptop (Laragon), cukup jalankan `php artisan schedule:work` di terminal terpisah saat ingin mencobanya.

## 6. Backup database

Minimal sekali sehari. Pilih salah satu:

- **Fitur backup otomatis panel hosting** (cPanel → Backup / JetBackup). Paling mudah.
- **Cron mysqldump**:
  ```
  0 2 * * * mysqldump -u USER -pSANDI annapurna | gzip > /path/backup/annapurna-$(date +\%F).sql.gz
  ```
  Simpan salinannya juga di luar server (misalnya Google Drive Owner) setiap minggu.

Uji pemulihan (restore) sekali sebelum website ramai, supaya yakin backup-nya benar-benar bisa dipakai.

## 7. Setelah online

- Masuk sebagai Owner dan **ganti kata sandi**.
- Isi profil toko, rekening bank, dan ketentuan di **Konfigurasi**.
- Coba satu alur lengkap: daftar → booking → unggah bukti DP → verifikasi → barang keluar → kembali.
- Pastikan halaman **Histori Sistem** menunjukkan "tidak bisa diubah" (rantai utuh).
