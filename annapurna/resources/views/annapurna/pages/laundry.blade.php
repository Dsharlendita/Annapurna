@extends('annapurna.layouts.app')

@section('title', 'Laundry Perlengkapan Outdoor')
@section('page', 'laundry')

@section('head')
  <meta name="description" content="Laundry tenda, sleeping bag, jaket, carrier, sepatu, dan matras di Annapurna Adventure Purwokerto. Bawa langsung ke toko, selesai dalam beberapa hari.">
@endsection

@section('content')
{{-- Hero laundry: isi angka (harga mulai, lama pengerjaan, jam buka) diisi dari pengaturan Owner oleh laundry.js --}}
<section class="lp-hero">
  <div class="wrap lp-hero-in">
    <div class="lp-hero-tx">
      <div class="crumbs"><a href="{{ route('home') }}">Beranda</a><span>/</span><span>Laundry</span></div>
      <span class="lp-kicker"><i class="fa-solid fa-jug-detergent"></i> Laundry Outdoor Equipment</span>
      <h1>Perlengkapan bersih,<br>siap bertualang lagi.</h1>
      <p>Tenda, sleeping bag, jaket, carrier, sepatu, sampai matras dicuci dengan cara yang tepat untuk bahan outdoor. Bawa langsung ke toko, kami kabari saat siap diambil.</p>
      <div class="lp-hero-acts">
        <a class="btn btn-gold" href="#harga"><i class="fa-solid fa-calculator"></i> Hitung estimasi</a>
        <a class="btn btn-onDark" href="{{ route('kontak') }}#lokasi"><i class="fa-solid fa-location-dot"></i> Lokasi toko</a>
      </div>
      <ul class="lp-facts" id="lpFacts"></ul>
    </div>
    <div class="lp-hero-art" aria-hidden="true">
      <div class="lp-blob"></div>
      <img class="a1" src="{{ asset('assets/img/categories/sleeping-bag.jpg') }}" alt="">
      <img class="a2" src="{{ asset('assets/img/categories/tenda.jpg') }}" alt="">
      <span class="lp-bubble b1"></span><span class="lp-bubble b2"></span><span class="lp-bubble b3"></span>
    </div>
  </div>
</section>

<section class="section lp-steps-sec" aria-label="Cara laundry">
  <div class="wrap"><ol class="lp-steps" id="lpSteps"></ol></div>
</section>

<main class="section lp-main" id="harga">
  <div class="wrap">
    <div class="sec-head" style="margin-bottom:18px"><div><div class="eyebrow">Daftar harga</div><h2 class="sec-title">Pilih barang, lihat estimasinya</h2></div></div>
    <div class="ld-layout" id="root"></div>
  </div>
</main>

<section class="section lp-terms-sec" aria-labelledby="lpTermsT">
  <div class="wrap"><div class="lp-terms" id="lpTerms"></div></div>
</section>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/pages/laundry.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
