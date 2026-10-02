@extends('annapurna.layouts.admin')

@section('title', 'SOP & Peraturan')
@section('menu', 'sop')

@section('content')
  <p class="page-sub">Standar kerja yang ditetapkan Owner. Baca sebelum memproses barang keluar, pengembalian, dan pembatalan.</p>
  <div class="filters" id="ctx"></div>
  <div id="list" class="sop-list"></div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/admin/sop.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
