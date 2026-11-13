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
      @if (\App\Http\Controllers\Annapurna\GoogleAuthController::enabled())
      <a class="btn btn-light btn-block btn-google" id="googleBtn" href="{{ route('auth.google') }}"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Daftar dengan Google</a>
      <div class="or-sep"><span>atau isi formulir</span></div>
      @endif
      <form id="regForm" novalidate>
        <div class="field"><label for="name">Nama lengkap</label><input class="input" id="name" name="name" autocomplete="name" placeholder="Sesuai kartu identitas"></div>
        <div class="grid-2">
          <div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="email" placeholder="nama@email.com"></div>
          <div class="field"><label for="phone">No. WhatsApp</label><input class="input" id="phone" name="phone" inputmode="tel" autocomplete="tel" placeholder="08xxxxxxxxxx"></div>
        </div>
        <div class="field"><label for="password">Kata sandi</label><div class="input-icon"><i class="fa-solid fa-lock"></i><input class="input" id="password" name="password" type="password" autocomplete="new-password" placeholder="Minimal 6 karakter"><button type="button" class="toggle-pw" aria-label="Tampilkan kata sandi"><i class="fa-regular fa-eye"></i></button></div></div>
        <div class="field"><label for="password2">Ulangi kata sandi</label><input class="input" id="password2" name="password2" type="password" autocomplete="new-password"></div>
        <div class="field"><label class="check"><input type="checkbox" name="agree" id="agree"> <span>Saya setuju dengan <a class="link" href="{{ route('ketentuan') }}" target="_blank" rel="noopener noreferrer">ketentuan sewa</a> dan kebijakan pembatalan.</span></label></div>
        <button class="btn btn-primary btn-block" type="submit">Buat akun</button>
      </form>
    </div>
  </div>
</div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/pages/daftar.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
