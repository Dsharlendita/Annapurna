@extends('annapurna.layouts.admin')

@section('title', 'Histori Sistem')
@section('menu', 'owner-histori')
@section('owner_only', '1')

@section('content')
  <p class="page-sub">Semua aktivitas staff direkam otomatis oleh sistem: siapa melakukan apa, kapan, dan data apa yang berubah.</p>
  <div id="integrity"></div>
  <div class="tabs" id="tabs"></div>
  <div class="filters">
    <div class="input-icon"><i class="fa-solid fa-magnifying-glass"></i><input class="input" id="q" placeholder="Cari aktivitas, no. transaksi, barang…"></div>
    <select class="select" id="fStaff" aria-label="Staff"></select>
    <select class="select" id="fType" aria-label="Jenis aktivitas"></select>
    <select class="select" id="fRange" aria-label="Periode">
      <option value="all">Semua tanggal</option>
      <option value="today">Hari ini</option>
      <option value="week">Minggu ini</option>
      <option value="month">Bulan ini</option>
      <option value="custom">Pilih tanggal…</option>
    </select>
    <span id="custom" hidden><input class="input" type="date" id="from"> <span class="muted">s/d</span> <input class="input" type="date" id="to"></span>
    <span style="flex:1"></span>
    <span class="exp" id="exp"><button class="btn btn-light btn-sm" data-export="xlsx"><i class="fa-solid fa-file-excel" style="color:#1d6f42"></i> Excel</button><button class="btn btn-light btn-sm" data-export="pdf"><i class="fa-solid fa-file-pdf" style="color:#c0392b"></i> PDF</button></span>
  </div>
  <p class="muted" id="count" style="font-size:13px;margin:-4px 0 10px"></p>
  <div class="table-wrap"><table class="table wide audit-tbl">
    <thead><tr><th>Waktu</th><th>Staff</th><th>Jenis</th><th>Aktivitas</th><th>Perubahan data</th><th class="num"></th></tr></thead>
    <tbody id="rows"></tbody>
  </table></div>
  <div id="more" style="text-align:center;margin-top:14px"></div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/owner/histori.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
