@extends('annapurna.layouts.admin')

@section('title', 'Dashboard')
@section('menu', 'dashboard')

@section('content')
  <p class="page-sub" id="greet"></p>
  <div class="stat-grid" id="stats"></div>
  <div class="grid-dash">
    <div class="panel">
      <div class="panel-h"><h3>Pemasukan 7 hari terakhir</h3><a class="btn btn-light btn-xs" href="{{ route('admin.keuangan') }}">Detail keuangan <i class="fa-solid fa-arrow-right"></i></a></div>
      <div class="chart-box"><canvas id="chart" aria-label="Grafik pemasukan"></canvas></div>
    </div>
    <div class="panel">
      <div class="panel-h"><h3>Perlu tindakan</h3></div>
      <div id="todo"></div>
    </div>
  </div>
  <div class="grid-dash">
    <div class="panel">
      <div class="panel-h"><h3>Booking terbaru</h3><a class="btn btn-light btn-xs" href="{{ route('admin.booking') }}">Semua booking <i class="fa-solid fa-arrow-right"></i></a></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>No.</th><th>Customer</th><th>Tanggal sewa</th><th class="num">Total</th><th>Status</th><th></th></tr></thead><tbody id="latest"></tbody></table></div>
    </div>
    <div>
      <div class="panel">
        <div class="panel-h"><h3>Jadwal hari ini</h3></div>
        <div id="today"></div>
      </div>
      <div class="panel" id="sopPanel" hidden>
        <div class="panel-h"><h3><i class="fa-solid fa-clipboard-list" style="color:var(--g600)"></i> SOP penting</h3><a class="btn btn-light btn-xs" href="{{ route('admin.sop') }}">Semua SOP</a></div>
        <div id="sopPin"></div>
      </div>
      <div class="panel">
        <div class="panel-h"><h3>Barang paling sering disewa</h3></div>
        <ul class="bar-list" id="top"></ul>
      </div>
    </div>
  </div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/vendor/chart.umd.js') }}"></script>
  <script src="{{ asset('assets/js/admin/dashboard.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
