<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** GET api/admin/denyut: tanda perubahan pesanan supaya panel admin tahu ada pesanan baru tanpa refresh. */
class DenyutPesananTest extends TestCase
{
    use RefreshDatabase;

    public function test_tanda_berubah_saat_ada_pesanan_baru_dan_hanya_untuk_staf(): void
    {
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
        DB::table('categories')->insert(['id' => 'jual', 'name' => 'Jual']);
        DB::table('products')->insert(['id' => 'jl-1', 'name' => 'Gas Kaleng', 'category_id' => 'jual', 'rent_price' => 0, 'sale_price' => 25000, 'stock' => 5]);
        $admin = User::create(['name' => 'Dita', 'email' => 'dita@annapurna.id', 'role' => 'admin', 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
        $cust = User::create(['name' => 'Budi', 'email' => 'budi@mail.com', 'phone' => '0812', 'role' => 'customer', 'status' => 'aktif', 'password' => 'rahasia123']);

        // Customer tidak boleh membaca denyut admin
        $this->actingAs($cust)->getJson('/api/admin/denyut')->assertForbidden();

        $sig1 = $this->actingAs($admin)->getJson('/api/admin/denyut')->assertOk()->json('sig');
        $this->assertSame($sig1, $this->actingAs($admin)->getJson('/api/admin/denyut')->json('sig'), 'tanpa perubahan, tanda tetap');

        // Customer membeli → tanda berubah
        $this->actingAs($cust)->postJson('/api/sale', ['customer_name' => 'Budi', 'customer_phone' => '0812', 'customer_email' => 'budi@mail.com', 'items' => [['product_id' => 'jl-1', 'qty' => 1]]])->assertOk();
        $sig2 = $this->actingAs($admin)->getJson('/api/admin/denyut')->json('sig');
        $this->assertNotSame($sig1, $sig2);

        // Status pesanan berubah (updated_at) → tanda berubah lagi
        $this->travel(2)->seconds();
        DB::table('sales')->update(['status' => 'dikemas', 'updated_at' => now()]);
        $this->assertNotSame($sig2, $this->actingAs($admin)->getJson('/api/admin/denyut')->json('sig'));
    }
}
