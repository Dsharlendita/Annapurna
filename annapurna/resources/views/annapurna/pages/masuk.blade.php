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
    <div class="auth-box">
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
      <div class="demo-acc">
        <strong>Akun demo</strong> — klik untuk mengisi otomatis
        <button type="button" data-demo="customer@annapurna.id|customer123"><span><i class="fa-regular fa-user"></i> Customer</span><code>customer@annapurna.id</code></button>
        <button type="button" data-demo="owner@annapurna.id|owner123"><span><i class="fa-solid fa-crown"></i> Owner · Pak Ikun</span><code>owner@annapurna.id</code></button>
        <button type="button" data-demo="dita@annapurna.id|dita123"><span><i class="fa-solid fa-user-shield"></i> Admin · Dita</span><code>dita@annapurna.id</code></button>
        <button type="button" data-demo="shely@annapurna.id|shely123"><span><i class="fa-solid fa-user-shield"></i> Admin · Shely</span><code>shely@annapurna.id</code></button>
        <button type="button" data-demo="aji@annapurna.id|aji123"><span><i class="fa-solid fa-user-shield"></i> Admin · Aji</span><code>aji@annapurna.id</code></button>
        <button type="button" data-demo="arvan@annapurna.id|arvan123"><span><i class="fa-solid fa-user-shield"></i> Admin · Arvan</span><code>arvan@annapurna.id</code></button>
      </div>
    </div>
  </div>
</div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/pages/masuk.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
