@extends('annapurna.layouts.admin')

@section('title', 'Keuangan')
@section('menu', 'keuangan')

@section('content')
  <p class="page-sub">Pemasukan tercatat otomatis dari pembayaran rental, penjualan, dan denda; pendapatan lain dan pengeluaran toko dicatat manual. Transaksi tidak bisa dihapus — jika salah, edit atau tandai <strong>dibatalkan</strong>.</p>
  <div class="filters" id="range">
    <button class="btn btn-light btn-sm" data-r="today">Hari ini</button>
    <button class="btn btn-light btn-sm" data-r="week">7 hari</button>
    <button class="btn btn-primary btn-sm" data-r="month">Bulan ini</button>
    <button class="btn btn-light btn-sm" data-r="30">30 hari</button>
    <input class="input" type="date" id="from"> <span class="muted">s/d</span> <input class="input" type="date" id="to">
    <span style="flex:1"></span>
    <button class="btn btn-light btn-sm" id="addInc"><i class="fa-solid fa-plus"></i> Pemasukan lain</button>
    <button class="btn btn-primary btn-sm" id="addExp"><i class="fa-solid fa-plus"></i> Catat pengeluaran</button>
  </div>
  <div class="lini-bar">
    <div class="seg" id="lini" role="tablist" aria-label="Lini usaha">
      <button type="button" data-l="all" role="tab"><i class="fa-solid fa-layer-group"></i> Gabungan</button>
      <button type="button" data-l="rent" role="tab"><i class="fa-solid fa-campground"></i> Rental</button>
      <button type="button" data-l="sale" role="tab"><i class="fa-solid fa-bag-shopping"></i> Penjualan</button>
      <button type="button" data-l="umum" role="tab"><i class="fa-solid fa-store"></i> Umum</button>
    </div>
    <p class="muted lini-note" id="liniNote"></p>
  </div>
  <div class="stat-grid" id="quick"></div>
  <div class="sum-grid" id="sum"></div>
  <div class="grid-dash">
    <div class="panel"><div class="panel-h"><h3>Arus kas harian</h3></div><div class="chart-box"><canvas id="chart"></canvas></div></div>
    <div class="panel"><div class="panel-h"><h3>Komposisi</h3></div><h4 style="font-size:13px;margin:0 0 10px">Pemasukan</h4><ul class="bar-list" id="compIn"></ul><h4 style="font-size:13px;margin:16px 0 10px">Pengeluaran</h4><ul class="bar-list" id="compOut"></ul></div>
  </div>
  <div class="tabs" id="tabs">
    <button class="tab active" data-tab="in">Pemasukan <span class="cnt" id="cIn">0</span></button>
    <button class="tab" data-tab="out">Pengeluaran <span class="cnt" id="cOut">0</span></button>
  </div>
  <div class="table-wrap"><table class="table"><thead id="th"></thead><tbody id="rows"></tbody><tfoot id="tf"></tfoot></table></div>
  <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><span class="exp" id="exp"><button class="btn btn-light btn-sm" data-export="xlsx"><i class="fa-solid fa-file-excel" style="color:#1d6f42"></i> Excel</button><button class="btn btn-light btn-sm" data-export="pdf"><i class="fa-solid fa-file-pdf" style="color:#c0392b"></i> PDF</button></span></div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/vendor/chart.umd.js') }}"></script>
  <script src="{{ asset('assets/js/admin/keuangan.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
