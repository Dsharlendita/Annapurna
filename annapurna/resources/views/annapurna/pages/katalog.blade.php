@extends('annapurna.layouts.app')

@section('title', 'Katalog Alat Outdoor')
@section('page', 'katalog')

@section('content')
<section class="page-hero">
  <div class="wrap">
    <div class="crumbs"><a href="{{ route('home') }}">Beranda</a><span>/</span><span id="crumbNow">Produk Rental</span></div>
    <h1 id="pageTitle">Katalog Alat Outdoor</h1>
    <p id="pageSub">Pilih alat yang kamu butuhkan, cek ketersediaan tanggalnya, lalu sewa atau beli langsung dari sini.</p>
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

      <div id="dateFilter">
        <h4>Cek tanggal sewa</h4>
        <div class="field" style="margin-bottom:8px"><label for="fStart">Tanggal ambil</label><input type="date" class="input" id="fStart"></div>
        <div class="field" style="margin-bottom:8px"><label for="fEnd">Tanggal kembali</label><input type="date" class="input" id="fEnd"></div>
        <label class="check"><input type="checkbox" id="fOnlyAvail"> Tampilkan yang tersedia saja</label>
        <button class="btn btn-ghost btn-sm" id="clearDates" style="margin-top:8px">Hapus tanggal</button>
      </div>

      <h4>Butuh satu set lengkap?</h4>
      <a class="btn btn-outline btn-sm btn-block" href="{{ route('paket') }}"><i class="fa-solid fa-box-open"></i> Lihat paket hemat</a>
    </aside>

    <div>
      <div class="toolbar">
        <div class="input-icon"><i class="fa-solid fa-magnifying-glass"></i><input class="input" id="q" placeholder="Cari nama alat…" aria-label="Cari nama alat"></div>
        <div class="right">
          <button class="btn btn-light btn-sm filter-open" id="openFilter"><i class="fa-solid fa-sliders"></i> Filter</button>
          <div class="seg" role="tablist" aria-label="Jenis transaksi">
            <button data-mode="rent" role="tab">Sewa</button>
            <button data-mode="buy" role="tab">Beli</button>
          </div>
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
  <script src="{{ asset('assets/js/pages/katalog.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
