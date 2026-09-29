@extends('annapurna.layouts.app')

@section('title', 'Keranjang')
@section('page', 'keranjang')

@section('content')
<main class="section" style="padding-top:32px">
  <div class="wrap">
    <div class="stepper" aria-label="Langkah pemesanan">
      <span class="st on"><b>1</b> Keranjang</span><span class="sep"></span>
      <span class="st"><b>2</b> Data &amp; pengiriman</span><span class="sep"></span>
      <span class="st"><b>3</b> Pembayaran</span>
    </div>
    <h1 class="sec-title" style="margin-bottom:20px">Keranjang kamu</h1>
    <div id="root"></div>
  </div>
</main>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/pages/keranjang.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
