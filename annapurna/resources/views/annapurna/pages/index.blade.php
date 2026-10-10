@extends('annapurna.layouts.app')

@section('title', 'Annapurna Adventure — Sewa & Beli Alat Camping dan Outdoor di Purwokerto')
@section('page', 'home')
@section('title_suffix', '')

@section('head')
  <meta name="description" content="Sewa dan beli perlengkapan camping dan outdoor di Annapurna Adventure, Purwokerto. Tenda, carrier, footwear, jaket, sleeping bag, cooking set, paket tenda, BBQ, dan tektok. Sewa per malam, kegiatan 3 hari, atau ekspedisi 5 hari.">
@endsection

@section('content')
<main>
  <section class="hero" id="hero">
    <div class="hero-bg" aria-hidden="true"></div>
    <div class="wrap hero-inner">
      <h1 class="hero-title">
        <span class="ht-l1 ha" style="--d:.15s">Jelajahi Alam,</span><span class="l2 ha" style="--d:.35s">Lengkapi Petualanganmu</span>
      </h1>
      <p class="hero-lead ha" style="--d:.55s">Sewa atau beli perlengkapan camping dan outdoor di Annapurna Adventure. Alat sewa terawat dengan harga bersahabat, perlengkapan baru siap kamu miliki, semuanya untuk menemani setiap langkah petualanganmu!</p>
      <form class="hero-search ha" style="--d:.7s" id="heroSearch" role="search">
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <label class="sr-only" for="heroQ">Cari perlengkapan</label>
        <input id="heroQ" name="q" placeholder="Cari perlengkapan yang kamu butuhkan…" autocomplete="off">
        <div class="hs-mode" role="radiogroup" aria-label="Cari untuk">
          <label><input type="radio" name="hmode" value="sewa" checked><span>Sewa</span></label>
          <label><input type="radio" name="hmode" value="beli"><span>Beli</span></label>
        </div>
        <button class="btn btn-primary" type="submit">Cari</button>
      </form>
      <div class="hero-ctas ha" style="--d:.8s">
        <a class="btn btn-gold" href="{{ route('katalog') }}"><i class="fa-solid fa-campground"></i> Sewa Alat</a>
        <a class="btn btn-onDark" href="{{ route('belanja') }}"><i class="fa-solid fa-bag-shopping"></i> Belanja Alat</a>
      </div>
      <ul class="hero-perks">
        <li class="ha" style="--d:.9s"><span class="ic"><i class="fa-solid fa-shield-halved"></i></span>Alat Sewa Bersih &amp; Terawat</li>
        <li class="ha" style="--d:1s"><span class="ic"><i class="fa-solid fa-tags"></i></span>Produk Jual Baru &amp; Original</li>
        <li class="ha" style="--d:1.1s"><span class="ic"><i class="fa-regular fa-gem"></i></span>Harga Bersahabat</li>
        <li class="ha" style="--d:1.2s"><span class="ic"><i class="fa-solid fa-stopwatch"></i></span>Proses Mudah &amp; Cepat</li>
      </ul>
    </div>
    <div class="hero-note" aria-hidden="true"><span>Alat Lengkap<br>Petualangan<br>Makin Seru!</span>
      <svg viewBox="0 0 90 14" fill="none"><path d="M3 11 C30 3 60 2 87 4" stroke="#f2c14e" stroke-width="3" stroke-linecap="round" pathLength="1"/></svg>
    </div>
  </section>

  <section class="mine-sec" id="mineSec" hidden>
    <div class="wrap" id="mineBox"></div>
  </section>

  <section class="section" id="kategori" style="padding-bottom:40px">
    <div class="wrap">
      <div class="sec-head" data-reveal>
        <div><div class="eyebrow">Jelajahi Kategori</div><h2 class="sec-title">Pilih Perlengkapan Sesuai Kebutuhanmu</h2></div>
        <a class="link" href="{{ route('katalog') }}">Lihat Semua Produk <i class="fa-solid fa-arrow-right"></i></a>
      </div>
      <div class="cat-grid" id="catGrid" data-reveal-group></div>
    </div>
  </section>

  <section class="section promo-sec" id="promo" hidden style="padding:8px 0 40px">
    <div class="wrap"><div class="sec-head"><div><div class="eyebrow">Promo</div><h2 class="sec-title big">Promo Spesial</h2></div></div><div class="promo-strip" id="promoStrip"></div></div>
  </section>

  <section class="section bestseller">
    <div class="wrap">
      <div class="sec-head" data-reveal>
        <div><div class="eyebrow" id="bestEyebrow">Produk Pilihan</div><h2 class="sec-title big" id="bestTitle">Produk Rental Terlaris</h2><p class="best-note" id="bestNote"></p></div>
        <a class="btn btn-light btn-sm" href="{{ route('katalog') }}">Lihat Semua <i class="fa-solid fa-arrow-right"></i></a>
      </div>
      <div class="prod-grid" id="bestGrid" data-reveal-group></div>
    </div>
  </section>

  <section class="section shop-sec" id="belanja">
    <div class="wrap">
      <div class="sec-head" data-reveal>
        <div><div class="eyebrow"><i class="fa-solid fa-bag-shopping"></i> Belanja Alat</div><h2 class="sec-title big">Produk Jual Terlaris</h2><p class="best-note">Perlengkapan baru siap kamu miliki. Bayar penuh, ambil di toko.</p></div>
        <a class="btn btn-primary btn-sm" href="{{ route('belanja') }}">Belanja Sekarang <i class="fa-solid fa-arrow-right"></i></a>
      </div>
      <div class="prod-grid" id="shopGrid" data-reveal-group></div>
    </div>
  </section>

  <section class="section ai-plan-sec">
    <div class="wrap">
      <div class="ai-plan-band" data-reveal>
        <div>
          <span class="ai-tag"><i class="fa-solid fa-wand-magic-sparkles"></i> Asisten Trip</span>
          <h2>Bingung harus sewa apa saja?</h2>
          <p>Ceritakan rencanamu, asisten kami menyusun daftar alat, jumlah, dan total biayanya, lalu cek ketersediaannya sekaligus.</p>
          <button type="button" class="ai-band-ask" id="aiAsk"><i class="fa-regular fa-comments"></i> Ada pertanyaan soal sewa atau pesanan? Tanya Asisten Trip</button>
        </div>
        <form class="ai-plan-form" id="aiPlanForm">
          <div class="row"><input id="aiPlanQ" placeholder="Contoh: camping di Baturraden berempat 1 malam" aria-label="Rencana trip"><button class="btn btn-gold" type="submit"><i class="fa-solid fa-wand-magic-sparkles"></i> Buat rencana</button></div>
          <div class="ex"><button type="button">Naik Slamet berdua 3 malam</button><button type="button">Tektok Prau sendirian</button><button type="button">Kemah keluarga 5 orang 1 malam</button></div>
        </form>
      </div>
    </div>
  </section>

  <section class="section" id="cara-sewa">
    <div class="wrap howto">
      <div class="howto-intro" data-reveal="left">
        <span class="ms">Annapurna</span>
        <h2 id="howTitle">Cara Sewa</h2>
        <h3>Mudah, Cepat, Tanpa Ribet</h3>
        <p id="howSub">Nikmati proses penyewaan yang praktis dan aman bersama Annapurna Adventure.</p>
        <div class="seg how-tabs" role="tablist" aria-label="Cara transaksi"><button type="button" class="active" data-how="sewa" role="tab">Cara Sewa</button><button type="button" data-how="beli" role="tab">Cara Beli</button></div>
        <div class="stroke" style="color:var(--g800)" id="swoosh"></div>
        <div class="mtn" style="color:var(--g900)" id="mtnSolid"></div>
      </div>
      <ol class="steps" data-how-steps="sewa" data-reveal-group>
        <li class="step"><a href="{{ route('katalog') }}"><div class="blob"><span class="num">1</span><i class="fa-regular fa-calendar-days"></i></div><h4>Pilih Produk</h4><p>Lihat katalog dan tentukan perlengkapan yang kamu butuhkan.</p></a></li>
        <li class="step-arrow" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></li>
        <li class="step"><a href="{{ route('keranjang') }}"><div class="blob"><span class="num">2</span><i class="fa-regular fa-clipboard"></i></div><h4>Isi Form Sewa</h4><p>Lengkapi data diri dan pilih tanggal ambil &amp; kembali.</p></a></li>
        <li class="step-arrow" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></li>
        <li class="step"><a href="{{ route('tentang') }}#ketentuan"><div class="blob"><span class="num">3</span><i class="fa-regular fa-credit-card"></i></div><h4>Lakukan Pembayaran</h4><p>Transfer atau pembayaran online yang tersedia.</p></a></li>
        <li class="step-arrow" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></li>
        <li class="step"><a href="{{ route('pesanan') }}"><div class="blob"><span class="num">4</span><i class="fa-solid fa-store"></i></div><h4>Ambil di Toko</h4><p>Tunjukkan nota digital &amp; kartu identitas, barang siap dipakai!</p></a></li>
      </ol>
      <ol class="steps" data-how-steps="beli" hidden>
        <li class="step"><a href="{{ route('belanja') }}"><div class="blob"><span class="num">1</span><i class="fa-solid fa-bag-shopping"></i></div><h4>Pilih Barang</h4><p>Buka halaman Beli Alat, pilih perlengkapan baru yang kamu inginkan.</p></a></li>
        <li class="step-arrow" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></li>
        <li class="step"><a href="{{ route('keranjang') }}"><div class="blob"><span class="num">2</span><i class="fa-solid fa-cart-shopping"></i></div><h4>Checkout</h4><p>Masukkan ke keranjang, isi data diri, dan pilih metode pembayaran.</p></a></li>
        <li class="step-arrow" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></li>
        <li class="step"><a href="{{ route('tentang') }}#ketentuan"><div class="blob"><span class="num">3</span><i class="fa-regular fa-credit-card"></i></div><h4>Bayar Penuh</h4><p>Transfer atau QRIS, lalu unggah bukti. Admin memverifikasi pembayaranmu.</p></a></li>
        <li class="step-arrow" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></li>
        <li class="step"><a href="{{ route('pesanan') }}?tab=beli"><div class="blob"><span class="num">4</span><i class="fa-solid fa-store"></i></div><h4>Ambil di Toko</h4><p>Barang dikemas, kamu dapat notifikasi saat siap diambil.</p></a></li>
      </ol>
    </div>
  </section>

  <section class="cta" id="cta">
    <div class="cta-bg" aria-hidden="true" data-reveal></div>
    <div class="wrap" data-reveal="left">
      <h2>Perlengkapan Lengkap, Petualangan Tanpa Batas</h2>
      <p>Dari tenda hingga carrier, semua kebutuhan camping kamu bisa disewa atau dibeli di Annapurna Adventure. Sewa untuk trip berikutnya, atau miliki sendiri perlengkapan barunya — kami siap menjadi partner setiap perjalananmu, dari gunung hingga hutan.</p>
      <div class="cta-btns"><a class="btn btn-gold" href="{{ route('katalog') }}"><i class="fa-solid fa-campground"></i> Sewa Alat</a><a class="btn btn-onDark" href="{{ route('belanja') }}"><i class="fa-solid fa-bag-shopping"></i> Belanja Alat</a></div>
    </div>
  </section>

  <section class="section" id="testimoni" style="padding:48px 0 56px">
    <div class="wrap testi">
      <div class="testi-intro" data-reveal="left">
        <div class="eyebrow">Testimoni</div>
        <h2 class="sec-title">Apa Kata Mereka?</h2>
        <p class="sec-sub">Terima kasih sudah mempercayai Annapurna Adventure!</p>
        <div class="seg testi-tabs" role="tablist" aria-label="Jenis testimoni"><button type="button" class="active" data-tt="rent" role="tab"><i class="fa-solid fa-campground"></i> Penyewa</button><button type="button" data-tt="buy" role="tab"><i class="fa-solid fa-bag-shopping"></i> Pembeli</button></div>
        <div class="testi-score" id="testiScore"></div>
        <div class="testi-nav" id="testiNav" hidden>
          <button class="icon-btn" data-dir="-1" aria-label="Testimoni sebelumnya"><i class="fa-solid fa-arrow-left"></i></button>
          <button class="icon-btn" data-dir="1" aria-label="Testimoni berikutnya"><i class="fa-solid fa-arrow-right"></i></button>
        </div>
        <div class="mtn" style="color:#9aa89a" id="mtnSolid2"></div>
      </div>
      <div class="testi-track" id="testiCards" data-reveal-group></div>
    </div>
  </section>
