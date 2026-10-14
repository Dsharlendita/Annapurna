@extends('annapurna.layouts.app')

@section('title', 'Laundry Perlengkapan Outdoor')
@section('page', 'laundry')

@section('head')
  <meta name="description" content="Laundry tenda, sleeping bag, jaket, carrier, sepatu, dan matras di Annapurna Adventure Purwokerto. Bawa langsung ke toko.">
@endsection

@section('content')
<section class="page-hero">
  <div class="wrap">
    <div class="crumbs"><a href="{{ route('home') }}">Beranda</a><span>/</span><span>Laundry</span></div>
    <h1>Laundry perlengkapan outdoor</h1>
    <p>Bawa perlengkapanmu langsung ke toko, kami cuci sampai bersih. Hitung dulu estimasi biayanya di bawah.</p>
  </div>
</section>

<main class="section">
  <div class="wrap ld-layout" id="root"></div>
</main>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/pages/laundry.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
