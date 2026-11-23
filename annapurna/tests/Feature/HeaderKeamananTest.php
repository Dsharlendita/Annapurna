<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Header keamanan (temuan OWASP ZAP): CSP dengan nonce, anti-clickjacking, nosniff, tanpa X-Powered-By. */
class HeaderKeamananTest extends TestCase
{
    use RefreshDatabase;

    public function test_halaman_publik_membawa_header_keamanan(): void
    {
        foreach (['/', '/masuk', '/kontak', '/privasi'] as $url) {
            $r = $this->get($url)->assertOk();
            $csp = (string) $r->headers->get('Content-Security-Policy');
            $this->assertMatchesRegularExpression("/script-src 'self' 'nonce-[A-Za-z0-9+\/=]{20,}'/", $csp, $url);
            $this->assertStringNotContainsString("script-src 'self' 'unsafe-inline'", $csp);
            $this->assertStringContainsString("frame-ancestors 'self'", $csp);
            $this->assertStringContainsString("object-src 'none'", $csp);
            $r->assertHeader('X-Frame-Options', 'SAMEORIGIN')
                ->assertHeader('X-Content-Type-Options', 'nosniff')
                ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
            $r->assertHeaderMissing('X-Powered-By');
        }
    }

    public function test_skrip_inline_memakai_nonce_yang_sama_dengan_header(): void
    {
        $r = $this->get('/belanja')->assertOk();
        preg_match("/'nonce-([^']+)'/", (string) $r->headers->get('Content-Security-Policy'), $m);
        $html = $r->getContent();
        $this->assertStringContainsString('<script nonce="' . $m[1] . '">', $html);
        // Tidak ada skrip inline tanpa nonce, dan tidak ada onclick inline
        $this->assertDoesNotMatchRegularExpression('/<script>/', $html);
        $this->assertDoesNotMatchRegularExpression('/\son[a-z]+="/i', $html);
    }

    public function test_cookie_xsrf_tidak_dikirim_dan_sesi_httponly(): void
    {
        $r = $this->get('/masuk')->assertOk();
        $names = array_map(fn ($c) => $c->getName(), $r->headers->getCookies());
        $this->assertNotContains('XSRF-TOKEN', $names);
        foreach ($r->headers->getCookies() as $c) {
            $this->assertTrue($c->isHttpOnly(), $c->getName() . ' harus HttpOnly');
        }
        // Token CSRF tetap tersedia lewat <meta> untuk tampilan
        $this->assertMatchesRegularExpression('/<meta name="csrf-token" content="[^"]{20,}"/', $r->getContent());
    }

    public function test_halaman_kebijakan_privasi_ada(): void
    {
        // Dibutuhkan Google (Branding → Privacy policy link) sebelum aplikasi login Google bisa di-Publish
        $this->get('/privasi')->assertOk()->assertSee('Kebijakan privasi')->assertSee('Google Gemini')->assertSee('tidak menjual', false);
    }

    public function test_nonce_berbeda_tiap_permintaan(): void
    {
        $a = $this->get('/')->headers->get('Content-Security-Policy');
        $b = $this->get('/')->headers->get('Content-Security-Policy');
        $this->assertNotSame($a, $b);
    }

    public function test_hsts_hanya_saat_https(): void
    {
        $this->get('/')->assertHeaderMissing('Strict-Transport-Security');
        $this->get('https://localhost/')->assertHeader('Strict-Transport-Security');
    }
}
