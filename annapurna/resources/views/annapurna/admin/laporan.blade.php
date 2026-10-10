@extends('annapurna.layouts.admin')

@section('title', 'Laporan')
@section('menu', 'laporan')
@section('owner_only', '1')

@section('content')
  <p class="page-sub no-print">Pilih jenis laporan dan periode, lalu cetak atau ekspor ke Excel / PDF.</p>
  <div class="panel">
    <div class="filters">
      <select class="select" id="type"></select>
      <input class="input" type="date" id="from"> <span class="muted">s/d</span> <input class="input" type="date" id="to">
      <select class="select" id="order" aria-label="Urutan baris"><option value="desc">Terbaru di atas</option><option value="asc">Terlama di atas</option></select>
      <span style="flex:1"></span>
      <span class="exp" id="exp"><button class="btn btn-light btn-sm" data-export="xlsx"><i class="fa-solid fa-file-excel" style="color:#1d6f42"></i> Excel</button><button class="btn btn-light btn-sm" data-export="pdf"><i class="fa-solid fa-file-pdf" style="color:#c0392b"></i> PDF</button></span>
      <button class="btn btn-primary btn-sm" onclick="window.print()"><i class="fa-solid fa-print"></i> Cetak</button>
    </div>
    <div class="report-head"><img src="{{ asset('assets/img/logo.png') }}" alt=""><div style="text-align:right"><strong id="rhTitle"></strong><br><span id="rhRange"></span></div></div>
    <h3 id="title" style="font-size:18px;margin-bottom:4px"></h3>
    <p class="muted" id="range" style="font-size:13px;margin-bottom:14px"></p>
    <div class="sum-grid" id="sum"></div>
    <div class="table-wrap"><table class="table"><thead id="th"></thead><tbody id="rows"></tbody><tfoot id="tf"></tfoot></table></div>
  </div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/admin/laporan.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
