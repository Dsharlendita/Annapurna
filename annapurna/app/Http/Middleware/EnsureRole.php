<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Pemakaian: ->middleware(['auth', 'role:owner']) atau 'role:admin,owner'.
 * Staff yang dinonaktifkan Owner langsung dikeluarkan.
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if ($user && $user->status === 'nonaktif') {
            Auth::logout();
            $request->session()->invalidate();

            return redirect()->route('masuk')->withErrors(['email' => 'Akun ini sedang dinonaktifkan. Hubungi Owner.']);
        }

        abort_unless($user && in_array($user->role, $roles, true), 403);

        return $next($request);
    }
}
