<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => \App\Http\Middleware\EnsureRole::class,
            'password.changed' => \App\Http\Middleware\EnsurePasswordChanged::class,
        ]);
        // Pemeriksaan CSRF AKTIF untuk semua request POST/PUT/PATCH/DELETE (tanpa pengecualian). Front-end mengirim header X-CSRF-TOKEN dari meta csrf-token.
        // Header keamanan (CSP + nonce, anti-clickjacking, nosniff, dll.) untuk semua jawaban Laravel
        $middleware->append(\App\Http\Middleware\SecurityHeaders::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
    })
    ->create();
