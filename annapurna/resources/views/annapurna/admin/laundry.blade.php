@extends('annapurna.layouts.admin')

@section('title', 'Laundry')
@section('menu', 'laundry')

@section('content')
  <p class="page-sub">Laundry perlengkapan outdoor milik customer. Customer mengantar &amp; mengambil barang sendiri di toko (tidak ada antar jemput). Pesanan diinput di <a class="link" href="{{ route('admin.kasir') }}?mode=laundry">Kasir</a> saat barang diterima. Pembayaran masuk Keuangan lini <b>Rental</b>.</p>
  <div class="seg biz-view" id="ldView" role="tablist" aria-label="Tampilan" style="margin-bottom:16px"><button type="button" data-v="orders" class="active" role="tab"><i class="fa-solid fa-list"></i> Pesanan laundry</button><button type="button" data-v="prices" role="tab"><i class="fa-solid fa-tags"></i> Daftar harga</button></div>
  <div id="vOrders">
    <div class="stat-grid stat-5" id="stats"></div>
    <div class="tabs" id="tabs"></div>
    <div class="filters">
      <div class="input-icon"><i class="fa-solid fa-magnifying-glass"></i><input class="input" id="q" placeholder="Cari no. nota, customer, barang…"></div>
      <input class="input" type="date" id="from"> <span class="muted">s/d</span> <input class="input" type="date" id="to">
      <a class="btn btn-primary btn-sm" href="{{ route('admin.kasir') }}?mode=laundry"><i class="fa-solid fa-plus"></i> Input laundry</a>
      <span class="exp" id="exp"><button class="btn btn-light btn-sm" data-export="xlsx"><i class="fa-solid fa-file-excel" style="color:#1d6f42"></i> Excel</button><button class="btn btn-light btn-sm" data-export="pdf"><i class="fa-solid fa-file-pdf" style="color:#c0392b"></i> PDF</button></span>
    </div>
    <div class="table-wrap"><table class="table wide">
      <thead><tr><th>No. Nota</th><th>Customer</th><th>Barang</th><th>Terima · Estimasi</th><th class="num">Total</th><th>Pembayaran</th><th>Status</th><th class="num">Aksi</th></tr></thead>
      <tbody id="rows"></tbody>
    </table></div>
  </div>
  <div id="vPrices" hidden></div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/admin/laundry.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
