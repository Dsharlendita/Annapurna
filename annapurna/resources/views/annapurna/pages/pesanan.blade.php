@extends('annapurna.layouts.app')

@section('title', 'Pesanan Saya')
@section('page', 'pesanan')

@section('content')
<main class="section" style="padding-top:32px">
  <div class="wrap" style="max-width:980px">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:18px">
      <div><h1 class="sec-title">Pesanan Saya</h1><p class="muted">Pantau booking sewa, pembayaran, dan pembelianmu di satu tempat.</p></div>
      <a class="btn btn-primary btn-sm" href="{{ route('katalog') }}"><i class="fa-solid fa-plus"></i> Sewa alat lagi</a>
    </div>
    <div class="tabs" role="tablist" id="tabs">
      <button class="tab" data-tab="sewa">Rental berjalan <span class="cnt" id="cSewa">0</span></button>
      <button class="tab" data-tab="beli">Pembelian <span class="cnt" id="cBeli">0</span></button>
      <button class="tab" data-tab="riwayat">Riwayat <span class="cnt" id="cRiw">0</span></button>
    </div>
    <div id="list"></div>
  </div>
</main>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/pages/pesanan.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
