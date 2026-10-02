@extends('annapurna.layouts.admin')

@section('title', 'Ulasan & Testimoni')
@section('menu', 'ulasan')

@section('content')
  <p class="page-sub">Ulasan ditulis pelanggan setelah rental atau pembelian selesai. Pilih ulasan terbaik untuk tampil sebagai testimoni di beranda (maks. 6), balas ulasan, atau sembunyikan ulasan yang tidak pantas.</p>
  <div class="stat-grid" id="stats"></div>
  <div class="tabs" id="tabs"></div>
  <div class="filters">
    <div class="input-icon"><i class="fa-solid fa-magnifying-glass"></i><input class="input" id="q" placeholder="Cari nama, isi ulasan, no. transaksi…"></div>
    <select class="select" id="fRate"><option value="">Semua bintang</option><option value="5">★★★★★ 5</option><option value="4">★★★★ 4</option><option value="3">★★★ 3</option><option value="2">★★ 2</option><option value="1">★ 1</option></select>
    <span style="flex:1"></span>
    <a class="btn btn-light btn-sm" id="viewHome" href="#" target="_blank"><i class="fa-regular fa-eye"></i> Lihat di beranda</a>
  </div>
  <div id="list" class="rv-admin"></div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/admin/ulasan.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
