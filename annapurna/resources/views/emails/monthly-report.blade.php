@php
  $rp = fn ($v) => 'Rp ' . number_format((int) $v, 0, ',', '.');
  $row = fn ($k) => 'color:#6b766e;border-bottom:1px solid #e4dfd4';
@endphp
<!DOCTYPE html>
<html lang="id">
<body style="margin:0;background:#f6f4ee;font-family:Arial,Helvetica,sans-serif;color:#17261c">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e4dfd4;border-radius:12px;padding:28px">
      <tr><td style="border-bottom:2px solid #1f4d2f;padding-bottom:14px"><strong style="font-size:18px;color:#1f4d2f">Annapurna Adventure</strong></td></tr>
      <tr><td style="padding-top:18px;font-size:14px;line-height:1.6">
        <p>Halo Owner,</p>
        <p>Rekap laporan operasional bulan <strong>{{ $month }}</strong> telah dibuat dan disimpan di Google Drive.</p>
        <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-size:14px">
          @foreach ([
            'Total transaksi rental' => $s['rental'] ?? 0,
            'Total penjualan' => $s['penjualan'] ?? 0,
            'Total pemasukan' => $rp($s['pemasukan'] ?? 0),
            'Total pengeluaran' => $rp($s['pengeluaran'] ?? 0),
            'Selisih' => $rp(($s['pemasukan'] ?? 0) - ($s['pengeluaran'] ?? 0)),
            'Barang keluar' => $s['keluar'] ?? 0,
            'Barang kembali' => $s['kembali'] ?? 0,
            'Pembatalan' => $s['batal'] ?? 0,
            'Pergantian barang' => $s['ganti'] ?? 0,
            'Aktivitas staff' => $s['aktivitas'] ?? 0,
          ] as $k => $v)
          <tr><td style="{{ $row($k) }}">{{ $k }}</td><td style="border-bottom:1px solid #e4dfd4">{{ $v }}</td></tr>
          @endforeach
        </table>
        <p><strong>File di folder {{ $archive->path[2] ?? '' }}:</strong></p>
        <ul>
          @foreach ($archive->files as $f)
          <li>@if (! empty($f['url']))<a href="{{ $f['url'] }}">{{ $f['name'] }}</a>@else{{ $f['name'] }}@endif</li>
          @endforeach
        </ul>
        <p><a href="{{ $archive->drive_folder_url }}" style="display:inline-block;background:#1f4d2f;color:#ffffff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:bold">Buka folder di Google Drive</a></p>
        <p style="font-size:12.5px;color:#6b766e">Arsip juga bisa dilihat di panel Owner: <a href="{{ $panelUrl }}">{{ $panelUrl }}</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>
