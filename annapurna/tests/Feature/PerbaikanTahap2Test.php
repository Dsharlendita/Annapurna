<?php

namespace Tests\Feature;

use App\Models\Sale;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Temuan laporan uji (Tahap 2): notifikasi ke semua staf, profil customer, cek pesanan tanpa login, notifikasi otomatis. */
class PerbaikanTahap2Test extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $cust;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
        DB::table('categories')->insert(['id' => 'jual', 'name' => 'Jual']);
        DB::table('products')->insert(['id' => 'jl-1', 'name' => 'Gas Kaleng', 'category_id' => 'jual', 'rent_price' => 0, 'sale_price' => 25000, 'stock' => 5]);
        $this->owner = User::create(['name' => 'Ikun', 'email' => 'owner@annapurna.id', 'role' => 'owner', 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
        User::create(['name' => 'Dita', 'email' => 'dita@annapurna.id', 'role' => 'admin', 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
        User::create(['name' => 'Staf Baru', 'email' => 'baru@annapurna.id', 'role' => 'admin', 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
        User::create(['name' => 'Staf Lama', 'email' => 'lama@annapurna.id', 'role' => 'admin', 'status' => 'nonaktif', 'must_change_password' => false, 'password' => 'rahasia123']);
        $this->cust = User::create(['name' => 'Budi', 'email' => 'budi@mail.com', 'phone' => '0812-3456-7890', 'role' => 'customer', 'status' => 'aktif', 'password' => 'rahasia123']);
    }

    public function test_notifikasi_dari_customer_sampai_ke_semua_staf_aktif(): void
    {
        $this->actingAs($this->cust)->postJson('/api/sync/notifications', ['items' => [['id' => 'n1', 'email' => '@staff', 'title' => 'Bukti pembayaran masuk', 'text' => 'Budi mengunggah bukti', 'link' => 'admin/penjualan']]])->assertOk();
        $got = UserNotification::where('title', 'Bukti pembayaran masuk')->with('user')->get()->map(fn ($n) => $n->user->email)->sort()->values()->all();
        $this->assertSame(['baru@annapurna.id', 'dita@annapurna.id', 'owner@annapurna.id'], $got, 'staf baru ikut, staf nonaktif tidak');
    }

    public function test_profil_customer_tersimpan_di_server_termasuk_alamat(): void
    {
        $this->actingAs($this->cust)->postJson('/api/akun/profil', ['name' => 'Budi Santoso', 'phone' => '081399998888', 'address' => 'Jl. Merdeka 1'])->assertOk();
        $u = $this->cust->fresh();
        $this->assertSame(['Budi Santoso', '081399998888', 'Jl. Merdeka 1'], [$u->name, $u->phone, $u->address]);
    }

    public function test_daftar_akun_membuat_notifikasi_selamat_datang(): void
    {
        $this->postJson('/daftar', ['name' => 'Rina', 'email' => 'rina@mail.com', 'phone' => '0813', 'password' => 'rahasia9'])->assertOk();
        $this->assertSame(1, UserNotification::whereHas('user', fn ($q) => $q->where('email', 'rina@mail.com'))->where('title', 'like', 'Selamat datang%')->count());
    }

    public function test_batal_otomatis_mengabari_customer(): void
    {
        $code = $this->actingAs($this->cust)->postJson('/api/sale', ['customer_name' => 'Budi', 'customer_phone' => '081234567890', 'customer_email' => 'budi@mail.com', 'items' => [['product_id' => 'jl-1', 'qty' => 1]]])->json('sale.sale_code');
        Sale::where('sale_code', $code)->update(['expired_at' => now()->subMinute()]);
        $this->artisan('bookings:expire-unpaid')->assertSuccessful();
        $this->assertSame(1, UserNotification::where('user_id', $this->cust->id)->where('title', 'Pesanan dibatalkan otomatis')->count());
    }

    public function test_cek_pesanan_tanpa_login_dari_server_tanpa_data_pribadi(): void
    {
        $r = $this->actingAs($this->cust)->postJson('/api/sale', ['customer_name' => 'Budi Santoso', 'customer_phone' => '0812-3456-7890', 'customer_email' => 'budi@mail.com', 'items' => [['product_id' => 'jl-1', 'qty' => 2]]]);
        $nota = $r->json('sale.nota_no');
        Auth::logout();
        // Nomor HP ditulis dengan format lain (+62…) tetap cocok
        $res = $this->getJson('/api/cek-pesanan?no=' . urlencode(strtolower($nota)) . '&hp=' . urlencode('+62 812 3456 7890'))->assertOk();
        $this->assertSame('menunggu_pembayaran', $res->json('data.status'));
        $this->assertSame('Budi Santoso', $res->json('data.customer.name'));
        $this->assertSame([['name' => 'Gas Kaleng', 'qty' => 2]], $res->json('data.items'));
        $this->assertStringNotContainsString('budi@mail.com', $res->getContent(), 'email tidak ikut');
        // Nomor HP salah → tidak ditemukan
        $this->getJson('/api/cek-pesanan?no=' . urlencode($nota) . '&hp=081111111111')->assertNotFound();
    }

    public function test_owner_menerima_daftar_staf_sebenarnya(): void
    {
        $js = $this->actingAs($this->owner)->get('/boot-staff.js?v=x')->assertOk()->getContent();
        foreach (['baru@annapurna.id', 'lama@annapurna.id', 'dita@annapurna.id'] as $e) {
            $this->assertStringContainsString($e, $js);
        }
        $this->assertStringNotContainsString('budi@mail.com"', explode('"staffList"', $js)[1] ?? '', 'customer tidak ikut daftar staf');
    }
}
