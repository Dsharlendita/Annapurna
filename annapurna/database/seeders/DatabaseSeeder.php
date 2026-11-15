<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Akun awal + katalog + contoh transaksi.
 *
 * Laptop (APP_ENV=local): kata sandi demo owner123 / dita123 / customer123 (tombol "Akun demo" di halaman masuk).
 * Server online (APP_ENV selain local/testing): kata sandi demo TIDAK dipakai, karena repo ini public.
 *   Kata sandi diambil dari .env (SEED_OWNER_PASSWORD, SEED_ADMIN_PASSWORD) atau dibuat acak dan
 *   ditampilkan sekali di terminal. Owner & admin wajib mengganti kata sandi saat pertama masuk.
 *   Akun customer contoh tidak dibuat.
 */
class DatabaseSeeder extends Seeder
{
    private function password(string $envKey, string $demo): string
    {
        if (app()->environment('local', 'testing')) {
            return $demo;
        }
        $pw = env($envKey) ?: Str::password(14, symbols: false);
        $this->command?->warn("Kata sandi awal {$envKey}: {$pw}  (catat sekarang, wajib diganti saat pertama masuk)");

        return $pw;
    }

    public function run(): void
    {
        $online = ! app()->environment('local', 'testing');

        $owner = User::updateOrCreate(['email' => 'owner@annapurna.id'], [
            'name' => 'Pak Ikun',
            'phone' => '081200001111',
            'role' => 'owner',
            'status' => 'aktif',
            'password' => $this->password('SEED_OWNER_PASSWORD', 'owner123'),
            'must_change_password' => $online,
            'email_verified_at' => now(),
        ]);

        $staff = [
            ['Dita', 'dita@annapurna.id', '085711223344', 'dita123'],
        ];

        foreach ($staff as [$name, $email, $phone, $password]) {
            User::updateOrCreate(['email' => $email], [
                'name' => $name,
                'phone' => $phone,
                'role' => 'admin',
                'status' => 'aktif',
                'created_by' => $owner->id,
                'password' => $this->password('SEED_ADMIN_PASSWORD', $password),
                'must_change_password' => $online,
                'email_verified_at' => now(),
            ]);
        }

        if (! $online) {
            User::updateOrCreate(['email' => 'customer@annapurna.id'], [
                'name' => 'Dimas Saputra',
                'phone' => '081390001122',
                'address' => 'Jl. Dr. Soeparno No. 12, Purwokerto',
                'role' => 'customer',
                'password' => 'customer123',
                'email_verified_at' => now(),
            ]);
        }

        $this->call($online ? [KatalogSeeder::class, LaundrySeeder::class] : [KatalogSeeder::class, LaundrySeeder::class, ContohTransaksiSeeder::class]);
    }
}
