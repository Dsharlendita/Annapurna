@extends('annapurna.layouts.admin')

@section('title', 'Konfigurasi Sistem')
@section('menu', 'owner-konfigurasi')
@section('owner_only', '1')

@section('content')
  <p class="page-sub">Sesuaikan aturan dan pilihan yang dipakai staff tanpa mengubah kode program. Pilih kelompok di kiri, lalu bagian yang ingin diubah di tab atas. Setiap perubahan tercatat di histori sistem.</p>
  <div class="cfg">
    <nav class="cfg-nav" id="cfgNav" aria-label="Bagian konfigurasi"></nav>
    <div class="cfg-body">
      <div class="cfg-tabs" id="cfgTabs" role="tablist"></div>
      <section class="cfg-main" id="cfgMain"></section>
    </div>
  </div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/owner/konfigurasi.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
