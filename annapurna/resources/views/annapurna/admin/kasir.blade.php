@extends('annapurna.layouts.admin')

@section('title', 'Kasir')
@section('menu', 'kasir')

@section('content')
  <p class="page-sub">Catat pesanan sewa, pembelian, atau laundry yang dilakukan langsung di toko. Jasa tenda (bongkar pasang / pasang saja / bongkar saja) &amp; ongkir antar/jemput dicatat di transaksi sewa. Pembayaran tercatat otomatis di Keuangan sebagai <b>Offline · Kasir</b>, dan nota bisa dicetak (struk 58/80 mm atau A4) atau dikirim ke WhatsApp customer.</p>
  <div class="kasir">
    <section class="kasir-cat panel">
      <div class="kasir-top">
        <div class="seg biz-view" id="kMode" role="tablist" aria-label="Jenis transaksi"><button type="button" data-k="rent" class="active" role="tab"><i class="fa-solid fa-campground"></i> Sewa</button><button type="button" data-k="buy" role="tab"><i class="fa-solid fa-bag-shopping"></i> Jual</button><button type="button" data-k="laundry" role="tab"><i class="fa-solid fa-jug-detergent"></i> Laundry</button></div>
        <div class="input-icon"><i class="fa-solid fa-magnifying-glass"></i><input class="input" id="kQ" placeholder="Cari nama barang / kode…" autocomplete="off"></div>
      </div>
      <div class="kasir-chips" id="kCats"></div>
      <div class="kasir-dates" id="kDates"></div>
      <div class="kasir-grid" id="kGrid"></div>
    </section>
    <aside class="kasir-bill panel" id="kBill"></aside>
  </div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/admin/kasir.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
