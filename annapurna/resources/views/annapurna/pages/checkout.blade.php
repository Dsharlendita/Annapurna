@extends('annapurna.layouts.app')

@section('title', 'Checkout')
@section('page', 'checkout')

@section('content')
<main class="section" style="padding-top:32px">
  <div class="wrap">
    <div class="stepper">
      <span class="st done"><b><i class="fa-solid fa-check"></i></b> Keranjang</span><span class="sep"></span>
      <span class="st on"><b>2</b> Data &amp; pengiriman</span><span class="sep"></span>
      <span class="st"><b>3</b> Pembayaran</span>
    </div>
    <div id="root"></div>
  </div>
</main>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/pages/checkout.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
