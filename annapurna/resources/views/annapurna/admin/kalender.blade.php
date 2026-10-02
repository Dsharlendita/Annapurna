@extends('annapurna.layouts.admin')

@section('title', 'Kalender Ketersediaan')
@section('menu', 'kalender')

@section('content')
  <p class="page-sub">Lihat cepat stok setiap barang per tanggal untuk menjawab pertanyaan customer. Klik sel untuk melihat siapa yang menyewa.</p>
  <div class="filters">
    <div class="input-icon"><i class="fa-solid fa-magnifying-glass"></i><input class="input" id="q" placeholder="Cari barang…"></div>
    <select class="select" id="fCat"><option value="">Semua kategori</option></select>
    <button class="btn btn-light btn-sm" id="prev"><i class="fa-solid fa-chevron-left"></i></button>
    <input class="input" type="date" id="from">
    <button class="btn btn-light btn-sm" id="next"><i class="fa-solid fa-chevron-right"></i></button>
    <button class="btn btn-light btn-sm" id="today">Hari ini</button>
    <span style="flex:1"></span>
    <span class="cal-legend"><i class="ok"></i> Longgar <i class="mid"></i> Menipis <i class="full"></i> Penuh</span>
  </div>
  <div class="table-wrap cal-wrap"><table class="cal-tbl" id="cal"></table></div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/admin/kalender.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
