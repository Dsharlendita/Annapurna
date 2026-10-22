@extends('annapurna.layouts.app')

@section('title', 'Ketentuan')
@section('page', 'ketentuan')

@section('content')
<section class="page-hero ab-page-hero">
  <div class="wrap">
    <div class="ab-ph-text">
      <div class="crumbs ha" style="--d:.05s"><a href="{{ route('home') }}">Beranda</a><span>/</span><span>Ketentuan</span></div>
      <div class="ab-kicker ha" style="--d:.12s"><i class="fa-solid fa-file-contract"></i> Aturan main</div>
      <h1 class="ha" style="--d:.2s">Ketentuan sewa &amp; layanan</h1>
      <p class="ha" style="--d:.3s">Baca sebentar sebelum memesan supaya sewa, pembayaran, dan pengembalian berjalan lancar.</p>
    </div>
  </div>
</section>

<main class="ab-main kt-main">
  <div class="wrap">
    <nav class="kt-toc" aria-label="Daftar isi"><a href="#durasi"><i class="fa-solid fa-calendar-days"></i> Durasi</a><a href="#sewa"><i class="fa-solid fa-file-lines"></i> Ketentuan sewa</a><a href="#bayar"><i class="fa-solid fa-wallet"></i> Pembayaran</a><a href="#batal"><i class="fa-solid fa-rotate-left"></i> Pembatalan</a><a href="#tektok"><i class="fa-solid fa-person-hiking"></i> Paket tektok</a><a href="#laundry"><i class="fa-solid fa-jug-detergent"></i> Laundry</a></nav>
  </div>
  <section class="section ab-rules" id="ketentuan-sewa">
    <div class="wrap">
      <div class="ab-head" data-reveal>
        <div class="eyebrow">Sewa alat</div>
        <h2 class="sec-title">Ketentuan sewa &amp; pembatalan</h2>
      </div>
      <div class="ab-rule-card" id="durasi" style="margin-bottom:18px" data-reveal>
        <div class="ab-rule-h"><span class="ab-v-ic"><i class="fa-solid fa-calendar-days"></i></span><h3>Durasi peminjaman</h3></div>
        <div class="dur-rules" id="durRules"></div>
        <p class="muted" id="tektokRules" style="font-size:13px;margin-top:12px"></p>
      </div>
      <div class="ab-rules-grid" data-reveal-group>
        <div class="ab-rule-card" id="sewa">
          <div class="ab-rule-h"><span class="ab-v-ic"><i class="fa-solid fa-file-lines"></i></span><h3>Ketentuan sewa</h3></div>
          <ol class="ab-list" id="terms"></ol>
        </div>
        <div class="ab-rule-card" id="batal">
          <div class="ab-rule-h"><span class="ab-v-ic gold"><i class="fa-solid fa-rotate-left"></i></span><h3>Kebijakan pembatalan</h3></div>
          <ol class="ab-list" id="policy"></ol>
          <div class="ab-example"><i class="fa-regular fa-lightbulb"></i><div><strong>Contoh</strong><span id="abExample">Sewa mulai tanggal 30, batas pembatalan dengan DP kembali adalah tanggal 28.</span></div></div>
        </div>
      </div>
    </div>
  </section>

  <section class="section ab-rules kt-more">
    <div class="wrap">
      <div class="ab-rules-grid" data-reveal-group>
        <div class="ab-rule-card" id="bayar"><div class="ab-rule-h"><span class="ab-v-ic"><i class="fa-solid fa-wallet"></i></span><h3>Pembayaran</h3></div><div id="ktPay"></div></div>
        <div class="ab-rule-card" id="tektok"><div class="ab-rule-h"><span class="ab-v-ic gold"><i class="fa-solid fa-person-hiking"></i></span><h3>Paket tektok</h3></div><ol class="ab-list" id="ktTektok"></ol></div>
        <div class="ab-rule-card" id="laundry"><div class="ab-rule-h"><span class="ab-v-ic"><i class="fa-solid fa-jug-detergent"></i></span><h3>Laundry</h3></div><ol class="ab-list" id="ktLaundry"></ol></div>
        <div class="ab-rule-card" id="kirim"><div class="ab-rule-h"><span class="ab-v-ic gold"><i class="fa-solid fa-truck-fast"></i></span><h3>Antar &amp; kirim barang</h3></div><ol class="ab-list" id="ktShip"></ol></div>
      </div>
      <p class="muted kt-upd" id="ktUpd"></p>
    </div>
  </section>
</main>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/pages/ketentuan.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
