<!DOCTYPE html>
<html lang="id">
<head>
  @include('annapurna.layouts.partials-head')
  <title>@yield('title') — Panel Annapurna</title>
  <meta name="theme-color" content="#15311f">
  <meta name="robots" content="noindex">
  @stack('styles')
</head>
<body data-base="{{ rtrim(url('/'), '/') }}/" data-page="admin-@yield('menu')" data-owner-only="@yield('owner_only', '0')">
  <div class="admin">
    <aside class="side" id="side" aria-label="Menu panel"></aside>
    <div class="side-bg" id="sideBg"></div>
    <div class="main">
      <header class="topbar" id="topbar"></header>
      <main class="content">
        @yield('content')
      </main>
    </div>
  </div>

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
  <script src="{{ asset('assets/js/admin.js') }}?v={{ config('app.asset_version') }}"></script>
  <script src="{{ asset('assets/js/reports.js') }}?v={{ config('app.asset_version') }}"></script>
  @stack('scripts')
</body>
</html>
