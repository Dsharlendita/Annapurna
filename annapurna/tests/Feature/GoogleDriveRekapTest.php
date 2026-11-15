<?php

namespace Tests\Feature;

use App\Http\Controllers\Annapurna\BootController;
use App\Mail\MonthlyReportMail;
use App\Models\DriveConnection;
use App\Models\ReportArchive;
use App\Models\Setting;
use App\Models\User;
use App\Models\UserNotification;
use App\Support\Rekap;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as GoogleUser;
use Mockery;
use Tests\TestCase;

/** Rekap bulanan ke Google Drive sungguhan (Google ditiru dengan Http::fake, tanpa internet). */
class GoogleDriveRekapTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
        config(['services.google.client_id' => 'id-uji', 'services.google.client_secret' => 'rahasia-uji']);
        $mk = fn ($name, $email, $role) => User::create(['name' => $name, 'email' => $email, 'role' => $role, 'status' => 'aktif', 'must_change_password' => false, 'password' => 'rahasia123']);
        $this->owner = $mk('Pemilik', 'owner@annapurna.id', 'owner');
        $this->admin = $mk('Dita', 'dita@annapurna.id', 'admin');
        Setting::set('integration', ['driveRoot' => 'ANNAPURNA ADVENTURE', 'autoMonthly' => true, 'sendDay' => 1, 'sendTime' => '06:00', 'ownerEmail' => 'pemilik@contoh.id', 'ccEmails' => 'partner@contoh.id, salah']);
    }

    private function connect(): DriveConnection
    {
        return DriveConnection::create(['connected_by' => $this->owner->id, 'email' => 'toko@gmail.com', 'refresh_token' => 'refresh-uji']);
    }

    /** Google Drive tiruan: folder & file disimpan di array supaya bisa diperiksa. */
    private function fakeDrive(array &$log): void
    {
        $n = 0;
        Http::fake(function (HttpRequest $r) use (&$log, &$n) {
            $url = $r->url();
            $log[] = $r->method() . ' ' . strtok($url, '?');
            if (str_starts_with($url, 'https://oauth2.googleapis.com/token')) {
                return Http::response(['access_token' => 'akses-uji', 'expires_in' => 3599]);
            }
            if (str_starts_with($url, 'https://oauth2.googleapis.com/revoke')) {
                return Http::response([]);
            }
            if ($r->method() === 'GET' && str_contains($url, '/drive/v3/files?')) {
                return Http::response(['files' => []]);              // belum ada folder/file: dibuat baru
            }
            $n++;

            return Http::response(['id' => "id{$n}", 'name' => 'x', 'webViewLink' => "https://drive.google.com/x/id{$n}"]);
        });
    }

    private function pdfs(): array
    {
        return collect(array_keys(Rekap::FILES))->mapWithKeys(fn ($k) => [$k => UploadedFile::fake()->create("$k.pdf", 20, 'application/pdf')])->all();
    }

    private function upload(User $as, string $period = '2026-10', bool $auto = false)
    {
        return $this->actingAs($as)->post('/api/admin/rekap', ['period' => $period, 'auto' => $auto ? 1 : 0, 'summary' => json_encode(['rental' => 4, 'pemasukan' => 1500000]), 'files' => $this->pdfs()], ['Accept' => 'application/json']);
    }

    public function test_tombol_hubungkan_meminta_izin_drive_file_dengan_refresh_token(): void
    {
        $res = $this->actingAs($this->owner)->get('/owner/integrasi/google/hubungkan');
        $url = $res->headers->get('Location');
        $this->assertStringStartsWith('https://accounts.google.com/', $url);
        parse_str(parse_url($url, PHP_URL_QUERY), $q);
        $this->assertStringContainsString('https://www.googleapis.com/auth/drive.file', $q['scope']);
        $this->assertSame('offline', $q['access_type']);
        $this->assertSame('drive', session('google_purpose'));
        $this->actingAs($this->admin)->get('/owner/integrasi/google/hubungkan')->assertStatus(403);
    }

    public function test_callback_menyimpan_akun_drive_tanpa_mengganti_login(): void
    {
        $g = (new GoogleUser())->map(['id' => 'g-9', 'email' => 'Toko@Gmail.com', 'name' => 'Toko'])
            ->setToken('akses')->setRefreshToken('refresh-baru')->setApprovedScopes(['openid', 'email', 'https://www.googleapis.com/auth/drive.file']);
        $p = Mockery::mock(\Laravel\Socialite\Two\GoogleProvider::class);
        $p->shouldReceive('user')->andReturn($g);
        Socialite::shouldReceive('driver')->with('google')->andReturn($p);

        $this->actingAs($this->owner)->withSession(['google_purpose' => 'drive'])
            ->get('/auth/google/callback?code=abc')->assertRedirect(route('owner.integrasi', ['drive' => 'terhubung']));

        $c = DriveConnection::sole();
        $this->assertSame(['toko@gmail.com', 'refresh-baru'], [$c->email, $c->refresh_token]);
        $this->assertNotSame('refresh-baru', \Illuminate\Support\Facades\DB::table('drive_connections')->value('refresh_token'));   // tersimpan terenkripsi
        $this->assertAuthenticatedAs($this->owner);
        $this->assertNull($this->owner->fresh()->google_id);                                              // bukan login Google

        // Owner tampil terhubung (pengaturan dari server, bukan isian tampilan)
        $this->assertTrue(\App\Support\FeData::settings(true)['integration']['driveConnected']);
    }

    public function test_izin_drive_tidak_dicentang_ditolak(): void
    {
        $g = (new GoogleUser())->map(['id' => 'g-9', 'email' => 'toko@gmail.com'])->setToken('a')->setRefreshToken('r')->setApprovedScopes(['openid', 'email']);
        $p = Mockery::mock(\Laravel\Socialite\Two\GoogleProvider::class);
        $p->shouldReceive('user')->andReturn($g);
        Socialite::shouldReceive('driver')->with('google')->andReturn($p);

        $this->actingAs($this->owner)->withSession(['google_purpose' => 'drive'])
            ->get('/auth/google/callback?code=abc')->assertRedirect(route('owner.integrasi', ['drive' => 'izin']));
        $this->assertSame(0, DriveConnection::count());
    }

    public function test_rekap_diunggah_ke_folder_tahun_dan_bulan(): void
    {
        $this->connect();
        $log = [];
        $this->fakeDrive($log);

        $res = $this->upload($this->owner)->assertOk()
            ->assertJsonPath('data.period', '2026-10')
            ->assertJsonPath('data.path', ['ANNAPURNA ADVENTURE', 'TAHUN 2026', 'REKAP LAPORAN BULAN OKTOBER 2026'])
            ->assertJsonPath('data.files.0.name', 'Laporan Rental Oktober 2026.pdf')
            ->assertJsonPath('data.mailStatus', 'nonaktif');           // MAIL_MAILER=log: tidak pura-pura terkirim
        $this->assertCount(7, $res->json('data.files'));
        $this->assertNotEmpty($res->json('data.files.6.url'));
        $this->assertStringStartsWith('https://drive.google.com/', $res->json('data.folderUrl'));

        // 3 folder dibuat + 7 file diunggah (multipart)
        $this->assertSame(3, count(array_filter($log, fn ($l) => $l === 'POST https://www.googleapis.com/drive/v3/files')));
        $this->assertSame(7, count(array_filter($log, fn ($l) => $l === 'POST https://www.googleapis.com/upload/drive/v3/files')));
        Http::assertSent(fn ($r) => str_contains($r->url(), 'uploadType=multipart') && str_contains($r->body(), '"name":"Laporan Rental Oktober 2026.pdf"') && $r->hasHeader('Authorization', 'Bearer akses-uji'));

        $a = ReportArchive::sole();
        $this->assertSame([1, 1500000], [$a->version, $a->summary['pemasukan']]);
        $this->assertSame('id1', DriveConnection::sole()->root_folder_id);
    }

    public function test_email_ringkasan_terkirim_bila_server_email_aktif(): void
    {
        config(['mail.default' => 'smtp']);
        Mail::fake();
        $this->connect();
        $log = [];
        $this->fakeDrive($log);

        $this->upload($this->owner)->assertOk()->assertJsonPath('data.mailStatus', 'terkirim')->assertJsonPath('data.mailTo', 'pemilik@contoh.id, partner@contoh.id');
        Mail::assertSent(MonthlyReportMail::class, fn ($m) => $m->hasTo('pemilik@contoh.id') && $m->hasCc('partner@contoh.id'));
        $html = (new MonthlyReportMail(ReportArchive::sole()))->render();
        $this->assertStringContainsString('Oktober 2026', $html);
        $this->assertStringContainsString('Rp 1.500.000', $html);
    }

    public function test_rekap_otomatis_tidak_menimpa_dan_owner_bisa_memperbarui(): void
    {
        $this->connect();
        $log = [];
        $this->fakeDrive($log);
        $this->upload($this->admin, '2026-10', true)->assertOk()->assertJsonPath('data.auto', true);
        $n = count($log);

        // Perangkat lain menjalankan rekap otomatis yang sama → hasil lama dipakai, tidak unggah ulang
        $this->upload($this->admin, '2026-10', true)->assertOk()->assertJsonPath('existed', true);
        $this->assertSame($n, count($log));

        // Owner memperbarui → versi 2
        $this->upload($this->owner)->assertOk()->assertJsonPath('data.version', 2)->assertJsonPath('data.by', 'Pemilik');
        $this->assertSame(1, ReportArchive::count());
    }

    public function test_tanpa_drive_atau_file_tidak_lengkap_ditolak(): void
    {
        $this->upload($this->owner)->assertStatus(409)->assertJsonPath('reconnect', true);
        $this->connect();
        $this->actingAs($this->owner)->post('/api/admin/rekap', ['period' => '2026-10', 'files' => ['rental' => UploadedFile::fake()->create('a.pdf', 5, 'application/pdf')]], ['Accept' => 'application/json'])->assertStatus(422);
        $this->upload($this->owner, '2099-01')->assertStatus(422);
        $this->actingAs(User::create(['name' => 'Budi', 'email' => 'budi@mail.com', 'role' => 'customer', 'status' => 'aktif', 'password' => 'rahasia123']))
            ->post('/api/admin/rekap', ['period' => '2026-10'], ['Accept' => 'application/json'])->assertForbidden();
    }

    public function test_akses_dicabut_owner_diminta_menghubungkan_ulang(): void
    {
        $this->connect();
        Http::fake(['oauth2.googleapis.com/token' => Http::response(['error' => 'invalid_grant'], 400)]);
        $this->upload($this->admin, '2026-10', true)->assertStatus(409)->assertJsonPath('reconnect', true);
        $this->assertSame(0, ReportArchive::count());
        $this->assertSame('Google Drive perlu dihubungkan ulang', UserNotification::where('user_id', $this->owner->id)->value('title'));
    }

    public function test_jadwal_rekap_otomatis(): void
    {
        $at = fn ($s) => CarbonImmutable::parse($s, Rekap::TZ);
        $this->assertNull(Rekap::duePeriod($at('2026-12-01 05:59')));           // belum terhubung
        $this->connect();
        $this->assertNull(Rekap::duePeriod($at('2026-12-01 05:59')));           // belum jam 06.00
        $this->assertSame('2026-11', Rekap::duePeriod($at('2026-12-01 06:00')));
        $this->assertSame('2026-12', Rekap::duePeriod($at('2027-01-20 08:00')));
        ReportArchive::create(['period' => '2026-11', 'drive_folder_id' => 'f', 'drive_folder_url' => 'u', 'path' => [], 'files' => []]);
        $this->assertNull(Rekap::duePeriod($at('2026-12-03 08:00')));           // sudah dibuat

        $this->actingAs($this->owner);
        $d = BootController::userData();
        $this->assertSame(['connected' => true, 'email' => 'toko@gmail.com'], array_intersect_key($d['drive'], ['connected' => 1, 'email' => 1]));
        $this->assertSame('2026-11', $d['archives'][0]['period']);
        $this->actingAs($this->admin);
        $this->assertArrayNotHasKey('drive', BootController::userData());   // akun Drive & arsip hanya untuk Owner
    }

    public function test_putuskan_mencabut_izin_dan_tampilan_tidak_bisa_memalsukan_status(): void
    {
        $this->connect();
        $log = [];
        $this->fakeDrive($log);
        $this->actingAs($this->owner)->postJson('/api/sync/settings', ['items' => ['integration' => ['driveConnected' => false, 'driveAccount' => 'palsu@x.id', 'driveRoot' => 'ARSIP']]])->assertOk();
        $this->assertSame(['driveRoot' => 'ARSIP'], Setting::get('integration'));
        $this->assertTrue(\App\Support\FeData::settings(true)['integration']['driveConnected']);

        $this->actingAs($this->admin)->deleteJson('/api/owner/drive')->assertForbidden();
        $this->actingAs($this->owner)->deleteJson('/api/owner/drive')->assertOk();
        $this->assertSame(0, DriveConnection::count());
        $this->assertContains('POST https://oauth2.googleapis.com/revoke', $log);
    }
}
