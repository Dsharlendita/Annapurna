<?php

namespace Tests\Feature;

use App\Models\Package;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Paket sewa (termasuk paket tektok) dari Data Barang tersimpan di server. */
class PaketSewaTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
        DB::table('categories')->insert(['id' => 'tenda', 'name' => 'Tenda']);
        DB::table('products')->insert(['id' => 'tnd-4', 'name' => 'Tenda 4P', 'category_id' => 'tenda', 'rent_price' => 40000, 'stock' => 2]);
        $this->admin = User::create(['name' => 'Dita', 'email' => 'dita@annapurna.id', 'role' => 'admin', 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
    }

    public function test_paket_tektok_tersimpan_tanpa_harga_3_dan_5_malam(): void
    {
        $paket = ['id' => 'pk-tektok', 'name' => 'Paket Tektok', 'price' => 50000, 'price3' => 120000, 'price5' => 200000, 'type' => 'tektok',
            'items' => [['productId' => 'tnd-4', 'qty' => 2], ['productId' => 'tidak-ada', 'qty' => 1]]];
        $this->actingAs($this->admin)->postJson('/api/sync/packages', ['items' => [$paket]])->assertOk();

        $pk = Package::with('items')->find('pk-tektok');
        $this->assertSame(['tektok', 50000, null, null], [$pk->type, $pk->price_per_day, $pk->price_3, $pk->price_5]);
        $this->assertSame([['tnd-4', 2]], $pk->items->map(fn ($i) => [$i->product_id, $i->qty])->all());

        $this->actingAs($this->admin)->postJson('/api/sync/packages', ['items' => [], 'removed' => ['pk-tektok']])->assertOk();
        $this->assertNull(Package::find('pk-tektok'));
    }

    public function test_pelanggan_tidak_boleh_mengubah_paket(): void
    {
        $cust = User::create(['name' => 'Budi', 'email' => 'budi@contoh.id', 'role' => 'customer', 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
        $this->actingAs($cust)->postJson('/api/sync/packages', ['items' => [['id' => 'pk-x', 'name' => 'X', 'price' => 1]]])->assertForbidden();
        $this->assertNull(Package::find('pk-x'));
    }
}
