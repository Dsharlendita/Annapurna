@extends('annapurna.layouts.admin')

@section('title', 'Data Barang')
@section('menu', 'barang')

@section('content')
  <p class="page-sub">Kelola barang sewa & barang jual (dua stok terpisah): harga, stok, foto, dan kategori. Data tidak dihapus — barang yang sudah tidak dipakai cukup dinonaktifkan agar riwayatnya tetap tersimpan.</p>
  <div class="tabs" id="tabs">
    <button class="tab active" data-tab="sewa"><i class="fa-solid fa-campground"></i> Barang Sewa <span class="cnt" id="cS">0</span></button>
    <button class="tab" data-tab="jual"><i class="fa-solid fa-bag-shopping"></i> Barang Jual <span class="cnt" id="cJ">0</span></button>
    <button class="tab" data-tab="kategori">Kategori <span class="cnt" id="cK">0</span></button>
  </div>
  <section id="pBarang">
    <div class="quick-f" id="quickF"></div>
    <div class="filters">
      <div class="input-icon"><i class="fa-solid fa-magnifying-glass"></i><input class="input" id="q" placeholder="Cari nama barang…"></div>
      <select class="select" id="fCat"><option value="">Semua kategori</option></select>
      <select class="select" id="fType"></select>
      <select class="select" id="fStatus"><option value="">Semua status</option><option value="aktif">Aktif</option><option value="nonaktif">Tidak aktif</option></select>
      <span class="sp" style="flex:1"></span>
      <span class="exp" id="exp"><button class="btn btn-light btn-sm" data-export="xlsx"><i class="fa-solid fa-file-excel" style="color:#1d6f42"></i> Excel</button><button class="btn btn-light btn-sm" data-export="pdf"><i class="fa-solid fa-file-pdf" style="color:#c0392b"></i> PDF</button></span>
      <button class="btn btn-primary btn-sm" id="add"><i class="fa-solid fa-plus"></i> Tambah barang</button>
    </div>
    <div class="table-wrap"><table class="table wide">
      <thead id="th"></thead>
      <tbody id="rows"></tbody>
    </table></div>
  </section>
  <section id="pKategori" hidden>
    <div class="panel" style="max-width:720px">
      <div class="panel-h"><h3>Kategori barang</h3><button class="btn btn-light btn-sm" id="addCat"><i class="fa-solid fa-sliders"></i> Kelola di Konfigurasi</button></div>
      <div id="cats"></div>
    </div>
  </section>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/admin/barang.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
