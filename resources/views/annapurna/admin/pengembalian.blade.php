@extends('annapurna.layouts.admin')

@section('title', 'Barang Keluar & Kembali')
@section('menu', 'pengembalian')

@section('content')
  <p class="page-sub">Catat barang yang diambil customer dan proses pengembalian — keterlambatan dan denda dihitung otomatis, stok langsung tersedia lagi.</p>
  <div class="stat-grid" id="stats"></div>
  <div id="dueBanner"></div>
  <div class="grid-dash" style="grid-template-columns:1fr 1fr">
    <div class="panel">
      <div class="panel-h"><h3><i class="fa-solid fa-box-open" style="color:var(--g600)"></i> Siap diambil</h3><span class="muted" style="font-size:12.5px">Booking dikonfirmasi</span></div>
      <div id="toOut"></div>
    </div>
    <div class="panel">
      <div class="panel-h"><h3><i class="fa-solid fa-rotate-left" style="color:var(--g600)"></i> Sedang disewa</h3><span class="muted" style="font-size:12.5px">Urut jadwal kembali</span></div>
      <div id="toRet"></div>
    </div>
  </div>
  <div class="panel">
    <div class="panel-h"><h3>Log barang keluar & masuk</h3>
      <div class="filters" style="margin:0">
        <select class="select" id="kind"><option value="">Semua</option><option value="keluar">Barang keluar</option><option value="kembali">Barang kembali</option></select>
        <input class="input" type="date" id="from"><input class="input" type="date" id="to">
        <span class="exp" id="exp"><button class="btn btn-light btn-sm" data-export="xlsx"><i class="fa-solid fa-file-excel" style="color:#1d6f42"></i> Excel</button><button class="btn btn-light btn-sm" data-export="pdf"><i class="fa-solid fa-file-pdf" style="color:#c0392b"></i> PDF</button></span>
      </div>
    </div>
    <div class="table-wrap"><table class="table wide">
      <thead><tr><th>Tanggal</th><th>Jenis</th><th>No. Booking</th><th>Customer</th><th>Barang</th><th class="num">Jml</th><th>Kondisi</th><th class="num">Denda</th><th>Petugas</th></tr></thead>
      <tbody id="log"></tbody>
    </table></div>
  </div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/admin/pengembalian.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
