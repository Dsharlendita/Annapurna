@extends('annapurna.layouts.app')

@section('title', 'Paket Sewa Hemat')
@section('page', 'paket')

@section('content')
<section class="page-hero">
  <div class="wrap">
    <div class="crumbs"><a href="{{ route('home') }}">Beranda</a><span>/</span><span>Paket</span></div>
    <h1>Paket sewa sekali ambil, langsung berangkat</h1>
    <p>Satu paket berisi semua alat inti untuk camping atau mendaki. Harganya lebih hemat dibanding sewa satuan.</p>
  </div>
</section>

<main class="section pk-main">
  <div class="wrap">
    <div class="pk-bar">
      <div class="input-icon pk-search"><i class="fa-solid fa-magnifying-glass"></i><input class="input" id="q" placeholder="Cari paket atau nama alat…" aria-label="Cari paket"></div>
      <div class="seg" id="typeSeg" role="tablist" aria-label="Jenis paket">
        <button class="active" data-type="">Semua</button>
        <button data-type="hiking">Hiking</button>
        <button data-type="camping">Camping</button>
        <button data-type="pelengkap">Pelengkap</button>
      </div>
      <select class="select pk-sort" id="sort" aria-label="Urutkan">
        <option value="rec">Rekomendasi</option>
        <option value="low">Harga terendah</option>
        <option value="high">Harga tertinggi</option>
        <option value="save">Paling hemat</option>
      </select>
    </div>
    <div class="pk-sub">
      <div class="chips" id="peopleChips" aria-label="Jumlah orang">
        <span class="pk-lbl"><i class="fa-solid fa-user-group"></i> Untuk</span>
        <button class="chip active" data-p="">Semua</button>
        <button class="chip" data-p="1">1 orang</button>
        <button class="chip" data-p="2">2 orang</button>
        <button class="chip" data-p="4">3–4 orang</button>
        <button class="chip" data-p="6">5+ orang</button>
      </div>
      <p class="pk-count" id="count"></p>
    </div>

    <div class="pk-list" id="pkList"></div>

    <div class="notice green" style="margin-top:28px">
      <i class="fa-solid fa-circle-info"></i>
      <div>Mau isi paket yang berbeda? Tambahkan alat satuan dari <a class="link" href="{{ route('katalog') }}">katalog</a> ke keranjang yang sama, atau <a class="link" id="waCustom" target="_blank" rel="noopener">minta paket khusus lewat WhatsApp</a>.</div>
    </div>
  </div>
</main>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/pages/paket.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
