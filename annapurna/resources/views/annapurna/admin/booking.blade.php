@extends('annapurna.layouts.admin')

@section('title', 'Booking Rental')
@section('menu', 'booking')

@section('content')
  <p class="page-sub">Konfirmasi booking masuk, verifikasi DP, catat barang keluar, dan pantau status setiap rental.</p>
  <div class="tabs" id="tabs"></div>
  <div class="filters">
    <div class="input-icon"><i class="fa-solid fa-magnifying-glass"></i><input class="input" id="q" placeholder="Cari no. booking, customer, barang…"></div>
    <label class="muted" style="font-size:13px">Tanggal ambil</label>
    <input class="input" type="date" id="from"> <span class="muted">s/d</span> <input class="input" type="date" id="to">
    <button class="btn btn-light btn-sm" id="reset"><i class="fa-solid fa-rotate"></i> Reset</button>
    <span class="exp" id="exp"><button class="btn btn-light btn-sm" data-export="xlsx"><i class="fa-solid fa-file-excel" style="color:#1d6f42"></i> Excel</button><button class="btn btn-light btn-sm" data-export="pdf"><i class="fa-solid fa-file-pdf" style="color:#c0392b"></i> PDF</button></span>
  </div>
  <div class="table-wrap"><table class="table wide">
    <thead><tr><th>No. Booking</th><th>Customer</th><th>Barang</th><th>Tanggal sewa</th><th class="num">Total</th><th class="num">DP</th><th class="num">Sisa</th><th>Status</th><th class="num">Aksi</th></tr></thead>
    <tbody id="rows"></tbody>
  </table></div>
  <p class="muted" style="font-size:12.5px;margin-top:10px" id="count"></p>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/admin/booking.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
