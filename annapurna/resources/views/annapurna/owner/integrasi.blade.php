@extends('annapurna.layouts.admin')

@section('title', 'Google Drive & Email')
@section('menu', 'owner-integrasi')
@section('owner_only', '1')

@section('content')
  <p class="page-sub">Setiap awal bulan sistem membuat rekap laporan bulan sebelumnya, menyimpannya ke Google Drive per tahun &amp; bulan, lalu mengirim email ringkasan beserta link folder ke Owner.</p>
  <div class="grid-dash" style="grid-template-columns:1fr 1fr">
    <div class="panel">
      <div class="panel-h"><h3><i class="fa-brands fa-google-drive" style="color:#1a73e8"></i> Google Drive</h3><span id="driveState"></span></div>
      <form id="gf" novalidate>
        <div class="field"><label>Akun Google</label><input class="input" name="driveAccount" type="email"></div>
        <div class="field"><label>Folder utama</label><input class="input" name="driveRoot"><span class="hint">Struktur: folder utama / TAHUN 2026 / REKAP LAPORAN BULAN …</span></div>
        <label style="display:flex;gap:8px;align-items:center;font-size:14px;margin-bottom:12px"><input type="checkbox" name="autoMonthly"> Buat rekap otomatis setiap bulan</label>
        <div class="grid-2">
          <div class="field"><label>Tanggal pembuatan</label><select class="select" name="sendDay">@for ($d = 1; $d <= 5; $d++)<option value="{{ $d }}">Tanggal {{ $d }} bulan berikutnya</option>@endfor</select></div>
          <div class="field"><label>Jam</label><input class="input" type="time" name="sendTime"></div>
        </div>
      </form>
    </div>
    <div class="panel">
      <div class="panel-h"><h3><i class="fa-regular fa-envelope" style="color:var(--g700)"></i> Email laporan</h3></div>
      <form id="mf" novalidate>
        <div class="field"><label>Email Owner (penerima utama)</label><input class="input" name="ownerEmail" type="email"></div>
        <div class="field"><label>CC (opsional, pisahkan dengan koma)</label><input class="input" name="ccEmails" placeholder="contoh: partner@mail.com"></div>
      </form>
      <div id="nextRun" class="notice green" style="margin-top:4px"></div>
      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" id="saveInt"><i class="fa-solid fa-floppy-disk"></i> Simpan pengaturan</button>
      </div>
    </div>
  </div>
  <div class="panel" style="margin-top:18px">
    <div class="panel-h"><h3>Arsip laporan di Google Drive</h3>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input class="input" type="month" id="genPeriod" style="width:auto;padding:8px 12px"><button class="btn btn-light btn-sm" id="gen"><i class="fa-solid fa-cloud-arrow-up"></i> Buat rekap &amp; kirim email</button></div>
    </div>
    <div id="drive"></div>
  </div>
  <div class="panel cleanup" id="bersih">
    <div class="panel-h"><h3><i class="fa-solid fa-broom" style="color:var(--g600)"></i> Pembersihan data setelah rekap</h3></div>
    <p class="muted" style="font-size:13.5px;margin:0 0 10px">Setiap tanggal 1, rekap bulan sebelumnya disimpan ke Google Drive dan dikirim ke email owner. Setelah rekap berhasil, data bulan itu yang sudah tidak dipakai bisa dihapus dari website agar tetap ringan. Bila rekap gagal, pembersihan tidak dijalankan.</p>
    <div class="cl-modes" role="radiogroup" aria-label="Mode pembersihan">
      <label><input type="radio" name="clMode" value="approve"><span><b><i class="fa-solid fa-user-check"></i> Minta persetujuan owner</b><small>Disarankan. Owner mendapat notifikasi &amp; pop-up; data baru dihapus setelah disetujui.</small></span></label>
      <label><input type="radio" name="clMode" value="auto"><span><b><i class="fa-solid fa-bolt"></i> Otomatis</b><small>Langsung dibersihkan setelah rekap berhasil, lalu owner diberi tahu.</small></span></label>
      <label><input type="radio" name="clMode" value="off"><span><b><i class="fa-solid fa-ban"></i> Nonaktif</b><small>Data tidak pernah dibersihkan dan tidak ada pengingat.</small></span></label>
    </div>
    <div class="cl-grid">
      <div class="cl-box del"><b><i class="fa-solid fa-trash-can"></i> Dihapus</b><ul><li>Pesanan sewa & beli yang <b>selesai/dibatalkan</b> tanpa tunggakan</li><li>Log aktivitas & histori login staff</li><li>Notifikasi & email keluar (kecuali email rekap)</li><li>Catatan kas manual</li><li>Foto bukti bayar & foto kondisi pada pesanan tsb.</li></ul></div>
      <div class="cl-box keep"><b><i class="fa-solid fa-shield-halved"></i> Selalu disimpan</b><ul><li>Barang, unit, kategori, paket, promo, pengaturan, staff</li><li>Pesanan aktif, belum lunas, atau ada denda</li><li>Ulasan pelanggan</li><li>Ringkasan angka bulanan (grafik & perbandingan tetap jalan)</li><li>Riwayat & total belanja tiap pelanggan</li></ul></div>
    </div>
    <div id="clPrev"></div>
  </div>
  <div class="panel">
    <div class="panel-h"><h3>Kotak keluar email</h3><span class="muted" style="font-size:13px" id="obCount"></span></div>
    <div id="outbox"></div>
  </div>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/owner/integrasi.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
