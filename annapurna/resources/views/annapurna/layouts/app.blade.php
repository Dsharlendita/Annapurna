<!DOCTYPE html>
<html lang="id">
<head>
  @include('annapurna.layouts.partials-head')
  <title>@yield('title')@yield('title_suffix', ' — Annapurna Adventure')</title>
  <meta name="theme-color" content="#1f4d2f">
  @yield('head')
  @stack('styles')
</head>
<body data-base="{{ rtrim(url('/'), '/') }}/" data-page="@yield('page')">
  <div id="site-header"></div>
  @yield('content')
  <div id="site-footer"></div>

  <script src="{{ asset('assets/js/data.js') }}?v={{ config('app.asset_version') }}"></script>
  @auth
  <script>
    /* Sinkronkan sesi Laravel ke frontend. Dicocokkan lewat EMAIL (bukan ID), karena ID di database bisa berbeda dengan ID data demo. */
    if (window.Ann && window.Ann.DB) {
      window.Ann.DB.adoptSession({
        userId: {{ auth()->id() }},
        name: @json(auth()->user()->name),
        email: @json(auth()->user()->email),
        role: @json(auth()->user()->role),
        status: @json(auth()->user()->status ?? 'aktif'),
        phone: @json(auth()->user()->phone ?? ''),
        address: @json(auth()->user()->address ?? ''),
        mustChangePw: {{ auth()->user()->must_change_password ? 'true' : 'false' }},
        loginAt: @json(auth()->user()->last_login_at?->toISOString() ?? now()->toISOString())
      });
    }
  </script>
  @endauth
  @guest
  <script>
    /* Server sudah logout / sesi habis: hapus juga sesi di browser supaya tidak "nyangkut". */
    if (window.Ann && window.Ann.DB && window.Ann.DB.session()) window.Ann.DB.clearSession();
  </script>
  @endguest
  <script src="{{ asset('assets/js/ui.js') }}?v={{ config('app.asset_version') }}"></script>
  <script src="{{ asset('assets/js/api.js') }}?v={{ config('app.asset_version') }}"></script>
  <script src="{{ asset('assets/js/site.js') }}?v={{ config('app.asset_version') }}"></script>
  {{-- Asisten Trip tersedia di semua halaman customer (bukan hanya beranda) --}}
  <script src="{{ asset('assets/js/ai.js') }}?v={{ config('app.asset_version') }}"></script>
  @stack('scripts')
</body>
</html>
