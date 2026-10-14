@extends('annapurna.layouts.admin')

@section('title', 'Dashboard')
@section('menu', 'owner-dashboard')
@section('owner_only', '1')

@section('content')
  <p class="page-sub" id="greet"></p>
  {{-- Bilah kontrol: lini usaha (kiri) · periode & pintasan (kanan) --}}
  <div class="od-bar">
    <div class="seg biz-view" id="bizView" role="tablist" aria-label="Tampilan data"><button type="button" data-v="all" class="active" role="tab"><i class="fa-solid fa-layer-group"></i> Gabungan</button><button type="button" data-v="rent" role="tab"><i class="fa-solid fa-campground"></i> Rental</button><button type="button" data-v="sale" role="tab"><i class="fa-solid fa-bag-shopping"></i> Penjualan</button></div>
    <div class="od-tools">
      <label class="od-period"><i class="fa-regular fa-calendar"></i><input class="input" type="month" id="period" aria-label="Periode ringkasan"></label>
      <a class="btn btn-light btn-sm" href="{{ route('admin.laporan') }}"><i class="fa-solid fa-file-lines"></i> Laporan</a>
      <a class="btn btn-light btn-sm" href="{{ route('owner.histori') }}"><i class="fa-solid fa-clock-rotate-left"></i> Histori</a>
    </div>
  </div>
  {{-- Ringkasan keuangan: kartu Laba besar di kiri, Pemasukan & Pengeluaran di kanan --}}
  <div class="od-fin" id="fin"></div>
  <p class="muted biz-note" id="bizNote"></p>
  <div id="profitTbl"></div>
  {{-- Sekilas operasional: transaksi & stok dalam satu panel ringkas --}}
  <div class="panel od-ops">
    <div class="od-ops-col"><h3 class="od-h"><i class="fa-solid fa-receipt"></i> Transaksi</h3><div class="mini-grid" id="tx"></div></div>
    <div class="od-ops-col"><h3 class="od-h" id="stkLbl"><i class="fa-solid fa-boxes-stacked"></i> Stok barang</h3><div class="mini-grid" id="stk"></div></div>
  </div>
  <div class="grid-dash">
    <div class="panel">
      <div class="panel-h"><h3 id="chartTitle">Pemasukan &amp; pengeluaran 6 bulan</h3><a class="btn btn-light btn-xs" href="{{ route('admin.keuangan') }}">Detail keuangan <i class="fa-solid fa-arrow-right"></i></a></div>
      <div class="chart-box"><canvas id="chart" aria-label="Grafik pemasukan dan pengeluaran"></canvas></div>
    </div>
    <div class="panel">
      <div class="panel-h"><h3>Laporan bulanan otomatis</h3><a class="btn btn-light btn-xs" href="{{ route('owner.integrasi') }}">Kelola</a></div>
      <div id="rekap"></div>
    </div>
  </div>
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
