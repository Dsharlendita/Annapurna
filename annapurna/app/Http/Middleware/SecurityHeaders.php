<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\View;
use Symfony\Component\HttpFoundation\Response;

/**
 * Header keamanan untuk semua halaman & API (temuan OWASP ZAP):
 * - Content-Security-Policy: skrip hanya dari website ini + skrip inline yang membawa nonce acak per permintaan,
 *   sehingga skrip sisipan (XSS) tidak dijalankan browser. Semua library ada di public/assets/vendor (tanpa CDN).
 * - Anti-clickjacking (frame-ancestors + X-Frame-Options), nosniff, Referrer-Policy, Permissions-Policy.
 * - HSTS hanya saat diakses lewat https (di hosting).
 * Di Blade, skrip inline wajib ditulis <script nonce="{{ $cspNonce }}">.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $nonce = base64_encode(random_bytes(16));
        View::share('cspNonce', $nonce);

        $response = $next($request);

        $csp = implode('; ', array_filter([
            "default-src 'self'",
            "script-src 'self' 'nonce-{$nonce}'",
            // Atribut style="" dipakai luas di tampilan; gaya tidak bisa menjalankan skrip
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            "connect-src 'self'",
            // Peta lokasi toko (halaman Kontak)
            'frame-src https://maps.google.com https://www.google.com',
            "frame-ancestors 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            $request->isSecure() ? 'upgrade-insecure-requests' : null,
        ]));

        $headers = [
            'Content-Security-Policy' => $csp,
            'X-Frame-Options' => 'SAMEORIGIN',
            'X-Content-Type-Options' => 'nosniff',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
            // Kamera dipakai admin untuk memindai QR nota
            'Permissions-Policy' => 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
        ];
        if ($request->isSecure()) {
            $headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
        }
        // Halaman error mode debug (hanya di laptop, APP_DEBUG=true) memakai skrip inline sendiri
        if (config('app.debug') && $response->getStatusCode() >= 500) {
            unset($headers['Content-Security-Policy']);
        }
        foreach ($headers as $k => $v) {
            if (! $response->headers->has($k)) {
                $response->headers->set($k, $v);
            }
        }
        // Cookie XSRF-TOKEN bawaan Laravel bisa dibaca JavaScript (tanpa HttpOnly). Tampilan memakai token dari
        // <meta name="csrf-token"> (header X-CSRF-TOKEN), jadi cookie ini tidak dibutuhkan dan tidak dikirim.
        $response->headers->removeCookie('XSRF-TOKEN', config('session.path', '/'), config('session.domain'));
        $response->headers->remove('X-Powered-By');
        if (! headers_sent()) {
            header_remove('X-Powered-By');
        }

        return $response;
    }
}
