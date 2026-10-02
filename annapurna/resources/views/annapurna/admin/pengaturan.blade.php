@extends('annapurna.layouts.admin')

@section('title', 'Pengaturan')
@section('menu', 'pengaturan')

@section('content')
  <p class="page-sub">Atur profil toko dan rekening pembayaran. Aturan DP, pembatalan, denda, kategori, atribut barang, dan SOP diatur di <a class="link" href="{{ route('owner.konfigurasi') }}">Konfigurasi Sistem</a>.</p>
  <div class="tabs" id="tabs">
    <button class="tab active" data-tab="profil">Profil Toko</button>
    <button class="tab" data-tab="bayar">Rekening Pembayaran</button>
    <button class="tab" data-tab="akun">Akun & Sistem</button>
  </div>
  <form id="sf" novalidate>
    <section class="panel" data-pane="profil" style="max-width:820px">
      <div class="grid-2">
        <div class="field"><label>Nama toko</label><input class="input" name="storeName"></div>
        <div class="field"><label>Jam operasional</label><input class="input" name="hours"></div>
        <div class="field"><label>Telepon (tampilan)</label><input class="input" name="phone"></div>
        <div class="field"><label>Nomor WhatsApp (format 62…)</label><input class="input" name="whatsapp" inputmode="numeric"></div>
        <div class="field"><label>Email</label><input class="input" name="email" type="email"></div>
        <div class="field"><label>Instagram</label><input class="input" name="instagram"></div>
      </div>
      <div class="field"><label>Alamat toko</label><textarea class="textarea" name="address" rows="2"></textarea></div>
    </section>
    <section class="panel" data-pane="bayar" hidden style="max-width:820px">
      <h4 style="font-size:14px;margin:6px 0 10px">Rekening pembayaran</h4>
      <div id="banks"></div>
      <button type="button" class="btn btn-light btn-sm" id="addBank"><i class="fa-solid fa-plus"></i> Tambah rekening</button>
    </section>
    <div class="no-print" id="saveBar" style="margin-top:16px;display:flex;gap:8px">
      <button class="btn btn-primary" type="submit"><i class="fa-solid fa-floppy-disk"></i> Simpan pengaturan</button>
      <button class="btn btn-light" type="button" id="revert">Batalkan perubahan</button>
    </div>
  </form>
  <section data-pane="akun" hidden>
    <div class="grid-dash" style="grid-template-columns:1fr 1fr">
      <div class="panel">
        <div class="panel-h"><h3 id="akunHead">Profil owner</h3></div>
        <form id="af" novalidate>
          <div class="field"><label>Nama</label><input class="input" name="aname"></div>
          <div class="field"><label>Nomor HP</label><input class="input" name="aphone"></div>
          <button class="btn btn-primary btn-sm" type="submit">Simpan profil</button>
        </form>
        <hr style="border:0;border-top:1px solid var(--line);margin:18px 0">
        <form id="pf" novalidate>
          <div class="field"><label>Kata sandi lama</label><input class="input" type="password" name="old"></div>
          <div class="field"><label>Kata sandi baru</label><input class="input" type="password" name="npw"></div>
          <button class="btn btn-light btn-sm" type="submit"><i class="fa-solid fa-key"></i> Ganti kata sandi</button>
        </form>
      </div>
      <div class="panel" id="demoPanel">
        <div class="panel-h"><h3>Data demo</h3></div>
        <p style="font-size:14px;color:var(--ink-2)">Frontend ini menyimpan data di <em>localStorage</em> browser agar semua fitur bisa dicoba tanpa server. Setel ulang untuk mengembalikan data contoh (booking, penjualan, barang, pengaturan).</p>
        <div class="notice red" style="margin:14px 0"><i class="fa-solid fa-triangle-exclamation"></i><div>Semua perubahan yang sudah dibuat akan hilang.</div></div>
        <button class="btn btn-danger" id="reset"><i class="fa-solid fa-rotate"></i> Setel ulang data demo</button>
      </div>
    </div>
  </section>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/admin/pengaturan.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
