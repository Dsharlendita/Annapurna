@extends('annapurna.layouts.admin')

@section('title', 'Data Pelanggan')
@section('menu', 'owner-pelanggan')
@section('owner_only', '1')

@section('content')
  <p class="page-sub">Riwayat, nilai transaksi, dan catatan setiap pelanggan. Tandai pelanggan yang perlu jaminan tambahan atau blokir pelanggan bermasalah.</p>
  <div class="stat-grid" id="stats"></div>
  <div class="filters" id="filters"></div>
  <div id="list"></div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/owner/pelanggan.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
