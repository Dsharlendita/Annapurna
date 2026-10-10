@extends('annapurna.layouts.app')

@section('title', 'Tentang Kami')
@section('page', 'tentang')

@section('content')
<section class="page-hero ab-page-hero">
  <div class="wrap">
    <div class="ab-ph-text">
      <div class="crumbs ha" style="--d:.05s"><a href="{{ route('home') }}">Beranda</a><span>/</span><span>Tentang Kami</span></div>
      <div class="ab-kicker ha" style="--d:.12s"><i class="fa-solid fa-location-dot"></i> Purwokerto, Banyumas</div>
      <h1 class="ha" style="--d:.2s">Teman jalan para pendaki</h1>
      <p class="ha" style="--d:.3s">Rental dan toko perlengkapan camping di Purwokerto, supaya siapa pun bisa mulai berpetualang tanpa beli semua alat.</p>
    </div>
  </div>
</section>

<main class="ab-main">
  <section class="section ab-story" id="cerita">
    <div class="wrap ab-story-grid">
      <div class="ab-collage" data-reveal="left">
        <div class="ab-c-main"><img src="{{ asset('assets/img/hero.jpg') }}" alt="Pendaki menikmati matahari terbit di depan tenda"></div>
        <div class="ab-c-sm ab-c-1"><img src="{{ asset('assets/img/products/tenda.jpg') }}" alt="Tenda camping"></div>
        <div class="ab-c-sm ab-c-2"><img src="{{ asset('assets/img/products/kompor.jpg') }}" alt="Kompor portable"></div>
      </div>
      <div class="ab-story-text" data-reveal="right">
        <div class="eyebrow">Cerita kami</div>
        <h2 class="sec-title">Berawal dari hobi naik gunung</h2>
        <p>Kami tahu rasanya ingin naik Slamet atau camping di Baturraden, tapi alatnya belum lengkap. Dari situ Annapurna Adventure lahir: alat yang terawat, harga ramah pelajar, dan proses sewa yang tidak ribet.</p>
        <ul class="ab-checks">
          <li><i class="fa-solid fa-circle-check"></i>Setiap alat dicek dan dibersihkan setelah dipakai</li>
          <li><i class="fa-solid fa-circle-check"></i>Cek ketersediaan per tanggal langsung dari website</li>
          <li><i class="fa-solid fa-circle-check"></i>Booking cukup dengan DP, sisanya dibayar saat ambil</li>
        </ul>
        <div class="ab-sign"><span class="script">Salam lestari,</span><small>Tim Annapurna Adventure</small></div>
      </div>
    </div>
    <div class="wrap">
      <div class="ab-numbers" id="abStats" data-reveal-group></div>
    </div>
  </section>

  <section class="section ab-values-sec">
    <div class="wrap">
      <div class="ab-head" data-reveal>
        <div class="eyebrow">Kenapa sewa di sini</div>
        <h2 class="sec-title">Yang kami jaga untuk setiap penyewa</h2>
      </div>
      <div class="ab-values" data-reveal-group>
        <article class="ab-value"><span class="ab-v-ic"><i class="fa-solid fa-shield-halved"></i></span><h4>Alat terawat</h4><p>Dicek dan dibersihkan setelah setiap penyewaan, lengkap dengan catatan kondisi keluar-masuk.</p></article>
        <article class="ab-value"><span class="ab-v-ic"><i class="fa-regular fa-calendar-check"></i></span><h4>Ketersediaan jelas</h4><p>Kalender stok per tanggal, jadi kamu tidak booking alat yang sedang dipakai orang lain.</p></article>
        <article class="ab-value"><span class="ab-v-ic"><i class="fa-solid fa-hand-holding-dollar"></i></span><h4>Cukup DP <span id="abDp">50</span>%</h4><p>Kunci booking dengan DP. Sisanya dibayar saat mengambil barang di toko.</p></article>
        <article class="ab-value"><span class="ab-v-ic"><i class="fa-solid fa-arrows-rotate"></i></span><h4>Bisa ganti barang</h4><p>Rencana berubah? Ajukan ganti barang dari halaman pesanan, admin yang memproses.</p></article>
      </div>
    </div>
  </section>

  <section class="section ab-care">
    <div class="wrap">
      <div class="ab-head center" data-reveal>
        <div class="eyebrow">Standar perawatan</div>
        <h2 class="sec-title">Perjalanan alat sebelum sampai ke tanganmu</h2>
        <p class="sec-sub">Setiap alat yang kembali dari petualangan melewati empat tahap ini sebelum disewakan lagi.</p>
      </div>
      <ol class="ab-flow" data-reveal-group>
        <li><span class="ab-f-num">1</span><span class="ab-f-ic"><i class="fa-solid fa-magnifying-glass"></i></span><h4>Dicek</h4><p>Kondisi dan kelengkapan diperiksa bersama saat barang dikembalikan.</p></li>
        <li><span class="ab-f-num">2</span><span class="ab-f-ic"><i class="fa-solid fa-soap"></i></span><h4>Dibersihkan</h4><p>Tenda dijemur, sleeping bag dicuci, peralatan masak dibersihkan.</p></li>
        <li><span class="ab-f-num">3</span><span class="ab-f-ic"><i class="fa-solid fa-screwdriver-wrench"></i></span><h4>Diuji</h4><p>Kompor dinyalakan, lampu dicoba, frame tenda dirakit ulang.</p></li>
        <li><span class="ab-f-num">4</span><span class="ab-f-ic"><i class="fa-solid fa-box-archive"></i></span><h4>Siap disewa</h4><p>Disimpan rapi dan statusnya kembali tersedia di website.</p></li>
      </ol>
    </div>
  </section>

  <section class="section ab-rules" id="ketentuan">
    <div class="wrap">
      <div class="ab-head" data-reveal>
        <div class="eyebrow">Aturan main</div>
        <h2 class="sec-title">Ketentuan sewa &amp; pembatalan</h2>
      </div>
      <div class="ab-rule-card" id="durasi" style="margin-bottom:18px" data-reveal>
        <div class="ab-rule-h"><span class="ab-v-ic"><i class="fa-solid fa-calendar-days"></i></span><h3>Durasi peminjaman</h3></div>
        <div class="dur-rules" id="durRules"></div>
        <p class="muted" id="tektokRules" style="font-size:13px;margin-top:12px"></p>
      </div>
      <div class="ab-rules-grid" data-reveal-group>
        <div class="ab-rule-card">
          <div class="ab-rule-h"><span class="ab-v-ic"><i class="fa-solid fa-file-lines"></i></span><h3>Ketentuan sewa</h3></div>
          <ol class="ab-list" id="terms"></ol>
        </div>
        <div class="ab-rule-card">
          <div class="ab-rule-h"><span class="ab-v-ic gold"><i class="fa-solid fa-rotate-left"></i></span><h3>Kebijakan pembatalan</h3></div>
          <ol class="ab-list" id="policy"></ol>
          <div class="ab-example"><i class="fa-regular fa-lightbulb"></i><div><strong>Contoh</strong><span id="abExample">Sewa mulai tanggal 30, batas pembatalan dengan DP kembali adalah tanggal 28.</span></div></div>
        </div>
      </div>
    </div>
  </section>

  <section class="section ab-faq-sec" id="faq">
    <div class="wrap ab-faq-grid">
      <div class="ab-faq-intro" data-reveal="left">
        <div class="eyebrow">FAQ</div>
        <h2 class="sec-title">Pertanyaan yang sering ditanyakan</h2>
        <p class="sec-sub">Belum menemukan jawabannya? Tim kami siap membantu lewat WhatsApp.</p>
        <a class="btn btn-primary" id="abWa" href="#" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> Tanya lewat WhatsApp</a>
      </div>
      <div class="ab-faq" id="abFaq" data-reveal-group>
        <details open><summary>Bagaimana cara menghitung lama sewa?</summary><div class="ab-faq-a"><p>Ada 3 pilihan: <b>Per malam</b> (kembali esok hari), <b>Kegiatan 3 hari 3 malam</b>, dan <b>Ekspedisi 5 hari 5 malam</b>. Contoh: ambil Kamis pukul 09.00 WIB, sewa per malam kembali Jumat, kegiatan kembali Minggu, ekspedisi kembali Selasa — maksimal pukul 22.00 WIB (jam tutup toko). Durasi lain dihitung dari kombinasi tarif paling hemat.</p></div></details>
        <details><summary>Apa saja yang perlu dibawa saat mengambil barang?</summary><div class="ab-faq-a"><p>Bawa kartu identitas asli (KTP/KTM/SIM) dan nota digital dari halaman Pesanan Saya. Sisa pembayaran dilunasi saat pengambilan.</p></div></details>
        <details><summary>Apakah barang bisa diantar?</summary><div class="ab-faq-a"><p>Belum. Semua pengambilan dan pengembalian barang dilakukan langsung di toko agar kondisi alat bisa dicek bersama.</p></div></details>
        <details><summary>Bagaimana kalau alat rusak saat dipakai?</summary><div class="ab-faq-a"><p>Laporkan ke admin saat pengembalian. Biaya perbaikan menyesuaikan tingkat kerusakan setelah pengecekan bersama.</p></div></details>
        <details><summary>Apakah barang harus dicuci sebelum dikembalikan?</summary><div class="ab-faq-a"><p>Tidak perlu. Sewa bersih, kembali kotor? Biar kami yang membersihkan — kamu cukup memakainya dengan happy tanpa harus mencuci.</p></div></details>
        <details><summary>Bagaimana kalau terlambat mengembalikan?</summary><div class="ab-faq-a"><p>Batas pengembalian adalah tanggal kembali pukul 22.00 WIB. Lewat dari itu dihitung terlambat dan dikenakan biaya sewa per malam untuk setiap barang, setiap malam keterlambatan.</p></div></details>
      </div>
    </div>
  </section>

  <section class="ab-cta-wrap">
    <div class="wrap">
      <div class="ab-cta" data-reveal>
        <div class="ab-cta-bg" aria-hidden="true"></div>
        <div class="ab-cta-text">
          <h2>Siap berangkat akhir pekan ini?</h2>
          <p>Cek ketersediaan alat untuk tanggalmu dan amankan booking dengan DP <span id="abDp2">50</span>%.</p>
        </div>
        <a class="btn btn-gold" href="{{ route('katalog') }}">Cek ketersediaan alat <i class="fa-solid fa-arrow-right"></i></a>
      </div>
    </div>
  </section>
</main>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/pages/tentang.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
