@extends('annapurna.layouts.admin')

@section('title', 'Konfigurasi Sistem')
@section('menu', 'owner-konfigurasi')
@section('owner_only', '1')

@section('content')
  <p class="page-sub">Sesuaikan aturan dan pilihan yang dipakai staff tanpa mengubah kode program: kategori, atribut barang (ukuran, warna, kapasitas), status barang, aturan rental, denda, form, dan SOP. Setiap perubahan tercatat di histori sistem.</p>
  <div class="cfg">
    <nav class="cfg-nav" id="cfgNav" aria-label="Bagian konfigurasi"></nav>
    <section class="cfg-main" id="cfgMain"></section>
  </div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/owner/konfigurasi.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