</main>
@endsection

@push('styles')
<style>
  /* Beranda memakai tampilan klasik sesuai prototype. Gaya ini hanya berlaku di beranda. */
  body[data-page="home"] .cat-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; }
  body[data-page="home"] .cat-card { border: 1px solid var(--line); border-radius: var(--r); text-align: center; }
  body[data-page="home"] .cat-card:hover { border-color: var(--g500); box-shadow: var(--shadow); }
  body[data-page="home"] .cat-card .ph { aspect-ratio: 1 / 1; background: var(--sand); }
  body[data-page="home"] .cat-card .ph img { width: 100%; height: 100%; object-fit: cover; padding: 0; }
  body[data-page="home"] .cat-card:hover .ph img { transform: scale(1.08) rotate(-1deg); }
  body[data-page="home"] .cat-card .tx { display: block; padding: 14px 10px 16px; }
  body[data-page="home"] .cat-card strong { display: block; font-size: 14.5px; font-weight: 600; line-height: 1.35; }
  body[data-page="home"] .cat-card small { white-space: normal; font-size: 12.5px; }


  @media (max-width: 1180px) { body[data-page="home"] .cat-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 768px) {
    body[data-page="home"] .cat-grid { grid-template-columns: repeat(6, 132px); overflow-x: auto; }
    body[data-page="home"] .cat-card .tx { display: block; }
  }
</style>
@endpush

@push('scripts')
  <script src="{{ asset('assets/js/pages/index.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
