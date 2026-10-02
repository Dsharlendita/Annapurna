@extends('annapurna.layouts.admin')

@section('title', 'Manajemen Staff')
@section('menu', 'owner-staff')
@section('owner_only', '1')

@section('content')
  <p class="page-sub">Tambah staff, atur role, dan aktifkan / nonaktifkan akses panel. Akun staff tidak dihapus agar histori aktivitasnya tetap bisa ditelusuri. Setiap staff baru menerima email berisi informasi akun dan diminta mengganti kata sandi saat pertama login.</p>
  <div class="stat-grid" id="stats"></div>
  <div class="filters">
    <div class="input-icon"><i class="fa-solid fa-magnifying-glass"></i><input class="input" id="q" placeholder="Cari nama atau email…"></div>
    <select class="select" id="fStatus"><option value="">Semua status</option><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option></select>
    <select class="select" id="fRole"><option value="">Semua role</option><option value="admin">Admin / Staff</option><option value="owner">Owner</option></select>
    <span style="flex:1"></span>
    <button class="btn btn-primary btn-sm" id="add"><i class="fa-solid fa-user-plus"></i> Tambah staff</button>
  </div>
  <div class="table-wrap"><table class="table">
    <thead><tr><th>Staff</th><th>Role</th><th>Status</th><th>Login terakhir</th><th class="num">Aktivitas bulan ini</th><th class="num">Aksi</th></tr></thead>
    <tbody id="rows"></tbody>
  </table></div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/owner/staff.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
