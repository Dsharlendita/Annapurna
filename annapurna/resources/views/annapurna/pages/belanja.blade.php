@extends('annapurna.layouts.app')

@section('title', 'Belanja Alat Outdoor')
@section('page', 'belanja')

@section('content')
<section class="page-hero shop-hero">
  <div class="wrap">
    <div class="crumbs"><a href="{{ route('home') }}">Beranda</a><span>/</span><span id="crumbNow">Belanja Alat</span></div>
    <h1 id="pageTitle">Belanja Alat Outdoor</h1>
    <p id="pageSub">Perlengkapan outdoor baru siap kamu miliki — tenda, carrier, sepatu, jaket, hingga alat masak. Bayar penuh, ambil di toko.</p>
  </div>
</section>

<main class="section">
  <div class="wrap catalog">
    <aside class="filter-panel" id="filterPanel" aria-label="Filter produk">
      <div style="display:flex;justify-content:space-between;align-items:center" class="filter-close-row">
        <h4 style="margin:0">Kategori</h4>
        <button class="icon-btn filter-open" id="closeFilter" aria-label="Tutup filter"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="filter-list" id="catList" style="margin-top:10px"></div>

      <div id="brandBox" hidden>
        <h4>Merek</h4>
        <div class="brand-list" id="brandList"></div>
      </div>

      <div id="dateFilter">
        <h4>Ketersediaan</h4>
        <label class="check"><input type="checkbox" id="fOnlyAvail"> Tampilkan yang tersedia di tanggalku saja</label>
      </div>

      <h4>Butuh satu set lengkap?</h4>
      <a class="btn btn-outline btn-sm btn-block" href="{{ route('paket') }}"><i class="fa-solid fa-box-open"></i> Lihat paket hemat</a>
    </aside>

    <div>
      <div id="tripBar"></div>
      <div class="toolbar">
        <div class="input-icon"><i class="fa-solid fa-magnifying-glass"></i><input class="input" id="q" placeholder="Cari nama alat…" aria-label="Cari nama alat"></div>
        <div class="right">
          <button class="btn btn-light btn-sm filter-open" id="openFilter"><i class="fa-solid fa-sliders"></i> Filter</button>
          <nav class="seg mode-links" aria-label="Pindah halaman">
            <a href="{{ route('katalog') }}" data-mode="rent"><i class="fa-solid fa-campground"></i> Sewa</a>
            <a href="{{ route('belanja') }}" data-mode="buy"><i class="fa-solid fa-bag-shopping"></i> Beli</a>
          </nav>
          <select class="select" id="sort" style="width:auto;padding:9px 38px 9px 14px;font-size:13.5px;background-position:right 14px center" aria-label="Urutkan">
            <option value="pop">Paling populer</option>
            <option value="low">Harga terendah</option>
            <option value="high">Harga tertinggi</option>
            <option value="rate">Rating tertinggi</option>
          </select>
        </div>
      </div>
      <p class="muted" id="resultInfo" style="font-size:13.5px;margin-bottom:14px"></p>
      <div class="prod-grid cols-4" id="grid"></div>
    </div>
  </div>
</main>
<div class="side-bg" id="filterBg"></div>
@endsection

@push('scripts')
  <script>window.CATALOG_MODE = 'buy';</script>
  <script src="{{ asset('assets/js/pages/katalog.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
