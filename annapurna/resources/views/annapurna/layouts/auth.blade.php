<!DOCTYPE html>
<html lang="id">
<head>
  @include('annapurna.layouts.partials-head')
  <title>@yield('title') — Annapurna Adventure</title>
  <meta name="theme-color" content="#1f4d2f">
  @yield('head')
  @stack('styles')
</head>
<body data-base="{{ rtrim(url('/'), '/') }}/" data-page="@yield('page')">
  @yield('content')

  <script src="{{ asset('assets/js/data.js') }}?v={{ config('app.asset_version') }}"></script>
  <script src="{{ asset('assets/js/ui.js') }}?v={{ config('app.asset_version') }}"></script>
  @stack('scripts')
</body>
</html>
