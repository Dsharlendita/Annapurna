@extends('annapurna.layouts.admin')

@section('title', 'Dashboard')
@section('menu', 'owner-dashboard')
@section('owner_only', '1')

@section('content')
  <p class="page-sub" id="greet"></p>
  <div class="filters">
    <label for="period" class="muted" style="font-size:13.5px">Periode ringkasan</label>
    <input class="input" type="month" id="period">
    <span style="flex:1"></span>
    <a class="btn btn-light btn-sm" href="{{ route('owner.histori') }}"><i class="fa-solid fa-clock-rotate-left"></i> Histori sistem</a>
    <a class="btn btn-light btn-sm" href="{{ route('admin.laporan') }}"><i class="fa-solid fa-file-lines"></i> Laporan</a>
  </div>
  <h2 class="sec-lbl">Ringkasan keuangan</h2>
  <div class="fin-grid" id="fin"></div>
  <h2 class="sec-lbl">Transaksi</h2>
  <div class="stat-grid" id="tx"></div>
  <h2 class="sec-lbl">Stok barang</h2>
  <div class="stat-grid cols-3" id="stk"></div>
  <div class="grid-dash">
    <div class="panel">
      <div class="panel-h"><h3>Pemasukan &amp; pengeluaran 6 bulan</h3><a class="btn btn-light btn-xs" href="{{ route('admin.keuangan') }}">Detail keuangan <i class="fa-solid fa-arrow-right"></i></a></div>
      <div class="chart-box"><canvas id="chart" aria-label="Grafik pemasukan dan pengeluaran"></canvas></div>
    </div>
    <div class="panel">
      <div class="panel-h"><h3>Laporan bulanan otomatis</h3><a class="btn btn-light btn-xs" href="{{ route('owner.integrasi') }}">Kelola</a></div>
      <div id="rekap"></div>
    </div>
  </div>
  <h2 class="sec-lbl">Aktivitas staff</h2>
  <div class="grid-dash">
    <div class="panel">
      <div class="panel-h"><h3>Aktivitas terbaru</h3><a class="btn btn-light btn-xs" href="{{ route('owner.histori') }}">Semua histori <i class="fa-solid fa-arrow-right"></i></a></div>
      <div id="feed"></div>
    </div>
    <div class="panel">
      <div class="panel-h"><h3>Staff</h3><a class="btn btn-light btn-xs" href="{{ route('owner.staff') }}">Kelola staff</a></div>
      <div id="staff"></div>
    </div>
  </div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/vendor/chart.umd.js') }}"></script>
  <script src="{{ asset('assets/js/owner/dashboard.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
