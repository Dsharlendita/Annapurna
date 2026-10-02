@extends('annapurna.layouts.admin')

@section('title', 'Perawatan Unit')
@section('menu', 'perawatan')

@section('content')
  <p class="page-sub">Semua unit yang belum bisa disewa karena perlu dicuci atau sedang diperbaiki, plus pengingat perawatan berkala. Selesaikan dari sini agar stok kembali tersedia.</p>
  <div class="care-explain" id="careExplain"></div>
  <div class="stat-grid cols-3" id="careStats"></div>
  <div id="careBody"></div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/admin/perawatan.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
