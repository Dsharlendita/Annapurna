@extends('annapurna.layouts.admin')

@section('title', 'Promo & Kode Diskon')
@section('menu', 'owner-promo')
@section('owner_only', '1')

@section('content')
  <p class="page-sub">Buat kode diskon untuk sewa, belanja, atau keduanya. Promo yang ditandai "Tampil di beranda" muncul di halaman utama website.</p>
  <div class="stat-grid" id="stats"></div>
  <div class="filters" id="filters"></div>
  <div id="list"></div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/owner/promo.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
