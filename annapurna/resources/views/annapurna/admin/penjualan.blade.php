@extends('annapurna.layouts.admin')

@section('title', 'Penjualan')
@section('menu', 'penjualan')

@section('content')
  <p class="page-sub">Kelola pesanan pembelian alat outdoor: verifikasi pembayaran, kemas, siapkan untuk diambil di toko, hingga selesai.</p>
  <div class="stat-grid" id="stats"></div>
  <div class="tabs" id="tabs"></div>
  <div class="filters">
    <div class="input-icon"><i class="fa-solid fa-magnifying-glass"></i><input class="input" id="q" placeholder="Cari no. pesanan, customer, barang…"></div>
    <input class="input" type="date" id="from"> <span class="muted">s/d</span> <input class="input" type="date" id="to">
    <span class="exp" id="exp"><button class="btn btn-light btn-sm" data-export="xlsx"><i class="fa-solid fa-file-excel" style="color:#1d6f42"></i> Excel</button><button class="btn btn-light btn-sm" data-export="pdf"><i class="fa-solid fa-file-pdf" style="color:#c0392b"></i> PDF</button></span>
  </div>
  <div class="table-wrap"><table class="table wide">
    <thead><tr><th>No. Pesanan</th><th>Customer</th><th>Barang</th><th class="num">Total</th><th>Pembayaran</th><th>Status</th><th class="num">Aksi</th></tr></thead>
    <tbody id="rows"></tbody>
  </table></div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/admin/penjualan.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
