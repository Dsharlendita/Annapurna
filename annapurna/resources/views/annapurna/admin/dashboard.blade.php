@extends('annapurna.layouts.admin')

@section('title', 'Dashboard')
@section('menu', 'dashboard')

@section('content')
  <p class="page-sub" id="greet"></p>
  <div class="seg biz-view" id="dashView" role="tablist" aria-label="Jenis operasional"><button type="button" data-v="sewa" class="active" role="tab"><i class="fa-solid fa-campground"></i> Operasional Sewa <b class="cnt" id="cntSewa"></b></button><button type="button" data-v="jual" role="tab"><i class="fa-solid fa-bag-shopping"></i> Penjualan <b class="cnt" id="cntJual"></b></button></div>
  <div id="dashSewa">
  {{-- 1. Pusat tindakan: semua yang harus dikerjakan, diurutkan dari yang paling mendesak --}}
  <section class="act-center" aria-labelledby="actT">
    <div class="ac-h">
      <div><h2 id="actT"><i class="fa-solid fa-bolt"></i> Perlu tindakan sekarang</h2><p id="actSub"></p></div>
      <div class="ac-filter" id="actFilter" role="tablist" aria-label="Saring tugas"></div>
    </div>
    <div class="ac-today" id="todayChips"></div>
    <div id="todo"></div>
  </section>
  {{-- 2. Jadwal hari ini & kondisi toko --}}
  <div class="grid-dash dash-mid">
    <div class="panel">
      <div class="panel-h"><h3><i class="fa-regular fa-clock" style="color:var(--g600)"></i> Jadwal hari ini</h3><a class="btn btn-light btn-xs" href="{{ route('admin.kalender') }}">Kalender <i class="fa-solid fa-arrow-right"></i></a></div>
      <div id="today"></div>
    </div>
    <div class="panel">
      <div class="panel-h"><h3><i class="fa-solid fa-store" style="color:var(--g600)"></i> Kondisi toko</h3></div>
      <div class="mini-grid" id="stats2"></div>
    </div>
  </div>
  {{-- 3. Untuk dilihat (bukan dikerjakan) --}}
  <h4 class="dash-sec"><i class="fa-solid fa-chart-column"></i> Ringkasan</h4>
  <div class="grid-dash">
    <div class="panel">
      <div class="panel-h"><h3>Pemasukan 7 hari terakhir</h3><a class="btn btn-light btn-xs" href="{{ route('admin.keuangan') }}">Detail keuangan <i class="fa-solid fa-arrow-right"></i></a></div>
      <div class="chart-box"><canvas id="chart" aria-label="Grafik pemasukan"></canvas></div>
    </div>
    <div>
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
  <div class="panel" style="margin-top:18px">
    <div class="panel-h"><h3>Booking terbaru</h3><a class="btn btn-light btn-xs" href="{{ route('admin.booking') }}">Semua booking <i class="fa-solid fa-arrow-right"></i></a></div>
    <div class="table-wrap" data-no-paginate><table class="table"><thead><tr><th>No.</th><th>Customer</th><th>Tanggal sewa</th><th class="num">Total</th><th>Status</th><th></th></tr></thead><tbody id="latest"></tbody></table></div>
    <div class="latest-more" id="latestMore"></div>
  </div>
  </div>
  <div id="dashJual" hidden>
    <div class="stat-grid" id="saleStats"></div>
    <div class="grid-dash">
      <div class="panel">
        <div class="panel-h"><h3>Pesanan penjualan terbaru</h3><a class="btn btn-light btn-xs" href="{{ route('admin.penjualan') }}">Semua penjualan <i class="fa-solid fa-arrow-right"></i></a></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>No.</th><th>Customer</th><th>Barang</th><th class="num">Total</th><th>Status</th><th></th></tr></thead><tbody id="saleLatest"></tbody></table></div>
      </div>
      <div>
        <div class="panel"><div class="panel-h"><h3>Perlu tindakan</h3></div><div id="saleTodo"></div></div>
        <div class="panel"><div class="panel-h"><h3>Stok menipis</h3><a class="btn btn-light btn-xs" href="{{ route('admin.barang') }}?tab=jual">Data barang jual</a></div><div id="saleLow"></div></div>
        <div class="panel"><div class="panel-h"><h3>Barang paling laku bulan ini</h3></div><ul class="bar-list" id="saleTop"></ul></div>
      </div>
    </div>
  </div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/vendor/chart.umd.js') }}"></script>
  <script src="{{ asset('assets/js/admin/dashboard.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
