<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsurePasswordChanged
{
    /**
     * Memastikan user dengan must_change_password = true wajib mengganti sandi
     * sebelum dapat mengakses resource/endpoint lain.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = Auth::user();

        if ($user && $user->must_change_password) {
            $allowedPaths = [
                'api/akun/ganti-sandi',
                'akun/kata-sandi',
                'api/logout',
                'keluar',
                'api/me',
            ];

            $currentPath = trim($request->path(), '/');

            $isAllowed = false;
            foreach ($allowedPaths as $path) {
                if ($currentPath === $path || str_ends_with($currentPath, $path)) {
                    $isAllowed = true;
                    break;
                }
            }

            if (!$isAllowed) {
                if ($request->expectsJson() || $request->is('api/*')) {
                    return response()->json([
                        'ok' => false,
                        'code' => 'MUST_CHANGE_PASSWORD',
                        'msg' => 'Anda wajib mengganti kata sandi sementara terlebih dahulu sebelum melanjutkan.',
                    ], 403);
                }
            }
        }

        return $next($request);
    }
}
