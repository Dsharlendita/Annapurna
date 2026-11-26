<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Migrasi nomor Owner: hanya nomor contoh seeder yang diganti ke nomor Pak Ikun. */
class NomorOwnerTest extends TestCase
{
    use RefreshDatabase;

    public function test_hanya_nomor_contoh_yang_diganti(): void
    {
        $a = User::create(['name' => 'Pak Ikun', 'email' => 'owner@annapurna.id', 'role' => 'owner', 'status' => 'aktif', 'phone' => '081200001111', 'password' => 'rahasia1']);
        $b = User::create(['name' => 'Owner 2', 'email' => 'o2@annapurna.id', 'role' => 'owner', 'status' => 'aktif', 'phone' => '081377778888', 'password' => 'rahasia1']);
        $c = User::create(['name' => 'Cust', 'email' => 'c@mail.com', 'role' => 'customer', 'status' => 'aktif', 'phone' => '081200001111', 'password' => 'rahasia1']);

        (require database_path('migrations/2026_11_27_000001_set_owner_phone_from_placeholder.php'))->up();

        $this->assertSame('085742202043', $a->fresh()->phone);
        $this->assertSame('081377778888', $b->fresh()->phone);   // nomor buatan Owner tidak disentuh
        $this->assertSame('081200001111', $c->fresh()->phone);   // bukan owner
    }
}
