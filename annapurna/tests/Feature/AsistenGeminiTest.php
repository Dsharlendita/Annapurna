<?php

namespace Tests\Feature;

use App\Models\ChatMiss;
use Database\Seeders\KatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Asisten Trip lewat Gemini (Google ditiru dengan Http::fake). */
class AsistenGeminiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
        $this->seed(KatalogSeeder::class);
        config(['services.gemini.key' => 'kunci-uji', 'services.gemini.model' => 'gemini-2.5-flash', 'services.gemini.daily_limit' => 1000]);
    }

    private static function ok(array $json): array
    {
        return ['candidates' => [['content' => ['parts' => [['text' => json_encode($json)]]]]]];
    }

    /** Jawaban Gemini berurutan untuk setiap panggilan: [json, status]. */
    private function fakeGemini(array ...$replies): void
    {
        $seq = Http::sequence();
        foreach ($replies as [$json, $status]) {
            $seq->push($status === 200 ? (is_array($json) ? self::ok($json) : ['candidates' => [['content' => ['parts' => [['text' => $json]]]]]]) : ['error' => ['message' => 'x']], $status);
        }
        Http::fake(['generativelanguage.googleapis.com/*' => $seq]);
    }

    public function test_tanpa_kunci_tampilan_memakai_jawaban_cadangan(): void
    {
        config(['services.gemini.key' => null]);
        Http::fake();
        $this->postJson('/api/chat', ['pesan' => 'halo'])->assertStatus(503);
        $this->postJson('/api/ai/rencana', ['teks' => 'camping berempat'])->assertStatus(503);
        Http::assertNothingSent();
    }

    public function test_jawaban_gemini_memakai_data_toko_dan_pengetahuan_owner(): void
    {
        $this->fakeGemini([['teks' => 'Bisa! **Tenda** tersedia.', 'aksi' => [['jenis' => 'link', 'label' => 'Lihat Sewa Alat', 'href' => 'katalog']], 'saran' => ['Pembayaran & DP'], 'wa' => false], 200]);

        $this->postJson('/api/chat', [
            'pesan' => 'boleh sewa buat rombongan sekolah?',
            'riwayat' => [['peran' => 'model', 'teks' => 'Halo!'], ['peran' => 'user', 'teks' => 'hai'], ['peran' => 'model', 'teks' => 'Ada yang bisa dibantu?']],
            'konteks' => ['halaman' => 'katalog', 'keranjang' => [['id' => 'tnd-4', 'qty' => 2]]],
            'pengetahuan' => [['topik' => 'Rombongan sekolah', 'jawaban' => 'Diskon 10% untuk rombongan sekolah di atas 20 orang.']],
        ])->assertOk()->assertJsonPath('data.teks', 'Bisa! **Tenda** tersedia.')->assertJsonPath('data.aksi.0.href', 'katalog');

        Http::assertSent(function (HttpRequest $r) {
            $b = $r->data();
            $sys = $b['systemInstruction']['parts'][0]['text'];

            return $r->hasHeader('x-goog-api-key', 'kunci-uji')
                && str_contains($r->url(), 'models/gemini-2.5-flash:generateContent')
                && str_contains($sys, 'Diskon 10% untuk rombongan sekolah')              // pengetahuan Owner
                && str_contains($sys, 'tnd-4 |')                                         // katalog dari database
                && str_contains($sys, 'Jl. Kampus')                                      // info toko dari database
                && $b['contents'][0]['role'] === 'user'                                  // riwayat diawali customer
                && str_contains(end($b['contents'])['parts'][0]['text'], 'keranjang: 2×')
                && $b['generationConfig']['responseMimeType'] === 'application/json';
        });
    }

    public function test_tidak_tahu_dicatat_untuk_owner_dan_diarahkan_ke_admin(): void
    {
        $this->fakeGemini([['teks' => 'Admin akan membantu ya.', 'tidak_tahu' => true], 200]);
        $this->postJson('/api/chat', ['pesan' => 'bisa sewa drone?'])->assertOk()->assertJsonPath('data.wa', true);
        $this->assertSame('bisa sewa drone?', ChatMiss::sole()->question_text);
    }

    public function test_kuota_habis_atau_batas_harian_memakai_cadangan(): void
    {
        $this->fakeGemini([[], 429], [['teks' => 'ok'], 200]);
        $this->postJson('/api/chat', ['pesan' => 'halo'])->assertStatus(429);

        config(['services.gemini.daily_limit' => 1]);
        $this->postJson('/api/chat', ['pesan' => 'halo'])->assertStatus(429);   // panggilan pertama hari ini sudah terpakai di atas
    }

    public function test_jawaban_rusak_atau_google_error_memakai_cadangan(): void
    {
        $this->fakeGemini(['bukan json', 200], [[], 500]);
        $this->postJson('/api/chat', ['pesan' => 'halo'])->assertStatus(502);   // jawaban bukan JSON
        $this->postJson('/api/chat', ['pesan' => 'halo'])->assertStatus(502);   // Google error 500
        $this->postJson('/api/chat', ['pesan' => 'halo'])->assertStatus(502);
    }

    public function test_rencana_trip_hanya_mengambil_angka_yang_wajar(): void
    {
        $this->fakeGemini([['orang' => 4, 'malam' => 1, 'jenis' => 'camping', 'tempat' => 'Baturraden', 'sudah_punya' => ['tent', 'roket']], 200], [['orang' => 999, 'malam' => -3, 'jenis' => 'terbang'], 200]);
        $this->postJson('/api/ai/rencana', ['teks' => 'camping di Baturraden berempat 1 malam, sudah punya tenda', 'mulai' => '2026-11-21', 'selesai' => '2026-11-22'])
            ->assertOk()->assertJsonPath('data', ['orang' => 4, 'malam' => 1, 'jenis' => 'camping', 'tempat' => 'Baturraden', 'sudah_punya' => ['tent']]);

        $this->postJson('/api/ai/rencana', ['teks' => 'jalan-jalan'])->assertOk()
            ->assertJsonPath('data.orang', null)->assertJsonPath('data.malam', null)->assertJsonPath('data.jenis', null);
    }
}
