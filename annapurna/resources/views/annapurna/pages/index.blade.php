@extends('annapurna.layouts.app')

@section('title', 'Annapurna Adventure — Sewa Alat Camping & Outdoor di Purwokerto')
@section('page', 'home')
@section('title_suffix', '')

@section('head')
  <meta name="description" content="Sewa dan beli perlengkapan camping dan outdoor di Annapurna Adventure, Purwokerto. Tenda, carrier, sleeping bag, kompor, dan lainnya.">
@endsection

@section('content')
<main>
  <section class="hero" id="hero">
    <div class="hero-bg" aria-hidden="true"></div>
    <div class="wrap hero-inner">
      <h1 class="hero-title">
        <span class="ht-l1 ha" style="--d:.15s">Jelajahi Alam,</span><span class="l2 ha" style="--d:.35s">Lengkapi Petualanganmu</span>
      </h1>
      <p class="hero-lead ha" style="--d:.55s">Sewa perlengkapan camping dan outdoor terpercaya di Annapurna Adventure. Peralatan berkualitas, harga bersahabat, siap menemani setiap langkah petualanganmu!</p>
      <form class="hero-search ha" style="--d:.7s" id="heroSearch" role="search">
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <label class="sr-only" for="heroQ">Cari perlengkapan</label>
        <input id="heroQ" name="q" placeholder="Cari perlengkapan yang kamu butuhkan…" autocomplete="off">
        <button class="btn btn-primary" type="submit">Cari</button>
      </form>
      <ul class="hero-perks">
        <li class="ha" style="--d:.85s"><span class="ic"><i class="fa-solid fa-shield-halved"></i></span>Peralatan Berkualitas &amp; Terawat</li>
        <li class="ha" style="--d:.95s"><span class="ic"><i class="fa-regular fa-gem"></i></span>Harga Terjangkau</li>
        <li class="ha" style="--d:1.05s"><span class="ic"><i class="fa-solid fa-stopwatch"></i></span>Proses Rental Mudah &amp; Cepat</li>
      </ul>
    </div>
    <div class="hero-note" aria-hidden="true"><span>Alat Lengkap<br>Petualangan<br>Makin Seru!</span>
      <svg viewBox="0 0 90 14" fill="none"><path d="M3 11 C30 3 60 2 87 4" stroke="#f2c14e" stroke-width="3" stroke-linecap="round" pathLength="1"/></svg>
    </div>
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

  <section class="section bestseller">
    <div class="wrap">
      <div class="sec-head" data-reveal>
        <div><div class="eyebrow">Produk Pilihan</div><h2 class="sec-title big">Produk Rental Terlaris</h2></div>
        <a class="btn btn-light btn-sm" href="{{ route('katalog') }}">Lihat Semua <i class="fa-solid fa-arrow-right"></i></a>
      </div>
      <div class="prod-grid" id="bestGrid" data-reveal-group></div>
    </div>
  </section>

  <section class="section ai-plan-sec" style="padding-top:8px">
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
          <div class="ex"><button type="button">Naik Slamet berdua 2 malam</button><button type="button">Tektok Prau sendirian</button><button type="button">Kemah keluarga 5 orang</button></div>
        </form>
      </div>
    </div>
  </section>

  <section class="section" id="cara-sewa">
    <div class="wrap howto">
      <div class="howto-intro" data-reveal="left">
        <span class="ms">Annapurna</span>
        <h2>Cara Sewa</h2>
        <h3>Mudah, Cepat, Tanpa Ribet</h3>
        <p>Nikmati proses penyewaan yang praktis dan aman bersama Annapurna Adventure.</p>
        <div class="stroke" style="color:var(--g800)" id="swoosh"></div>
        <div class="mtn" style="color:var(--g900)" id="mtnSolid"></div>
      </div>
      <ol class="steps" data-reveal-group>
        <li class="step"><a href="{{ route('katalog') }}"><div class="blob"><span class="num">1</span><i class="fa-regular fa-calendar-days"></i></div><h4>Pilih Produk</h4><p>Lihat katalog dan tentukan perlengkapan yang kamu butuhkan.</p></a></li>
        <li class="step-arrow" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></li>
        <li class="step"><a href="{{ route('keranjang') }}"><div class="blob"><span class="num">2</span><i class="fa-regular fa-clipboard"></i></div><h4>Isi Form Sewa</h4><p>Lengkapi data diri dan pilih tanggal ambil &amp; kembali.</p></a></li>
        <li class="step-arrow" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></li>
        <li class="step"><a href="{{ route('tentang') }}#ketentuan"><div class="blob"><span class="num">3</span><i class="fa-regular fa-credit-card"></i></div><h4>Lakukan Pembayaran</h4><p>Transfer atau pembayaran online yang tersedia.</p></a></li>
        <li class="step-arrow" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></li>
        <li class="step"><a href="{{ route('pesanan') }}"><div class="blob"><span class="num">4</span><i class="fa-solid fa-store"></i></div><h4>Ambil di Toko</h4><p>Tunjukkan nota digital &amp; kartu identitas, barang siap dipakai!</p></a></li>
      </ol>
    </div>
  </section>

  <section class="cta" id="cta">
    <div class="cta-bg" aria-hidden="true" data-reveal></div>
    <div class="wrap" data-reveal="left">
      <h2>Perlengkapan Lengkap, Petualangan Tanpa Batas</h2>
      <p>Dari tenda hingga carrier, semua kebutuhan camping kamu tersedia di Annapurna Adventure. Dengan kualitas terbaik dan harga bersahabat, kami siap menjadi partner setiap perjalananmu, dari gunung hingga hutan.</p>
      <a class="btn btn-gold" href="{{ route('katalog') }}">Jelajahi Semua Produk <i class="fa-solid fa-arrow-right"></i></a>
    </div>
  </section>

  <section class="section" id="testimoni" style="padding:48px 0 56px">
    <div class="wrap testi">
      <div class="testi-intro" data-reveal="left">
        <div class="eyebrow">Testimoni</div>
        <h2 class="sec-title">Apa Kata Mereka?</h2>
        <p class="sec-sub">Terima kasih sudah mempercayai Annapurna Adventure!</p>
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

@push('scripts')
  <script src="{{ asset('assets/js/pages/index.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
