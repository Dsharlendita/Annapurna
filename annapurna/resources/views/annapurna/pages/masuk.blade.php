@extends('annapurna.layouts.auth')

@section('title', 'Masuk')
@section('page', 'auth')

@section('content')
<div class="auth">
  <div class="auth-art">
    <a class="brandw" href="{{ route('home') }}"><img src="{{ asset('assets/img/logo-white.png') }}" alt="Annapurna Adventure"></a>
    <div class="art-txt"><h2>Jangan cuma mimpi,<br>rasakan petualangannya!</h2><p>Masuk untuk melihat booking, membayar DP, dan mengatur pesananmu.</p></div>
  </div>
  <div class="auth-form">
    {{-- data-google: tombol Google aktif (kunci Google Cloud sudah diisi). data-mail: email kode verifikasi benar-benar terkirim. --}}
    <div class="auth-box" data-google="{{ \App\Http\Controllers\Annapurna\GoogleAuthController::enabled() ? 1 : 0 }}" data-mail="{{ config('mail.default') !== 'log' ? 1 : 0 }}">
      <a class="back" href="{{ route('home') }}"><i class="fa-solid fa-arrow-left"></i> Kembali ke beranda</a>
      <h1>Masuk</h1>
      <p>Belum punya akun? <a class="link" id="toRegister" href="{{ route('daftar') }}">Daftar di sini</a></p>
      <form id="loginForm" novalidate>
        <div class="field"><label for="email">Email</label><div class="input-icon"><i class="fa-regular fa-envelope"></i><input class="input" id="email" name="email" type="email" autocomplete="email" placeholder="nama@email.com"></div></div>
        <div class="field"><label for="password">Kata sandi</label><div class="input-icon"><i class="fa-solid fa-lock"></i><input class="input" id="password" name="password" type="password" autocomplete="current-password" placeholder="Kata sandi"><button type="button" class="toggle-pw" aria-label="Tampilkan kata sandi"><i class="fa-regular fa-eye"></i></button></div></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;gap:10px;flex-wrap:wrap">
          <label class="check"><input type="checkbox" checked> Ingat saya</label>
          <a class="link" href="#" id="forgot" style="font-size:13.5px">Lupa kata sandi?</a>
        </div>
        <button class="btn btn-primary btn-block" type="submit">Masuk</button>
      </form>
      @if (\App\Http\Controllers\Annapurna\GoogleAuthController::enabled() || config('mail.default') !== 'log')
      <div class="or-sep"><span>atau</span></div>
      @endif
      @if (\App\Http\Controllers\Annapurna\GoogleAuthController::enabled())
      <a class="btn btn-light btn-block btn-google" id="googleBtn" href="{{ route('auth.google') }}"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Masuk dengan Google</a>
      @endif
      @if (config('mail.default') !== 'log')
      <button type="button" class="btn btn-light btn-block" id="otpBtn" style="margin-top:10px"><i class="fa-regular fa-envelope"></i> Masuk dengan kode lewat email</button>
      @endif
      {{-- Akun demo hanya tampil saat develop (APP_ENV=local). Di server online (production) tidak ditampilkan. --}}
      @if (app()->environment('local'))
      <div class="demo-acc">
        <strong>Akun demo</strong> — klik untuk mengisi otomatis
        <button type="button" data-demo="customer@annapurna.id|customer123"><span><i class="fa-regular fa-user"></i> Customer</span><code>customer@annapurna.id</code></button>
        <button type="button" data-demo="owner@annapurna.id|owner123"><span><i class="fa-solid fa-crown"></i> Owner · Pak Ikun</span><code>owner@annapurna.id</code></button>
        <button type="button" data-demo="dita@annapurna.id|dita123"><span><i class="fa-solid fa-user-shield"></i> Admin · Dita</span><code>dita@annapurna.id</code></button>
      </div>
      @endif
    </div>
  </div>
</div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/pages/masuk.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
