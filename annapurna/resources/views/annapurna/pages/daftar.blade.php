@extends('annapurna.layouts.auth')

@section('title', 'Daftar')
@section('page', 'auth')

@section('content')
<div class="auth">
  <div class="auth-art">
    <a class="brandw" href="{{ route('home') }}"><img src="{{ asset('assets/img/logo-white.png') }}" alt="Annapurna Adventure"></a>
    <div class="art-txt"><h2>Satu akun untuk<br>sewa dan belanja</h2><p>Simpan data diri sekali, lalu booking alat kapan pun hanya dengan beberapa klik.</p></div>
  </div>
  <div class="auth-form">
    <div class="auth-box">
      <a class="back" href="{{ route('home') }}"><i class="fa-solid fa-arrow-left"></i> Kembali ke beranda</a>
      <h1>Daftar akun</h1>
      <p>Sudah punya akun? <a class="link" id="toLogin" href="{{ route('masuk') }}">Masuk</a></p>
      <form id="regForm" novalidate>
        <div class="field"><label for="name">Nama lengkap</label><input class="input" id="name" name="name" autocomplete="name" placeholder="Sesuai kartu identitas"></div>
        <div class="grid-2">
          <div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="email" placeholder="nama@email.com"></div>
          <div class="field"><label for="phone">No. WhatsApp</label><input class="input" id="phone" name="phone" inputmode="tel" autocomplete="tel" placeholder="08xxxxxxxxxx"></div>
        </div>
        <div class="field"><label for="password">Kata sandi</label><div class="input-icon"><i class="fa-solid fa-lock"></i><input class="input" id="password" name="password" type="password" autocomplete="new-password" placeholder="Minimal 6 karakter"><button type="button" class="toggle-pw" aria-label="Tampilkan kata sandi"><i class="fa-regular fa-eye"></i></button></div></div>
        <div class="field"><label for="password2">Ulangi kata sandi</label><input class="input" id="password2" name="password2" type="password" autocomplete="new-password"></div>
        <div class="field"><label class="check"><input type="checkbox" name="agree" id="agree"> <span>Saya setuju dengan <a class="link" href="{{ route('tentang') }}#ketentuan" target="_blank" rel="noopener noreferrer">ketentuan sewa</a> dan kebijakan pembatalan.</span></label></div>
        <button class="btn btn-primary btn-block" type="submit">Buat akun</button>
      </form>
    </div>
  </div>
</div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/pages/daftar.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
