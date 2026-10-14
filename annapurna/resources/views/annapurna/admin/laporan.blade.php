@extends('annapurna.layouts.admin')

@section('title', 'Laporan')
@section('menu', 'laporan')
@section('owner_only', '1')

@section('content')
  <p class="page-sub no-print">Pilih jenis laporan dan periode, lalu cetak atau ekspor ke Excel / PDF.</p>
  <div class="panel rep-panel">
    {{-- Bilah filter laporan: jenis · periode (dengan pintasan) · urutan · ekspor --}}
    <div class="rep-bar no-print">
      <div class="rep-f"><label for="type">Jenis laporan</label><select class="select" id="type"></select></div>
      <div class="rep-f"><label for="from">Periode</label><div class="rep-range"><input class="input" type="date" id="from" aria-label="Dari tanggal"><span>–</span><input class="input" type="date" id="to" aria-label="Sampai tanggal"></div></div>
      <div class="rep-f"><label for="order">Urutan</label><select class="select" id="order" aria-label="Urutan baris"><option value="desc">Terbaru di atas</option><option value="asc">Terlama di atas</option></select></div>
      <div class="rep-act"><span class="exp" id="exp"><button class="btn btn-light btn-sm" data-export="xlsx"><i class="fa-solid fa-file-excel" style="color:#1d6f42"></i> Excel</button><button class="btn btn-light btn-sm" data-export="pdf"><i class="fa-solid fa-file-pdf" style="color:#c0392b"></i> PDF</button></span>
        <button class="btn btn-primary btn-sm" onclick="window.print()"><i class="fa-solid fa-print"></i> Cetak</button></div>
    </div>
    <div class="rep-quick no-print" id="quick" aria-label="Pintasan periode"></div>
    <div class="report-head"><img src="{{ asset('assets/img/logo.png') }}" alt=""><div style="text-align:right"><strong id="rhTitle"></strong><br><span id="rhRange"></span></div></div>
    <div class="rep-title"><h3 id="title"></h3><span class="rep-period" id="rangeShort"></span></div>
    <p class="rep-note" id="range"></p>
    <div class="rep-sum" id="sum"></div>
    <div class="table-wrap" id="mainTbl"><table class="table"><thead id="th"></thead><tbody id="rows"></tbody><tfoot id="tf"></tfoot></table></div>
    <div id="secs"></div>
  </div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/admin/laporan.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
