@extends('annapurna.layouts.admin')

@section('title', 'Pembatalan & Ganti Barang')
@section('menu', 'permintaan')

@section('content')
  <p class="page-sub">Tinjau permintaan ganti barang dari customer, catat ganti barang langsung di toko, dan proses pengembalian DP untuk booking yang dibatalkan.</p>
  <div class="notice green" style="margin-bottom:18px" id="policy"></div>
  <div class="tabs-bar"><div class="tabs" id="tabs">
    <button class="tab active" data-tab="change">Ganti Barang <span class="cnt" id="cC">0</span></button>
    <button class="tab" data-tab="cancel">Pembatalan & Refund <span class="cnt" id="cR">0</span></button>
  </div><button class="btn btn-primary btn-sm" id="storeChg"><i class="fa-solid fa-store"></i> Catat ganti barang di toko</button></div>
  <div id="pane"></div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/admin/permintaan.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
