@extends('annapurna.layouts.app')

@section('title', 'Kontak')
@section('page', 'kontak')

@section('content')
<section class="page-hero">
  <div class="wrap">
    <div class="crumbs"><a href="{{ route('home') }}">Beranda</a><span>/</span><span>Kontak</span></div>
    <h1>Ada yang mau ditanyakan?</h1>
    <p>Tanya stok, minta paket khusus, atau konsultasi alat untuk pendakianmu. Kami balas secepatnya di jam operasional.</p>
  </div>
</section>

<main class="section">
  <div class="wrap contact-grid">
    <div class="card" id="lokasi">
      <div class="card-title"><i class="fa-solid fa-store"></i> Toko Annapurna Adventure</div>
      <div id="cInfo"></div>
      <div class="map">
        <iframe id="mapFrame" title="Peta lokasi toko" style="border:0;width:100%;height:100%" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
      </div>
      <a class="btn btn-light btn-sm" id="mapLink" target="_blank" rel="noopener" style="margin-top:12px"><i class="fa-solid fa-diamond-turn-right"></i> Buka di Google Maps</a>
    </div>
    <div class="card" style="margin-top:0">
      <div class="card-title"><i class="fa-regular fa-paper-plane"></i> Kirim pesan</div>
      <form id="cForm" novalidate>
        <div class="grid-2">
          <div class="field"><label for="cName">Nama</label><input class="input" id="cName" name="name" autocomplete="name"></div>
          <div class="field"><label for="cPhone">No. WhatsApp</label><input class="input" id="cPhone" name="phone" inputmode="tel" placeholder="08xxxxxxxxxx"></div>
        </div>
        <div class="field"><label for="cTopic">Keperluan</label>
          <select class="select" id="cTopic" name="topic"><option>Tanya ketersediaan alat</option><option>Paket sewa khusus</option><option>Pembelian alat</option><option>Kerja sama / komunitas</option><option>Lainnya</option></select></div>
        <div class="field"><label for="cMsg">Pesan</label><textarea class="textarea" id="cMsg" name="msg" placeholder="Contoh: Mau sewa tenda 4P untuk 3–5 Oktober, masih ada?"></textarea></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-primary" type="submit"><i class="fa-brands fa-whatsapp"></i> Kirim lewat WhatsApp</button>
          <button class="btn btn-light" type="button" id="cEmail"><i class="fa-solid fa-envelope"></i> Kirim lewat email</button>
        </div>
      </form>
    </div>
  </div>
</main>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/pages/kontak.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
