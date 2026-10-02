@extends('annapurna.layouts.app')

@section('title', 'Profil Saya')
@section('page', 'profil')

@section('head')
  <style>
    .prof-head { display: flex; gap: 16px; align-items: center; margin-bottom: 18px; flex-wrap: wrap; }
    .prof-head .av { width: 64px; height: 64px; border-radius: 50%; background: var(--g700); color: #fff; display: grid; place-items: center; font-size: 24px; font-weight: 800; }
    .prof-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px; }
    .prof-stats .card { padding: 16px; text-align: center; margin: 0 !important; }
    .prof-stats strong { display: block; font-size: 22px; color: var(--g800); }
    .prof-stats small { color: var(--muted); }
    .notif-item { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line); }
    .notif-item:last-child { border-bottom: 0; }
    .notif-item .ic { width: 36px; height: 36px; border-radius: 10px; background: var(--g100); color: var(--g700); display: grid; place-items: center; flex: none; }
    .notif-item.unread strong::after { content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--orange); margin-left: 8px; vertical-align: middle; }
    @media (max-width: 520px) { .prof-stats { grid-template-columns: 1fr 1fr 1fr; gap: 8px; } .prof-stats strong { font-size: 18px; } }
  </style>
@endsection

@section('content')
<main class="section" style="padding-top:32px">
  <div class="wrap" style="max-width:900px">
    <div class="prof-head">
      <div class="av" id="av">D</div>
      <div style="flex:1"><h1 class="sec-title" id="pName" style="margin:0">Profil</h1><p class="muted" id="pEmail"></p></div>
      <button class="btn btn-danger btn-sm" id="logout"><i class="fa-solid fa-right-from-bracket"></i> Keluar</button>
    </div>
    <div class="prof-stats">
      <a class="card" href="{{ route('pesanan') }}?tab=sewa"><strong id="sRent">0</strong><small>Rental aktif</small></a>
      <a class="card" href="{{ route('pesanan') }}?tab=beli"><strong id="sBuy">0</strong><small>Pembelian</small></a>
      <a class="card" href="{{ route('pesanan') }}?tab=riwayat"><strong id="sHist">0</strong><small>Riwayat transaksi</small></a>
    </div>
    <div class="tabs" id="tabs">
      <button class="tab active" data-tab="data">Data Diri & Alamat</button>
      <button class="tab" data-tab="pw">Ganti Kata Sandi</button>
      <button class="tab" data-tab="notif">Notifikasi <span class="cnt" id="nCnt">0</span></button>
    </div>

    <section data-pane="data" class="card">
      <form id="fData" novalidate>
        <div class="grid-2">
          <div class="field"><label for="name">Nama lengkap</label><input class="input" id="name" name="fullname"></div>
          <div class="field"><label for="phone">Nomor WhatsApp</label><input class="input" id="phone" name="phone" inputmode="tel"></div>
        </div>
        <div class="field"><label>Email</label><input class="input" id="email" disabled><span class="hint">Email digunakan untuk masuk dan tidak dapat diubah.</span></div>
        <div class="field"><label for="address">Alamat lengkap</label><textarea class="textarea" id="address" name="address" rows="3" placeholder="Nama jalan, nomor rumah, kelurahan, kecamatan"></textarea><span class="hint">Dipakai otomatis saat memilih pengiriman barang.</span></div>
        <button class="btn btn-primary" type="submit"><i class="fa-solid fa-floppy-disk"></i> Simpan perubahan</button>
      </form>
    </section>

    <section data-pane="pw" class="card" hidden>
      <form id="fPw" novalidate style="max-width:440px">
        <div class="field"><label for="old">Kata sandi lama</label><input class="input" type="password" id="old" name="old"></div>
        <div class="field"><label for="npw">Kata sandi baru</label><input class="input" type="password" id="npw" name="npw"><span class="hint">Minimal 6 karakter.</span></div>
        <div class="field"><label for="cpw">Ulangi kata sandi baru</label><input class="input" type="password" id="cpw" name="cpw"></div>
        <button class="btn btn-primary" type="submit"><i class="fa-solid fa-key"></i> Ganti kata sandi</button>
      </form>
    </section>

    <section data-pane="notif" class="card" hidden>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:10px;flex-wrap:wrap">
        <h3 class="card-title" style="margin:0"><i class="fa-regular fa-bell"></i> Notifikasi</h3>
        <button class="btn btn-light btn-sm" id="readAllP"><i class="fa-solid fa-check-double"></i> Tandai semua dibaca</button>
      </div>
      <div id="nList"></div>
    </section>
  </div>
</main>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/pages/profil.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
