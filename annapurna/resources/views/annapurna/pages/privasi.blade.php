@extends('annapurna.layouts.app')

@section('title', 'Kebijakan Privasi')
@section('page', 'privasi')

@section('content')
<section class="page-hero ab-page-hero hp-ketentuan">
  <div class="wrap">
    <div class="ab-ph-text">
      <div class="crumbs ha" style="--d:.05s"><a href="{{ route('home') }}">Beranda</a><span>/</span><span>Kebijakan Privasi</span></div>
      <h1 class="ha" style="--d:.2s">Kebijakan privasi</h1>
      <p class="ha" style="--d:.3s">Data apa yang kami simpan saat kamu memakai website Annapurna Adventure, untuk apa, dan bagaimana kami menjaganya.</p>
    </div>
  </div>
</section>

<main class="ab-main kt-main">
  <section class="section ab-rules">
    <div class="wrap">
      <div class="ab-rules-grid">
        <div class="ab-rule-card" id="data">
          <div class="ab-rule-h"><span class="ab-v-ic"><i class="fa-solid fa-user"></i></span><h3>Data yang kami simpan</h3></div>
          <ol class="ab-list">
            <li><strong>Data akun:</strong> nama, email, nomor WhatsApp, dan alamat. Kata sandi disimpan dalam bentuk acak (hash) sehingga tidak bisa dibaca siapa pun, termasuk kami.</li>
            <li><strong>Data pesanan:</strong> barang yang disewa atau dibeli, tanggal sewa, alamat antar, jenis kartu identitas yang dititipkan sebagai jaminan, catatan pembayaran, dan foto bukti transfer yang kamu unggah.</li>
            <li><strong>Laundry:</strong> barang yang dicuci, jadwal, dan status pengerjaan.</li>
            <li><strong>Masuk dengan Google:</strong> bila kamu memilih cara ini, kami hanya menerima nama, alamat email, dan ID akun Google kamu. Kami tidak pernah menerima kata sandi Google kamu.</li>
            <li><strong>Data teknis:</strong> cookie sesi supaya kamu tetap masuk, serta catatan keamanan seperti waktu masuk akun staf.</li>
          </ol>
        </div>
        <div class="ab-rule-card" id="guna">
          <div class="ab-rule-h"><span class="ab-v-ic gold"><i class="fa-solid fa-list-check"></i></span><h3>Untuk apa data dipakai</h3></div>
          <ol class="ab-list">
            <li>Memproses pesanan sewa, pembelian, dan laundry, termasuk menyiapkan barang dan mengantar pesanan.</li>
            <li>Memeriksa pembayaran dan mengembalikan uang (refund) bila ada pembatalan.</li>
            <li>Menghubungi kamu lewat WhatsApp atau email tentang pesanan, pengingat pengembalian, dan kode verifikasi akun.</li>
            <li>Menyusun laporan keuangan dan stok internal toko.</li>
            <li>Menjaga keamanan akun dan mencegah penyalahgunaan.</li>
          </ol>
          <p class="muted" style="font-size:13px;margin-top:10px">Kami <strong>tidak menjual</strong> data kamu dan tidak memakainya untuk iklan.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section ab-rules kt-more">
    <div class="wrap">
      <div class="ab-rules-grid">
        <div class="ab-rule-card" id="pihak-lain">
          <div class="ab-rule-h"><span class="ab-v-ic"><i class="fa-solid fa-handshake"></i></span><h3>Layanan pihak lain</h3></div>
          <ol class="ab-list">
            <li><strong>Google Sign-In:</strong> untuk tombol "Masuk dengan Google".</li>
            <li><strong>Google Drive milik toko:</strong> laporan rekap bulanan toko disimpan di Google Drive pemilik toko. Website hanya bisa mengakses folder dan file yang dibuatnya sendiri, bukan isi Drive lainnya. Fitur ini hanya dipakai pemilik toko.</li>
            <li><strong>Google Gemini (Asisten Trip):</strong> pertanyaan yang kamu ketik di Asisten Trip dikirim ke Google Gemini untuk dijawab, bersama info katalog dan isi keranjang. Nama, email, dan nomor HP kamu <strong>tidak</strong> ikut dikirim. Jangan menulis data pribadi di kolom pertanyaan.</li>
            <li><strong>Email:</strong> kode verifikasi dan pemberitahuan dikirim lewat layanan email toko.</li>
            <li><strong>Peta Google:</strong> halaman Kontak menampilkan peta lokasi toko dari Google Maps.</li>
          </ol>
        </div>
        <div class="ab-rule-card" id="jaga">
          <div class="ab-rule-h"><span class="ab-v-ic gold"><i class="fa-solid fa-shield-halved"></i></span><h3>Penyimpanan &amp; keamanan</h3></div>
          <ol class="ab-list">
            <li>Data disimpan di server hosting website ini dan dikirim melalui koneksi terenkripsi (HTTPS).</li>
            <li>Hanya pemilik toko dan staf yang membutuhkan yang bisa melihat data pesanan. Setiap perubahan oleh staf tercatat di histori sistem.</li>
            <li>Data transaksi disimpan selama dibutuhkan untuk pembukuan toko.</li>
          </ol>
        </div>
        <div class="ab-rule-card" id="hak">
          <div class="ab-rule-h"><span class="ab-v-ic"><i class="fa-solid fa-user-pen"></i></span><h3>Hak kamu</h3></div>
          <ol class="ab-list">
            <li>Melihat dan mengubah nama, nomor WhatsApp, alamat, dan kata sandi di halaman <a class="link" href="{{ route('profil') }}">Profil</a>.</li>
            <li>Meminta akun kamu dihapus lewat halaman <a class="link" href="{{ route('kontak') }}">Kontak</a>. Catatan transaksi yang sudah terjadi tetap kami simpan untuk pembukuan, tanpa dipakai untuk keperluan lain.</li>
            <li>Bertanya tentang data kamu kapan saja lewat halaman <a class="link" href="{{ route('kontak') }}">Kontak</a>.</li>
          </ol>
        </div>
      </div>
      <p class="muted kt-upd">Berlaku sejak 23 November 2026. Bila kebijakan ini berubah, tanggal di sini ikut diperbarui.</p>
    </div>
  </section>
</main>
@endsection
