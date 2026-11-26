<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

/**
 * Tes kirim email dengan pengaturan MAIL_* di .env (pengganti `php artisan tinker`, karena hosting memblokir eval).
 *   php artisan mail:tes alamat@gmail.com
 * Menampilkan pengaturan yang terbaca (tanpa password) lalu mengirim satu email percobaan.
 */
class TestMail extends Command
{
    protected $signature = 'mail:tes {email : Alamat tujuan email percobaan}';

    protected $description = 'Kirim satu email percobaan untuk memastikan pengaturan SMTP di .env benar';

    public function handle(): int
    {
        $to = (string) $this->argument('email');
        if (! filter_var($to, FILTER_VALIDATE_EMAIL)) {
            $this->error("Alamat email tidak valid: {$to}");

            return self::FAILURE;
        }

        $mailer = (string) config('mail.default');
        $smtp = (array) config('mail.mailers.smtp');
        $this->table(['Pengaturan', 'Nilai terbaca'], [
            ['MAIL_MAILER', $mailer],
            ['MAIL_SCHEME', (string) ($smtp['scheme'] ?? '-')],
            ['MAIL_HOST', (string) ($smtp['host'] ?? '-')],
            ['MAIL_PORT', (string) ($smtp['port'] ?? '-')],
            ['MAIL_USERNAME', (string) ($smtp['username'] ?? '-')],
            ['MAIL_PASSWORD', empty($smtp['password']) ? '(KOSONG)' : '(terisi, disembunyikan)'],
            ['MAIL_FROM_ADDRESS', (string) config('mail.from.address')],
        ]);

        if ($mailer === 'log') {
            $this->warn('MAIL_MAILER masih "log": email hanya ditulis ke log, tidak terkirim.');
            $this->line('Periksa .env, lalu jalankan: php artisan optimize');

            return self::FAILURE;
        }

        $this->line("Mengirim email percobaan ke {$to} ...");
        try {
            Mail::raw("Tes email dari website Annapurna Adventure.\n\nKalau email ini sampai, pengaturan SMTP sudah benar.", function ($m) use ($to) {
                $m->to($to)->subject('Tes SMTP Annapurna');
            });
        } catch (\Throwable $e) {
            $this->error('GAGAL: ' . $e->getMessage());

            return self::FAILURE;
        }

        $this->info('TERKIRIM. Cek kotak masuk (dan folder Spam) ' . $to);

        return self::SUCCESS;
    }
}
