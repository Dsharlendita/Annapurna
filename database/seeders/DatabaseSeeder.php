<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $owner = User::updateOrCreate(['email' => 'owner@annapurna.id'], [
            'name' => 'Pak Ikun',
            'phone' => '081200001111',
            'role' => 'owner',
            'status' => 'aktif',
            'password' => 'owner123',
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
                'password' => $password,
                'email_verified_at' => now(),
            ]);
        }

        User::updateOrCreate(['email' => 'customer@annapurna.id'], [
            'name' => 'Dimas Saputra',
            'phone' => '081390001122',
            'address' => 'Jl. Dr. Soeparno No. 12, Purwokerto',
            'role' => 'customer',
            'password' => 'customer123',
            'email_verified_at' => now(),
        ]);
    }
}
